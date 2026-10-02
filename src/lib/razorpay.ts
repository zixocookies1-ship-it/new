import 'server-only';

import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { serverEnv, integrationState, publicEnv } from './env';

/**
 * Razorpay integration.
 *
 * Payment safety model:
 *  1. Order is created server-side for an amount WE computed from MongoDB.
 *  2. On return from checkout the client posts back three fields; we verify
 *     the HMAC-SHA256 signature server-side.
 *  3. We ALSO fetch the payment from Razorpay's API and assert
 *     status === 'captured' AND amount === our order amount. A client that
 *     forges a valid-looking signature, or replays another order's payment,
 *     fails both checks.
 *  4. Webhooks are verified with a separate secret over the RAW body and are
 *     idempotent by event id.
 */

let client: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!integrationState('razorpay') || !serverEnv.razorpay.keyId || !serverEnv.razorpay.keySecret) {
    throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  if (!client) {
    client = new Razorpay({
      key_id: serverEnv.razorpay.keyId,
      key_secret: serverEnv.razorpay.keySecret,
    });
  }
  return client;
}

export function isRazorpayReady(): boolean {
  return integrationState('razorpay') === 'configured';
}

/** Public key safe to hand to the browser. */
export function getRazorpayKeyId(): string {
  return publicEnv.razorpayKeyId;
}

export interface CreatedRazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

/**
 * The Razorpay SDK's `.create()`/`.fetch()` overloads resolve to
 * `Promise<T> & void`, which makes property access fail type-checking. These
 * narrow views give us a stable, honest surface over the raw response.
 */
interface RawRazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  amount_paid?: number;
  attempts?: number;
}

interface RawRazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  method?: string | null;
  bank?: string | null;
  captured?: boolean;
  error_code?: string | null;
  error_description?: string | null;
  notes?: Record<string, string>;
}

interface RawRazorpayRefund {
  id: string;
  status: string;
}

export async function createRazorpayOrder(params: {
  /** Integer paise. Must match the order total we persisted. */
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<CreatedRazorpayOrder> {
  const rz = getRazorpay();

  const created = (await rz.orders.create({
    amount: Math.round(params.amountPaise),
    currency: 'INR',
    receipt: params.receipt,
    notes: params.notes ?? {},
    payment_capture: true,
  })) as unknown as RawRazorpayOrder;

  return {
    id: created.id,
    amount: created.amount,
    currency: created.currency,
    receipt: created.receipt,
    status: created.status,
  };
}

export interface RazorpayPaymentDetail {
  id: string;
  orderId: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  amount: number;
  currency: string;
  method: string | null;
  bank: string | null;
  cardLast4: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  failureReason: string | null;
  captured: boolean;
}

export async function fetchPayment(paymentId: string): Promise<RazorpayPaymentDetail> {
  const rz = getRazorpay();
  const raw = (await rz.payments.fetch(paymentId)) as unknown as RawRazorpayPayment;

  const vvs = raw.notes ?? {};
  const method = raw.method ?? null;
  const card = method === 'card' ? (vvs.card_last4 ?? null) : null;

  return {
    id: raw.id,
    orderId: raw.order_id,
    status: raw.status as RazorpayPaymentDetail['status'],
    amount: raw.amount,
    currency: raw.currency,
    method,
    bank: raw.bank ?? null,
    cardLast4: card,
    errorCode: raw.error_code ?? null,
    errorDescription: raw.error_description ?? null,
    failureReason: raw.error_description ?? raw.error_code ?? null,
    captured: Boolean(raw.captured),
  };
}

export interface FetchedRazorpayOrder {
  id: string;
  amount: number;
  amountPaid: number;
  currency: string;
  status: 'created' | 'attempted' | 'paid';
  receipt: string;
  attempts: number;
}

export async function fetchRazorpayOrder(orderId: string): Promise<FetchedRazorpayOrder> {
  const rz = getRazorpay();
  const o = (await rz.orders.fetch(orderId)) as unknown as RawRazorpayOrder;
  return {
    id: o.id,
    amount: o.amount,
    amountPaid: o.amount_paid ?? 0,
    currency: o.currency,
    status: o.status as FetchedRazorpayOrder['status'],
    receipt: o.receipt,
    attempts: o.attempts ?? 0,
  };
}

/** Constant-time compare so a signature check cannot be timed. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret) */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  if (!serverEnv.razorpay.keySecret) return false;
  if (!params.razorpayOrderId || !params.razorpayPaymentId || !params.signature) return false;

  const expected = crypto
    .createHmac('sha256', serverEnv.razorpay.keySecret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest('hex');

  return safeEqual(expected, params.signature.toLowerCase());
}

/** HMAC-SHA256(rawBody + "|" + webhook_secret) */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!serverEnv.razorpay.webhookSecret) return false;
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', serverEnv.razorpay.webhookSecret)
    .update(`${rawBody}|${serverEnv.razorpay.webhookSecret}`)
    .digest('hex');

  return safeEqual(expected, signature.toLowerCase());
}

/**
 * Full trust decision for a payment callback.
 * Returns `ok: false` with a reason the caller can persist + surface.
 */
export async function confirmPayment(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
  /** Amount (paise) we expect this order to have been created for. */
  expectedAmountPaise: number;
}): Promise<
  | { ok: true; payment: RazorpayPaymentDetail }
  | { ok: false; reason: string; code: string; payment?: RazorpayPaymentDetail }
> {
  // 1. Signature — proves the callback came from Razorpay.
  if (!verifyPaymentSignature(params)) {
    return { ok: false, code: 'INVALID_SIGNATURE', reason: 'Payment signature verification failed.' };
  }

  // 2. Server-side lookup — proves the payment exists, is captured, and that
  //    the amount matches what we charged. This is what stops replay attacks.
  let payment: RazorpayPaymentDetail;
  try {
    payment = await fetchPayment(params.razorpayPaymentId);
  } catch {
    return { ok: false, code: 'PAYMENT_LOOKUP_FAILED', reason: 'Could not verify payment with Razorpay.' };
  }

  if (payment.orderId !== params.razorpayOrderId) {
    return {
      ok: false,
      code: 'ORDER_MISMATCH',
      reason: 'Payment does not belong to this order.',
      payment,
    };
  }

  if (payment.status === 'failed') {
    return {
      ok: false,
      code: 'PAYMENT_FAILED',
      reason: payment.failureReason || 'Payment failed.',
      payment,
    };
  }

  if (payment.status !== 'captured' || !payment.captured) {
    return {
      ok: false,
      code: 'NOT_CAPTURED',
      reason: 'Payment has not been captured yet.',
      payment,
    };
  }

  if (payment.amount !== params.expectedAmountPaise) {
    return {
      ok: false,
      code: 'AMOUNT_MISMATCH',
      reason: 'Payment amount does not match the order total.',
      payment,
    };
  }

  if (payment.currency !== 'INR') {
    return { ok: false, code: 'CURRENCY_MISMATCH', reason: 'Unexpected currency.', payment };
  }

  return { ok: true, payment };
}

/** Refund a captured payment (admin-initiated). */
export async function refundPayment(params: {
  paymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
  idempotencyKey?: string;
}): Promise<{ refundId: string; status: string }> {
  const rz = getRazorpay();
  const res = (await rz.payments.refund(params.paymentId, {
    amount: Math.round(params.amountPaise),
    notes: params.notes ?? {},
  })) as unknown as RawRazorpayRefund;
  return { refundId: res.id, status: res.status };
}
