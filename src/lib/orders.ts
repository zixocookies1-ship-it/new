import 'server-only';

import crypto from 'node:crypto';

import { connectDb } from './db';
import { Order, type OrderDoc } from './models/Order';
import { getShippingConfig } from './models/ShippingConfiguration';
import { getBusinessSettings } from './models/BusinessSettings';
import {
  createShipment,
  trackShipment,
  isDelhiveryReady,
  DelhiveryError,
  mapDelhiveryStatus,
  buildTrackingUrl,
  type DelhiveryAddress,
} from './delhivery';
import {
  confirmPayment,
  createRazorpayOrder,
  isRazorpayReady,
  fetchRazorpayOrder,
  fetchPayment,
  type RazorpayPaymentDetail,
} from './razorpay';
import {
  commitInventory,
  incrementCouponUsage,
  priceCart,
  releaseInventory,
  type PricedLine,
  type PricingResult,
} from './pricing';
import { publicEnv, serverEnv } from './env';
import type { OrderStatus, PaymentStatus } from './types';

/* -------------------------------------------------------------------------- */
/* Identifiers                                                                */
/* -------------------------------------------------------------------------- */

// Crockford base32: no I, L, O, U — removes transcription ambiguity on the phone.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomBase32(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** Customer-facing order id: NC-XXXXXXXXXX. Non-sequential and unguessable. */
export function generateOrderId(): string {
  return `NC-${randomBase32(10)}`;
}

/** Internal sequential reference, shown in support conversations. */
function nextReference(): Promise<number> {
  return Order.countDocuments().then((c) => c + 1001);
}

async function uniqueOrderId(): Promise<string> {
  for (let i = 0; i < 6; i += 1) {
    const candidate = generateOrderId();
    const clash = await Order.exists({ orderId: candidate });
    if (!clash) return candidate;
  }
  return `NC-${Date.now().toString(36).toUpperCase()}`;
}

/* -------------------------------------------------------------------------- */
/* Order creation                                                             */
/* -------------------------------------------------------------------------- */

export interface CreateOrderInput {
  lines: Array<{ productId: string; variantId: string; qty: number }>;
  bundles?: Array<{ bundleId: string; qty: number }>;
  couponCode?: string | null;
  paymentMethod: 'RAZORPAY' | 'COD';
  address: {
    name: string;
    phone: string;
    email?: string;
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
    alternatePhone?: string;
  };
  customerNote?: string;
  /** Idempotency key from the checkout client. */
  clientCheckoutToken: string;
  serviceability?: 'SERVICEABLE' | 'UNSERVICEABLE' | 'UNKNOWN';
}

export type CreateOrderOutcome =
  | { ok: true; order: OrderDoc; pricing: PricingResult; reused: boolean }
  | { ok: false; error: string; status: number; pricing?: PricingResult; issues?: PricingResult['issues'] };

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderOutcome> {
  await connectDb();

  // Idempotency: the same checkout token can never create two orders.
  if (input.clientCheckoutToken) {
    const existing = await Order.findOne({ clientCheckoutToken: input.clientCheckoutToken }).exec();
    if (existing) {
      const pricing = await priceCart({
        lines: input.lines,
        bundles: input.bundles,
        couponCode: input.couponCode,
        paymentMethod: input.paymentMethod,
      });
      return { ok: true, order: existing, pricing, reused: true };
    }
  }

  const pricing = await priceCart({
    lines: input.lines,
    bundles: input.bundles,
    couponCode: input.couponCode,
    paymentMethod: input.paymentMethod,
    pincode: input.address.pincode,
  });

  if (!pricing.ok || pricing.totalPaise <= 0) {
    return {
      ok: false,
      error: pricing.issues[0]?.message ?? 'Some items in your cart are unavailable.',
      status: 422,
      pricing,
      issues: pricing.issues,
    };
  }

  const cfg = await getShippingConfig();

  // COD was requested but is not actually available — refuse rather than
  // silently switching the customer to a different payment method.
  if (input.paymentMethod === 'COD' && !pricing.codAvailable) {
    return {
      ok: false,
      error: pricing.codBlockedReason ?? 'Cash on delivery is not available for this order.',
      status: 422,
      pricing,
    };
  }

  if (input.paymentMethod === 'RAZORPAY' && !isRazorpayReady()) {
    return {
      ok: false,
      error: 'Online payment is not available right now. Please contact support.',
      status: 503,
      pricing,
    };
  }

  const addressDoc = {
    name: input.address.name,
    phone: input.address.phone,
    email: input.address.email?.toLowerCase() || undefined,
    line1: input.address.line1,
    line2: input.address.line2,
    landmark: input.address.landmark,
    city: input.address.city,
    state: input.address.state,
    pincode: input.address.pincode,
    country: input.address.country || 'India',
    servicePincode: input.address.pincode.slice(0, 6),
    serviceability: input.serviceability ?? ('UNKNOWN' as const),
    alternatePhone: input.address.alternatePhone,
  };

  const isCod = input.paymentMethod === 'COD';
  const now = new Date();

  const orderId = await uniqueOrderId();
  const reference = String(await nextReference());

  const items = pricing.lines.map((l) => ({
    productId: l.productId as never,
    variantId: l.variantId as never,
    name: l.name,
    slug: l.slug,
    flavour: l.flavour,
    sku: l.sku,
    weightLabel: l.weightLabel,
    imageUrl: l.imageUrl,
    unitPricePaise: l.unitPricePaise,
    mrpPaise: l.mrpPaise,
    qty: l.qty,
    lineTotalPaise: l.lineTotalPaise,
    bundleId: l.bundleId as never,
    bundleName: l.bundleName,
  }));

  const [order] = await Order.create([
    {
      orderId,
      reference,
      email: addressDoc.email ?? null,
      phone: addressDoc.phone,
      userId: null,

      items,

      subtotalPaise: pricing.subtotalPaise,
      mrpTotalPaise: pricing.mrpTotalPaise,
      discountPaise: pricing.discountPaise,
      shippingPaise: pricing.shippingPaise,
      shippingChargedPaise: pricing.shippingPaise,
      taxPaise: pricing.taxPaise,
      totalPaise: pricing.totalPaise,
      freeShippingApplied: pricing.freeShippingUnlocked,
      freeShippingThresholdPaise: pricing.freeShippingThresholdPaise,

      couponCode: pricing.coupon?.valid ? pricing.coupon.coupon?.code ?? input.couponCode ?? null : null,
      couponId: (pricing.coupon?.coupon?._id as never) ?? null,
      couponDiscountPaise: pricing.couponDiscountPaise || null,

      bundleId: (items.find((i) => i.bundleId)?.bundleId as never) ?? null,

      address: addressDoc,
      shippingAddress: addressDoc,

      payment: {
        method: isCod ? 'COD' : 'RAZORPAY',
        status: isCod ? 'PENDING' : 'PENDING',
        amount: pricing.totalPaise,
        currency: 'INR',
        gateway: isCod ? 'COD' : 'RAZORPAY',
        razorpayOrderId: null,
        razorpayPaymentId: null,
        razorpaySignature: null,
        razorpaySignatureProvided: null,
        signatureVerified: false,
        verifiedAt: null,
        attemptedAt: null,
        refundId: null,
        refundedAt: null,
        refundAmount: null,
        processedAt: null,
        webhookEvents: [],
      },

      shipping: {
        status: 'PENDING',
        carrier: 'DELHIVERY',
        syncStatus: 'IDLE',
        waybill: null,
        delhiveryOrderId: null,
        delhiveryShipmentId: null,
        delhiveryRefNo: null,
        trackingUrl: null,
        awbGenerated: false,
        pickupLocation: cfg.pickupName || null,
        lastSyncedAt: null,
        lastStatusAt: null,
        syncError: null,
        syncAttempts: 0,
        estimatedDeliveryDays: null,
        courierCharges: null,
        codAmount: isCod ? pricing.totalPaise : 0,
        lastStatusText: null,
        statusHistory: [
          { status: 'PENDING', at: now, source: 'SYSTEM' as const, note: 'Order created' },
        ],
      },

      status: isCod ? 'PAID' : 'PAYMENT_PENDING',
      statusHistory: [
        {
          status: isCod ? 'PAID' : 'PAYMENT_PENDING',
          at: now,
          source: 'CUSTOMER' as const,
          note: isCod ? 'Cash on delivery order confirmed' : 'Awaiting payment',
        },
      ],

      customerNote: (input.customerNote ?? '').slice(0, 1000),
      adminNote: '',
      clientCheckoutToken: input.clientCheckoutToken,
      inventoryCommitted: false,
      cancelledAt: null,
      cancelReason: null,
      deliveredAt: null,
    },
  ]);

  // Reserve stock. If stock vanished between pricing and commit we roll the
  // whole order back rather than overselling.
  const commit = await commitInventory(
    pricing.lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
  );

  if (!commit.ok) {
    await Order.deleteOne({ _id: order._id }).exec();
    return {
      ok: false,
      error: 'An item just sold out. Please review your cart and try again.',
      status: 409,
    };
  }

  order.inventoryCommitted = true;
  await order.save();

  if (order.couponCode) void incrementCouponUsage(order.couponCode);

  // COD: payment is collected on delivery, so the order is immediately
  // "confirmed" from our side and is eligible for fulfilment.
  if (isCod) {
    await onOrderConfirmed(order._id, { isCod: true });
  }

  return { ok: true, order, pricing, reused: false };
}

/* -------------------------------------------------------------------------- */
/* Payment                                                                    */
/* -------------------------------------------------------------------------- */

export interface GatewayOrder {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

/** Create (or reuse) the Razorpay order for one of our orders. */
export async function ensureRazorpayOrder(orderId: string): Promise<
  | { ok: true; gateway: GatewayOrder; order: OrderDoc }
  | { ok: false; error: string; status: number }
> {
  await connectDb();
  const order = await Order.findOne({ orderId }).exec();

  if (!order) return { ok: false, error: 'Order not found.', status: 404 };
  if (order.status === 'CANCELLED') {
    return { ok: false, error: 'This order has been cancelled.', status: 409 };
  }
  if (order.payment.status === 'PAID') {
    return { ok: false, error: 'This order is already paid.', status: 409 };
  }
  if (!isRazorpayReady()) {
    return { ok: false, error: 'Payments are not available right now.', status: 503 };
  }

  // Reuse an existing gateway order so a payment retry does not orphan the
  // first attempt or create a second charge.
  if (order.payment.razorpayOrderId) {
    try {
      const remote = await fetchRazorpayOrder(order.payment.razorpayOrderId);
      if (remote.status === 'paid') {
        return { ok: false, error: 'This order is already paid.', status: 409 };
      }
      return {
        ok: true,
        order,
        gateway: {
          razorpayOrderId: remote.id,
          amount: remote.amount,
          currency: remote.currency,
          keyId: serverEnv.razorpay.keyId,
        },
      };
    } catch {
      // Stale/invalid gateway order — fall through and create a fresh one.
    }
  }

  const created = await createRazorpayOrder({
    amountPaise: order.totalPaise,
    receipt: order.orderId.slice(0, 40),
    notes: {
      orderId: order.orderId,
      internalOrderId: String(order._id),
      customerPhone: order.phone.slice(-10),
    },
  });

  order.payment.razorpayOrderId = created.id;
  order.payment.amount = order.totalPaise;
  order.payment.status = 'PENDING';
  order.payment.attemptedAt = new Date();
  if (order.status === 'ORDER_PLACED') order.status = 'PAYMENT_PENDING';
  await order.save();

  return {
    ok: true,
    order,
    gateway: {
      razorpayOrderId: created.id,
      amount: created.amount,
      currency: created.currency,
      keyId: serverEnv.razorpay.keyId,
    },
  };
}

export type VerifyOutcome =
  | { ok: true; order: OrderDoc; alreadyProcessed: boolean }
  | { ok: false; error: string; status: number; order?: OrderDoc; retryable?: boolean };

/**
 * Verify a payment callback.
 *
 * Never trusts the client. Signature is checked, then the payment is fetched
 * from Razorpay and cross-checked (order id, captured status, exact amount).
 * A second call for the same order is a no-op that returns the same success.
 */
export async function verifyPaymentForOrder(params: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyOutcome> {
  await connectDb();
  const order = await Order.findOne({ orderId: params.orderId }).exec();

  if (!order) return { ok: false, error: 'Order not found.', status: 404 };
  if (order.status === 'CANCELLED') {
    return { ok: false, error: 'This order was cancelled.', status: 409, order };
  }

  // Idempotent: the customer refreshed the success page / the webhook arrived
  // first. Both paths must converge on the same terminal state.
  if (order.payment.status === 'PAID' && order.payment.signatureVerified) {
    return { ok: true, order, alreadyProcessed: true };
  }

  // The gateway order must be one we actually created for this order.
  if (
    order.payment.razorpayOrderId &&
    order.payment.razorpayOrderId !== params.razorpayOrderId
  ) {
    order.payment.status = 'FAILED' as PaymentStatus;
    order.payment.failureCode = 'ORDER_MISMATCH';
    order.payment.failureDescription = 'Callback referenced a different payment order.';
    await order.save();
    return { ok: false, error: 'Payment could not be matched to this order.', status: 400, order };
  }

  const result = await confirmPayment({
    razorpayOrderId: params.razorpayOrderId,
    razorpayPaymentId: params.razorpayPaymentId,
    signature: params.razorpaySignature,
    expectedAmountPaise: order.totalPaise,
  });

  if (!result.ok) {
    order.payment.status = result.code === 'NOT_CAPTURED' ? 'PENDING' : 'FAILED';
    order.payment.failureCode = result.code;
    order.payment.failureDescription = result.reason;
    order.payment.failureReason = result.payment?.failureReason ?? result.reason;
    order.payment.method_ = result.payment?.method ?? null;
    order.payment.bank = result.payment?.bank ?? null;
    order.payment.cardLast4 = result.payment?.cardLast4 ?? null;
    order.payment.razorpayPaymentId = params.razorpayPaymentId;
    order.payment.razorpaySignatureProvided = params.razorpaySignature;
    order.payment.signatureVerified = false;
    await order.save();
    return {
      ok: false,
      error: result.reason,
      status: 400,
      order,
      // NOT_CAPTURED means the payment may still settle — the customer can poll.
      retryable: result.code === 'NOT_CAPTURED',
    };
  }

  await applySuccessfulPayment(order._id, result.payment, params.razorpaySignature);
  const fresh = await Order.findById(order._id).exec();
  return { ok: true, order: fresh ?? order, alreadyProcessed: false };
}

/**
 * Atomically transition an order to PAID and kick off fulfilment.
 *
 * The guard `payment.status: { $ne: 'PAID' }` inside the atomic update is what
 * makes concurrent duplicate callbacks safe — exactly one caller can win.
 */
export async function applySuccessfulPayment(
  orderMongoId: unknown,
  payment: RazorpayPaymentDetail,
  signature: string,
): Promise<{ applied: boolean; order: OrderDoc | null }> {
  await connectDb();

  const updated = await Order.findOneAndUpdate(
    { _id: orderMongoId, 'payment.status': { $ne: 'PAID' } },
    {
      $set: {
        'payment.status': 'PAID' as PaymentStatus,
        'payment.razorpayPaymentId': payment.id,
        'payment.razorpayOrderId': payment.orderId,
        'payment.razorpaySignature': signature,
        'payment.signatureVerified': true,
        'payment.verifiedAt': new Date(),
        'payment.processedAt': new Date(),
        'payment.method_': payment.method,
        'payment.bank': payment.bank,
        'payment.cardLast4': payment.cardLast4,
        'payment.failureCode': null,
        'payment.failureDescription': null,
        'payment.failureReason': null,
        status: 'PAID' as OrderStatus,
      },
      $push: {
        statusHistory: {
          status: 'PAID' as OrderStatus,
          at: new Date(),
          source: 'RAZORPAY' as const,
          note: 'Payment captured and verified',
        },
        'shipping.statusHistory': {
          status: 'PENDING' as const,
          at: new Date(),
          source: 'SYSTEM' as const,
          note: 'Payment confirmed — eligible for fulfilment',
        },
      },
    },
    { new: true },
  ).exec();

  if (!updated) {
    const existing = await Order.findById(orderMongoId).exec();
    return { applied: false, order: existing };
  }

  await onOrderConfirmed(updated._id, { isCod: false });
  const fresh = await Order.findById(orderMongoId).exec();
  return { applied: true, order: fresh ?? updated };
}

/** Record an explicit payment failure (checkout close / gateway error). */
export async function markPaymentFailed(params: {
  orderId: string;
  code: string;
  description: string;
  paymentId?: string | null;
}): Promise<OrderDoc | null> {
  await connectDb();
  const order = await Order.findOne({ orderId: params.orderId }).exec();
  if (!order) return null;
  if (order.payment.status === 'PAID') return order; // never downgrade a paid order

  order.payment.status = 'FAILED';
  order.payment.failureCode = params.code;
  order.payment.failureDescription = params.description;
  order.payment.failureReason = params.description;
  order.payment.razorpayPaymentId = params.paymentId ?? order.payment.razorpayPaymentId;
  order.payment.attemptedAt = new Date();
  await order.save();
  return order;
}

/* -------------------------------------------------------------------------- */
/* Fulfilment                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Called exactly once an order is confirmed (paid via Razorpay, or COD).
 * Kicks off the shipping workflow. Any Delhivery failure is persisted on the
 * order so the admin can retry — the order itself is never lost.
 */
export async function onOrderConfirmed(
  orderMongoId: unknown,
  _opts: { isCod: boolean },
): Promise<void> {
  await connectDb();

  if (!serverEnv.featureFlags.delhiveryAutoCreate || !isDelhiveryReady()) {
    // No courier configured: leave the order in a safe, admin-visible state.
    await Order.updateOne(
      { _id: orderMongoId },
      {
        $set: {
          'shipping.syncStatus': 'IDLE',
          'shipping.status': 'PENDING',
        },
        $push: {
          statusHistory: {
            status: 'PROCESSING' as OrderStatus,
            at: new Date(),
            source: 'SYSTEM' as const,
            note: 'Payment confirmed — awaiting shipment creation',
          },
        },
      },
    ).exec();
    return;
  }

  const order = await Order.findById(orderMongoId).exec();
  if (!order) return;

  if (order.shipping.waybill) return; // already shipped

  await Order.updateOne(
    { _id: orderMongoId },
    {
      $set: { status: 'PROCESSING' },
      $push: {
        statusHistory: {
          status: 'PROCESSING' as OrderStatus,
          at: new Date(),
          source: 'SYSTEM' as const,
          note: 'Payment confirmed — creating shipment',
        },
      },
    },
  ).exec();

  await syncShipment(orderMongoId);
}

/**
 * Create (or retry) the Delhivery shipment for an order.
 *
 * Returns a discriminated result rather than throwing, so every caller —
 * webhook, admin retry, order creation — can react without try/catch sprawl.
 */
export type ShipmentSyncResult =
  | { ok: true; waybill: string; alreadyExisted: boolean }
  | { ok: false; reason: string; code: string; retryable: boolean };

export async function syncShipment(orderMongoId: unknown): Promise<ShipmentSyncResult> {
  await connectDb();
  const order = await Order.findById(orderMongoId).exec();

  if (!order) return { ok: false, reason: 'Order not found.', code: 'NOT_FOUND', retryable: false };

  if (order.shipping.waybill) {
    return { ok: true, waybill: order.shipping.waybill, alreadyExisted: true };
  }

  // Never ship an unpaid order unless the business explicitly allows COD.
  if (order.payment.status !== 'PAID' && order.payment.method !== 'COD') {
    return {
      ok: false,
      reason: 'Order is not paid — shipment not created.',
      code: 'NOT_PAID',
      retryable: false,
    };
  }
  if (order.status === 'CANCELLED') {
    return { ok: false, reason: 'Order is cancelled.', code: 'CANCELLED', retryable: false };
  }

  if (!isDelhiveryReady()) {
    await persistSyncFailure(orderMongoId, 'Delhivery is not configured.', 'NOT_CONFIGURED', false);
    return {
      ok: false,
      reason: 'Delhivery is not configured.',
      code: 'NOT_CONFIGURED',
      retryable: false,
    };
  }

  const cfg = await getShippingConfig({ fresh: true });
  const settings = await getBusinessSettings();

  if (!cfg.pickupName || !cfg.pickupPincode || !cfg.pickupCity) {
    await persistSyncFailure(
      orderMongoId,
      'Pickup address is not configured. Set it in Admin → Shipping.',
      'ORIGIN_INCOMPLETE',
      false,
    );
    return {
      ok: false,
      reason: 'Pickup address is not configured.',
      code: 'ORIGIN_INCOMPLETE',
      retryable: false,
    };
  }

  // Mark in-flight so a double click does not create two shipments.
  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderMongoId,
      $or: [{ 'shipping.syncStatus': { $ne: 'CREATING' } }, { 'shipping.waybill': null }],
    },
    {
      $set: { 'shipping.syncStatus': 'PENDING', 'shipping.status': 'CREATING' },
      $inc: { 'shipping.syncAttempts': 1 },
    },
    { new: true },
  ).exec();

  if (!claimed) {
    const current = await Order.findById(orderMongoId).exec();
    return {
      ok: false,
      reason: 'A shipment for this order is already being created.',
      code: 'IN_PROGRESS',
      retryable: true,
    };
  }

  const from: DelhiveryAddress = {
    name: cfg.pickupName || settings.brandName,
    addressLine1: cfg.pickupAddressLine1,
    addressLine2: cfg.pickupAddressLine2,
    city: cfg.pickupCity,
    state: cfg.pickupState,
    pincode: cfg.pickupPincode,
    country: cfg.pickupCountry || 'India',
    phone: cfg.pickupContactPhone || settings.supportPhone,
    email: cfg.pickupEmail || settings.supportEmail,
  };

  const to: DelhiveryAddress = {
    name: order.shippingAddress.name,
    addressLine1: order.shippingAddress.line1,
    addressLine2: order.shippingAddress.line2,
    city: order.shippingAddress.city,
    state: order.shippingAddress.state,
    pincode: order.shippingAddress.pincode,
    country: order.shippingAddress.country || 'India',
    phone: order.shippingAddress.phone,
    email: order.shippingAddress.email ?? order.email ?? undefined,
  };

  try {
    const result = await createShipment({
      orderId: order.orderId,
      reference: order.reference,
      orderDate: order.createdAt ?? new Date(),
      from,
      to,
      codAmountPaise: order.payment.method === 'COD' ? order.totalPaise : 0,
      totalOrderValuePaise: order.totalPaise,
      pickupLocation: cfg.pickupName || null,
      items: order.items.map((i) => ({
        name: i.name,
        sku: i.sku,
        quantity: i.qty,
        declaredValuePaise: i.lineTotalPaise,
        weightGrams: undefined,
        category: 'GROCERIES' as const,
      })),
    });

    if (!result.waybill) {
      await persistSyncFailure(orderMongoId, 'Delhivery returned no waybill.', 'NO_WAYBILL', true);
      return {
        ok: false,
        reason: 'Delhivery returned no waybill.',
        code: 'NO_WAYBILL',
        retryable: true,
      };
    }

    await Order.updateOne(
      { _id: orderMongoId },
      {
        $set: {
          'shipping.waybill': result.waybill,
          'shipping.delhiveryShipmentId': result.shipmentId,
          'shipping.delhiveryOrderId': result.delhiveryOrderId,
          'shipping.delhiveryRefNo': result.refNo,
          'shipping.trackingUrl': buildTrackingUrl(result.waybill),
          'shipping.awbGenerated': result.awbGenerated,
          'shipping.pickupLocation': result.pickupLocation,
          'shipping.status': 'CREATED',
          'shipping.syncStatus': 'SUCCESS',
          'shipping.syncError': null,
          'shipping.lastSyncedAt': new Date(),
          'shipping.lastStatusAt': new Date(),
          'shipping.lastStatusText': 'Shipment created',
          status: 'SHIPPED' as OrderStatus,
        },
        $push: {
          statusHistory: {
            status: 'SHIPPED' as OrderStatus,
            at: new Date(),
            source: 'DELHIVERY' as const,
            note: `Waybill ${result.waybill} generated`,
          },
          'shipping.statusHistory': {
            status: 'CREATED' as const,
            at: new Date(),
            source: 'DELHIVERY' as const,
            note: `Waybill ${result.waybill}`,
          },
        },
      },
    ).exec();

    return { ok: true, waybill: result.waybill, alreadyExisted: false };
  } catch (err) {
    const isDelhiveryErr = err instanceof DelhiveryError;
    const reason = err instanceof Error ? err.message : 'Unknown shipping error';
    const code = isDelhiveryErr ? err.code : 'UNKNOWN';
    // Config/auth problems will not fix themselves on retry.
    const retryable = !['NOT_CONFIGURED', 'ORIGIN_INCOMPLETE'].includes(code);

    await persistSyncFailure(orderMongoId, reason, code, retryable);
    return { ok: false, reason, code, retryable };
  }
}

async function persistSyncFailure(
  orderMongoId: unknown,
  reason: string,
  code: string,
  retryable: boolean,
): Promise<void> {
  await connectDb();

  await Order.updateOne(
    { _id: orderMongoId },
    {
      $set: {
        'shipping.syncStatus': 'FAILED',
        'shipping.status': 'SYNC_FAILED',
        'shipping.syncError': `${code}: ${reason}`,
        'shipping.lastSyncedAt': new Date(),
      },
      $push: {
        statusHistory: {
          status: 'PROCESSING' as OrderStatus,
          at: new Date(),
          source: 'SYSTEM' as const,
          note: `Shipment creation failed (${code}) — retry available: ${reason}`,
        },
        'shipping.statusHistory': {
          status: 'SYNC_FAILED' as const,
          at: new Date(),
          source: 'SYSTEM' as const,
          note: `${code}: ${reason}`,
        },
      },
    },
  ).exec();
  void retryable;
}

/* -------------------------------------------------------------------------- */
/* Tracking                                                                   */
/* -------------------------------------------------------------------------- */

export interface TrackingSnapshot {
  waybill: string;
  status: string;
  delivered: boolean;
  lastScannedAt: string | null;
  trackingUrl: string;
  events: Array<{ status: string; description: string; location: string; scannedAt: string }>;
}

/** Live tracking from the courier, with the last-known status as fallback. */
export async function getLiveTracking(waybill: string): Promise<{
  ok: boolean;
  data: TrackingSnapshot | null;
  error: string | null;
}> {
  if (!isDelhiveryReady()) {
    return { ok: false, data: null, error: 'Live tracking is not available right now.' };
  }
  try {
    const res = await trackShipment(waybill);
    return {
      ok: true,
      error: null,
      data: {
        waybill: res.waybill,
        status: res.status,
        delivered: res.delivered,
        lastScannedAt: res.lastScannedAt,
        trackingUrl: res.trackingUrl,
        events: res.events.map((e) => ({
          status: e.status,
          description: e.statusDescription,
          location: e.location,
          scannedAt: e.scannedAt,
        })),
      },
    };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : 'Could not fetch tracking.',
    };
  }
}

/**
 * Pull the courier's current status and mirror it onto the order.
 * Used by the admin "Refresh tracking" action.
 */
export async function refreshOrderTracking(orderId: string): Promise<
  { ok: true; changed: boolean; order: OrderDoc } | { ok: false; error: string }
> {
  await connectDb();
  const order = await Order.findOne({ orderId }).exec();
  if (!order) return { ok: false, error: 'Order not found.' };
  if (!order.shipping.waybill) return { ok: false, error: 'No waybill has been generated yet.' };

  const res = await getLiveTracking(order.shipping.waybill);
  if (!res.ok || !res.data) return { ok: false, error: res.error ?? 'Tracking unavailable.' };

  const mapped = mapDelhiveryStatus(res.data.status);
  const changed = mapped !== null && mapped !== order.shipping.status;

  const set: Record<string, unknown> = {
    'shipping.lastStatusText': res.data.status,
    'shipping.lastSyncedAt': new Date(),
  };
  const push: Record<string, unknown> = {};

  if (mapped) {
    set['shipping.status'] = mapped;
    set['shipping.lastStatusAt'] = res.data.lastScannedAt
      ? new Date(res.data.lastScannedAt)
      : new Date();
  }
  if (res.data.delivered) {
    set['status'] = 'DELIVERED' as OrderStatus;
    set['deliveredAt'] = new Date();
    push.statusHistory = {
      status: 'DELIVERED' as OrderStatus,
      at: new Date(),
      source: 'DELHIVERY' as const,
      note: 'Delivered (confirmed by courier scan)',
    };
  } else if (mapped && ['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(mapped)) {
    set['status'] = mapped as OrderStatus;
    if (order.status === 'SHIPPED' || order.status === 'PROCESSING' || order.status === 'PAID') {
      push.statusHistory = {
        status: mapped as OrderStatus,
        at: new Date(),
        source: 'DELHIVERY' as const,
        note: res.data.status,
      };
    }
  }
  push['shipping.statusHistory'] = {
    status: (mapped ?? order.shipping.status) as never,
    at: new Date(),
    source: 'DELHIVERY' as const,
    note: res.data.status,
  };

  const updated = await Order.findOneAndUpdate(
    { _id: order._id },
    { $set: set, ...(Object.keys(push).length ? { $push: push } : {}) },
    { new: true },
  ).exec();

  return { ok: true, changed, order: updated ?? order };
}

/* -------------------------------------------------------------------------- */
/* Status transitions (admin)                                                 */
/* -------------------------------------------------------------------------- */

/** Convert a possibly-null ObjectId reference to a plain string id. */
function idOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'toString' in value) {
    return String((value as { toString(): string }).toString());
  }
  return String(value);
}

export type TransitionResult =
  | { ok: true; order: OrderDoc; releasedStock: boolean }
  | { ok: false; error: string; status: number };

/**
 * Admin-driven status change. Refuses to set DELIVERED without a verified
 * waybill — the spec's rule that an order is never auto-delivered.
 */
export async function updateOrderStatus(params: {
  orderId: string;
  next: OrderStatus;
  note?: string;
  adminEmail: string;
}): Promise<TransitionResult> {
  await connectDb();
  const order = await Order.findOne({ orderId: params.orderId }).exec();
  if (!order) return { ok: false, error: 'Order not found.', status: 404 };

  const prev = order.status;
  if (prev === params.next) return { ok: true, order, releasedStock: false };

  if (params.next === 'DELIVERED' && !order.shipping.waybill) {
    return {
      ok: false,
      status: 409,
      error: 'Cannot mark delivered: no Delhivery waybill exists for this order.',
    };
  }

  let releasedStock = false;

  // Cancelling / refunding puts stock back on the shelf.
  if (
    (params.next === 'CANCELLED' || params.next === 'REFUNDED') &&
    prev !== 'CANCELLED' &&
    prev !== 'REFUNDED' &&
    order.inventoryCommitted
  ) {
    await releaseInventory(
      order.items.map((i) => ({ variantId: idOf(i.variantId), qty: i.qty })),
    );
    order.inventoryCommitted = false;
    releasedStock = true;
  }

  if (params.next === 'CANCELLED') order.cancelledAt = new Date();
  if (params.next === 'REFUNDED') {
    order.payment.status = 'REFUNDED';
    order.payment.refundedAt = new Date();
  }
  if (params.next === 'DELIVERED') order.deliveredAt = new Date();

  if (params.next === 'SHIPPED' && !order.shipping.waybill) {
    return {
      ok: false,
      status: 409,
      error: 'Cannot mark shipped: no waybill has been generated. Sync with Delhivery first.',
    };
  }

  order.status = params.next;
  if (params.note) order.adminNote = params.note.slice(0, 1000);
  order.statusHistory.push({
    status: params.next,
    at: new Date(),
    source: 'ADMIN',
    note: params.note?.slice(0, 300) || `Updated by ${params.adminEmail}`,
  });

  // Keep shipping status in step for the customer-facing timeline.
  const shippingMap: Partial<Record<OrderStatus, OrderDoc['shipping']['status']>> = {
    SHIPPED: 'CREATED',
    IN_TRANSIT: 'IN_TRANSIT',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
  };
  const mappedShipping = shippingMap[params.next];
  if (mappedShipping) {
    order.shipping.status = mappedShipping;
    order.shipping.statusHistory.push({
      status: mappedShipping,
      at: new Date(),
      source: 'ADMIN',
      note: params.note?.slice(0, 300),
    });
  }

  await order.save();
  return { ok: true, order, releasedStock };
}

/** Customer-initiated cancellation, only inside the configured window. */
export async function customerCancelOrder(params: {
  orderId: string;
  emailOrPhone: string;
  reason: string;
}): Promise<{ ok: boolean; error?: string; order?: OrderDoc }> {
  await connectDb();
  const order = await Order.findOne({ orderId: params.orderId }).exec();
  if (!order) return { ok: false, error: 'Order not found.' };

  // Verification: the requester must supply a value we already hold.
  const match =
    order.email?.toLowerCase() === params.emailOrPhone.toLowerCase() ||
    order.phone === params.emailOrPhone;
  if (!match) return { ok: false, error: 'Order ID and contact details do not match.' };

  const { getShippingConfig } = await import('./models/ShippingConfiguration');
  const cfg = await getShippingConfig({ fresh: true });

  if (!cfg.allowCancellation) {
    return { ok: false, error: 'Self-service cancellation is not available.' };
  }
  if (order.status === 'CANCELLED') return { ok: false, error: 'This order is already cancelled.' };
  if (order.shipping.waybill) {
    return {
      ok: false,
      error: 'This order has already shipped. Please contact support to arrange a return.',
    };
  }
  if (order.payment.status === 'PAID') {
    return {
      ok: false,
      error: 'This order is paid and being prepared. Please contact support for assistance.',
    };
  }

  if (order.inventoryCommitted) {
    await releaseInventory(
      order.items.map((i) => ({ variantId: idOf(i.variantId), qty: i.qty })),
    );
    order.inventoryCommitted = false;
  }

  order.status = 'CANCELLED';
  order.cancelledAt = new Date();
  order.cancelReason = params.reason.slice(0, 500);
  order.shipping.status = 'CANCELLED';
  order.statusHistory.push({
    status: 'CANCELLED',
    at: new Date(),
    source: 'CUSTOMER',
    note: params.reason.slice(0, 300),
  });
  await order.save();

  return { ok: true, order };
}

export { publicEnv };
