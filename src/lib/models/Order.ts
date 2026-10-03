import { Schema, model, models, type Model } from 'mongoose';
import {
  ORDER_STATUS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  SERVICEABILITY,
  SHIPPING_STATUS,
  SYNC_STATUS,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type Serviceability,
  type ShippingStatus,
  type SyncStatus,
} from '../types';

/* -------------------------------------------------------------------------- */
/* Line items — price snapshot                                                 */
/*                                                                            */
/* Product/variant names and prices are COPIED onto the order at creation.    */
/* If an admin later edits the catalogue, historic invoices and GST records    */
/* must not change underneath the customer.                                     */
/* -------------------------------------------------------------------------- */

export interface OrderItemDoc {
  productId: Schema.Types.ObjectId | null;
  variantId: Schema.Types.ObjectId | null;
  /** Immutable snapshot */
  name: string;
  slug: string;
  flavour: string;
  sku: string;
  weightLabel: string;
  imageUrl: string | null;
  /** Paise */
  unitPricePaise: number;
  mrpPaise: number | null;
  qty: number;
  lineTotalPaise: number;
  /** Set when the line was bought as part of a bundle. */
  bundleId: Schema.Types.ObjectId | null;
  bundleName: string | null;
}

const OrderItemSchema = new Schema<OrderItemDoc>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', default: null },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    flavour: { type: String, default: '' },
    sku: { type: String, default: '' },
    weightLabel: { type: String, default: '' },
    imageUrl: { type: String, default: null },
    unitPricePaise: { type: Number, required: true, min: 0 },
    mrpPaise: { type: Number, default: null },
    qty: { type: Number, required: true, min: 1, max: 20 },
    lineTotalPaise: { type: Number, required: true, min: 0 },
    bundleId: { type: Schema.Types.ObjectId, ref: 'Bundle', default: null },
    bundleName: { type: String, default: null },
  },
  { _id: false },
);

/* -------------------------------------------------------------------------- */
/* Address                                                                    */
/* -------------------------------------------------------------------------- */

export interface AddressDoc {
  name: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  /** Normalised Delhivery service pin (first 6 digits of pincode). */
  servicePincode: string;
  serviceability: Serviceability;
  alternatePhone?: string;
}

const AddressSchema = new Schema<AddressDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    line1: { type: String, required: true, trim: true, maxlength: 240 },
    line2: { type: String, trim: true, maxlength: 240 },
    landmark: { type: String, trim: true, maxlength: 160 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    pincode: { type: String, required: true, trim: true, maxlength: 10 },
    country: { type: String, default: 'India', trim: true, maxlength: 60 },
    servicePincode: { type: String, trim: true, maxlength: 6 },
    serviceability: { type: String, enum: SERVICEABILITY, default: 'UNKNOWN' },
    alternatePhone: { type: String, trim: true, maxlength: 20 },
  },
  { _id: false },
);

/* -------------------------------------------------------------------------- */
/* Payment                                                                    */
/* -------------------------------------------------------------------------- */

export interface PaymentDoc {
  method: PaymentMethod;
  status: PaymentStatus;
  /** Paise */
  amount: number;
  currency: 'INR';
  gateway: 'RAZORPAY' | 'COD' | 'NONE';

  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  razorpaySignatureProvided: string | null;
  /** True only after server-side HMAC verification succeeded. */
  signatureVerified: boolean;
  verifiedAt: Date | null;

  method_: string | null;
  bank?: string | null;
  cardLast4?: string | null;
  failureCode: string | null;
  failureDescription: string | null;
  failureReason: string | null;
  attemptedAt: Date | null;

  refundId: string | null;
  refundedAt: Date | null;
  refundAmount: number | null;

  /** Idempotency guards for webhook + client verify races. */
  processedAt: Date | null;
  webhookEvents: string[];

  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<PaymentDoc>(
  {
    method: { type: String, enum: PAYMENT_METHODS, default: 'RAZORPAY' },
    status: { type: String, enum: PAYMENT_STATUS, default: 'PENDING', index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    gateway: { type: String, enum: ['RAZORPAY', 'COD', 'NONE'], default: 'RAZORPAY' },

    razorpayOrderId: { type: String, default: null, index: true, sparse: true },
    razorpayPaymentId: { type: String, default: null, index: true, sparse: true },
    razorpaySignature: { type: String, default: null },
    razorpaySignatureProvided: { type: String, default: null },
    signatureVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },

    method_: { type: String, default: null },
    bank: { type: String, default: null },
    cardLast4: { type: String, default: null },
    failureCode: { type: String, default: null },
    failureDescription: { type: String, default: null },
    failureReason: { type: String, default: null },
    attemptedAt: { type: Date, default: null },

    refundId: { type: String, default: null },
    refundedAt: { type: Date, default: null },
    refundAmount: { type: Number, default: null },

    processedAt: { type: Date, default: null },
    webhookEvents: { type: [String], default: [] },

    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

/* -------------------------------------------------------------------------- */
/* Shipping                                                                   */
/* -------------------------------------------------------------------------- */

export interface ShippingDoc {
  status: ShippingStatus;
  carrier: 'DELHIVERY' | 'NONE';
  syncStatus: SyncStatus;

  waybill: string | null;
  delhiveryOrderId: string | null;
  delhiveryShipmentId: string | null;
  delhiveryRefNo: string | null;
  trackingUrl: string | null;
  awbGenerated: boolean;
  pickupLocation: string | null;

  lastSyncedAt: Date | null;
  lastStatusAt: Date | null;
  /** Populated when syncStatus === FAILED so admin can see + retry. */
  syncError: string | null;
  syncAttempts: number;

  estimatedDeliveryDays: number | null;
  courierCharges: number | null;
  codAmount: number | null;

  /** Raw last-known status text from Delhivery, for the timeline. */
  lastStatusText: string | null;
  statusHistory: Array<{
    status: ShippingStatus;
    at: Date;
    source: 'DELHIVERY' | 'ADMIN' | 'SYSTEM' | 'WEBHOOK';
    note?: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const ShippingHistorySchema = new Schema<ShippingDoc['statusHistory'][number]>(
  {
    status: { type: String, enum: SHIPPING_STATUS, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    source: {
      type: String,
      enum: ['DELHIVERY', 'ADMIN', 'SYSTEM', 'WEBHOOK'],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const ShippingSchema = new Schema<ShippingDoc>(
  {
    status: { type: String, enum: SHIPPING_STATUS, default: 'PENDING', index: true },
    carrier: { type: String, enum: ['DELHIVERY', 'NONE'], default: 'DELHIVERY' },
    syncStatus: { type: String, enum: SYNC_STATUS, default: 'IDLE', index: true },

    // Indexed once, as `OrderSchema.index({ 'shipping.waybill': 1 })` below.
    waybill: { type: String, default: null },
    delhiveryOrderId: { type: String, default: null },
    delhiveryShipmentId: { type: String, default: null },
    delhiveryRefNo: { type: String, default: null },
    trackingUrl: { type: String, default: null },
    awbGenerated: { type: Boolean, default: false },
    pickupLocation: { type: String, default: null },

    lastSyncedAt: { type: Date, default: null },
    lastStatusAt: { type: Date, default: null },
    syncError: { type: String, default: null },
    syncAttempts: { type: Number, default: 0 },

    estimatedDeliveryDays: { type: Number, default: null },
    courierCharges: { type: Number, default: null },
    codAmount: { type: Number, default: null },

    lastStatusText: { type: String, default: null },
    statusHistory: { type: [ShippingHistorySchema], default: [] },
  },
  { timestamps: true },
);

/* -------------------------------------------------------------------------- */
/* Timeline                                                                   */
/* -------------------------------------------------------------------------- */

export interface TimelineEvent {
  status: OrderStatus;
  at: Date;
  source: 'CUSTOMER' | 'ADMIN' | 'RAZORPAY' | 'DELHIVERY' | 'SYSTEM' | 'WEBHOOK';
  note?: string;
}

const TimelineSchema = new Schema<TimelineEvent>(
  {
    status: { type: String, enum: ORDER_STATUS, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    source: {
      type: String,
      enum: ['CUSTOMER', 'ADMIN', 'RAZORPAY', 'DELHIVERY', 'SYSTEM', 'WEBHOOK'],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

/* -------------------------------------------------------------------------- */
/* Order                                                                      */
/* -------------------------------------------------------------------------- */

export interface OrderDoc {
  _id: any;
  /** Human-facing, non-sequential, hard-to-guess order number. */
  orderId: string;
  /** Internal sequential reference for support conversations. */
  reference: string;

  email: string | null;
  phone: string;
  /** Optional — customers are never forced to create an account. */
  userId: Schema.Types.ObjectId | null;

  items: OrderItemDoc[];

  /** Paise */
  subtotalPaise: number;
  mrpTotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  shippingChargedPaise: number;
  taxPaise: number;
  totalPaise: number;
  amountRefundedPaise: number;
  /** Free-shipping threshold progress snapshot at order time. */
  freeShippingApplied: boolean;
  freeShippingThresholdPaise: number | null;

  couponCode: string | null;
  couponId: Schema.Types.ObjectId | null;
  couponDiscountPaise: number | null;

  bundleId: Schema.Types.ObjectId | null;

  address: AddressDoc;
  shippingAddress: AddressDoc;

  payment: PaymentDoc;
  shipping: ShippingDoc;

  status: OrderStatus;
  statusHistory: TimelineEvent[];

  customerNote: string;
  adminNote: string;

  /**
   * Idempotency key minted by the checkout client. A unique sparse index means
   * a double-tap / double-submit / network retry can never create two orders.
   */
  clientCheckoutToken: string | null;

  /** Soft stock reservation bookkeeping. */
  inventoryCommitted: boolean;

  cancelledAt: Date | null;
  cancelReason: string | null;
  deliveredAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<OrderDoc>(
  {
    orderId: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    reference: { type: String, required: true, unique: true, index: true },

    email: { type: String, default: null, lowercase: true, trim: true, index: true, sparse: true },
    phone: { type: String, required: true, trim: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true, sparse: true },

    items: { type: [OrderItemSchema], required: true },

    subtotalPaise: { type: Number, required: true, min: 0 },
    mrpTotalPaise: { type: Number, default: 0, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    shippingPaise: { type: Number, default: 0, min: 0 },
    shippingChargedPaise: { type: Number, default: 0, min: 0 },
    taxPaise: { type: Number, default: 0, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    amountRefundedPaise: { type: Number, default: 0, min: 0 },
    freeShippingApplied: { type: Boolean, default: false },
    freeShippingThresholdPaise: { type: Number, default: null },

    couponCode: { type: String, default: null, uppercase: true, trim: true, index: true, sparse: true },
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', default: null },
    couponDiscountPaise: { type: Number, default: null },

    bundleId: { type: Schema.Types.ObjectId, ref: 'Bundle', default: null, index: true, sparse: true },

    address: { type: AddressSchema, required: true },
    shippingAddress: { type: AddressSchema, required: true },

    payment: { type: PaymentSchema, required: true },
    shipping: { type: ShippingSchema, required: true },

    status: { type: String, enum: ORDER_STATUS, default: 'ORDER_PLACED', index: true },
    statusHistory: { type: [TimelineSchema], default: [] },

    customerNote: { type: String, default: '', maxlength: 1000 },
    adminNote: { type: String, default: '', maxlength: 1000 },

    clientCheckoutToken: { type: String, default: null },

    inventoryCommitted: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null, maxlength: 500 },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'orders' },
);

/* --- Indexes (spec §30) ---------------------------------------------------- */

// Admin list: newest first, filterable by status
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'payment.status': 1, createdAt: -1 });
OrderSchema.index({ 'shipping.status': 1, createdAt: -1 });
OrderSchema.index({ 'shipping.syncStatus': 1, createdAt: -1 });
OrderSchema.index({ 'shipping.waybill': 1 }, { sparse: true });
OrderSchema.index({ 'address.pincode': 1 });
OrderSchema.index({ 'shippingAddress.pincode': 1 });
// Admin search across order id / phone / email
OrderSchema.index({ phone: 1, createdAt: -1 });
OrderSchema.index({ orderId: 'text', phone: 'text', email: 'text' });
// Idempotency: a given client checkout attempt can only create one order
OrderSchema.index({ clientCheckoutToken: 1 }, { unique: true, sparse: true });
// Retry queue
OrderSchema.index({ 'shipping.syncStatus': 1, status: 1 });

OrderSchema.set('toJSON', { virtuals: true });

export const Order = (models.Order as Model<OrderDoc>) || model<OrderDoc>('Order', OrderSchema);
