import { Schema, model, models, type Model, type Types } from 'mongoose';
import { connectDb } from '../db';

export const COUPON_TYPES = ['PERCENTAGE', 'FIXED'] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export interface CouponDoc {
  _id: Types.ObjectId;
  code: string;
  description: string;

  type: CouponType;
  /** PERCENTAGE: 1–100. FIXED: paise. */
  value: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  /** Caps the total discount so a coupon can never exceed the order value. */
  maxDiscountPercentCap: number | null;

  startsAt: Date | null;
  expiresAt: Date | null;

  usageLimit: number | null;
  perUserLimit: number | null;
  usageCount: number;

  /** Restrict to specific products (empty = all). */
  applicableProductIds: Types.ObjectId[];

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<CouponDoc>(
  {
    code: {
      type: String,
      required: true,
      // Uniqueness is declared once, in CouponSchema.index() below.
      uppercase: true,
      trim: true,
      maxlength: 40,
    },
    description: { type: String, default: '', trim: true, maxlength: 300 },

    type: { type: String, enum: COUPON_TYPES, required: true },
    value: { type: Number, required: true, min: 0 },
    maxDiscountPaise: { type: Number, default: null, min: 0 },
    minOrderPaise: { type: Number, default: 0, min: 0 },
    maxDiscountPercentCap: { type: Number, default: null, min: 0, max: 100 },

    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },

    usageLimit: { type: Number, default: null, min: 1 },
    perUserLimit: { type: Number, default: null, min: 1 },
    usageCount: { type: Number, default: 0, min: 0 },

    applicableProductIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
      default: [],
    },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: 'coupons' },
);

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ isActive: 1, expiresAt: 1 });

export const Coupon = (models.Coupon as Model<CouponDoc>) || model<CouponDoc>('Coupon', CouponSchema);

export type CouponValidationCode =
  | 'VALID'
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'USAGE_LIMIT_REACHED'
  | 'PER_USER_LIMIT_REACHED'
  | 'MIN_ORDER_NOT_MET'
  | 'NO_APPLICABLE_PRODUCTS'
  | 'ALREADY_APPLIED';

export interface CouponValidationResult {
  valid: boolean;
  code: CouponValidationCode;
  message: string;
  discountPaise: number;
  coupon?: CouponDoc | null;
}

/**
 * Server-authoritative coupon evaluation.
 *
 * Every branch returns the *paise* discount this server computed. The client
 * never supplies a discount amount, so a tampered cart cannot lower the total.
 */
export async function validateCoupon(params: {
  code: string;
  /** Subtotal of eligible lines only, in paise. */
  eligibleSubtotalPaise: number;
  /** Whole-cart subtotal, used for the minimum-order check. */
  cartSubtotalPaise: number;
  lineProductIds: string[];
  userId?: string | null;
  alreadyAppliedCodes?: string[];
}): Promise<CouponValidationResult> {
  await connectDb();

  const fail = (code: CouponValidationCode, message: string): CouponValidationResult => ({
    valid: false,
    code,
    message,
    discountPaise: 0,
    coupon: null,
  });

  const raw = params.code?.trim();
  if (!raw) return fail('NOT_FOUND', 'Enter a coupon code.');
  const code = raw.toUpperCase();

  if (params.alreadyAppliedCodes?.includes(code)) {
    return fail('ALREADY_APPLIED', 'That coupon is already applied.');
  }

  const coupon = await Coupon.findOne({ code }).exec();
  if (!coupon) return fail('NOT_FOUND', 'That coupon code is not valid.');
  if (!coupon.isActive) return fail('INACTIVE', 'That coupon is no longer active.');

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return fail('NOT_STARTED', 'That coupon is not active yet.');
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return fail('EXPIRED', 'That coupon has expired.');
  }
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return fail('USAGE_LIMIT_REACHED', 'That coupon has reached its usage limit.');
  }

  if (coupon.minOrderPaise > 0 && params.cartSubtotalPaise < coupon.minOrderPaise) {
    return fail(
      'MIN_ORDER_NOT_MET',
      `This coupon needs a minimum order of ₹${Math.round(coupon.minOrderPaise / 100)}.`,
    );
  }

  // Product scoping: at least one cart line must be eligible.
  if (coupon.applicableProductIds.length > 0) {
    const allowed = new Set(coupon.applicableProductIds.map(String));
    const hasEligible = params.lineProductIds.some((id) => allowed.has(id));
    if (!hasEligible) {
      return fail('NO_APPLICABLE_PRODUCTS', 'This coupon does not apply to the items in your cart.');
    }
  }

  if (params.eligibleSubtotalPaise <= 0) {
    return fail('NO_APPLICABLE_PRODUCTS', 'No eligible items in your cart for this coupon.');
  }

  if (coupon.perUserLimit !== null && params.userId) {
    const { Order } = await import('./Order');
    const used = await Order.countDocuments({
      userId: params.userId,
      couponCode: code,
      'payment.status': { $in: ['PAID', 'REFUNDED'] },
    });
    if (used >= coupon.perUserLimit) {
      return fail('PER_USER_LIMIT_REACHED', 'You have already used this coupon.');
    }
  }

  // --- compute discount -----------------------------------------------------
  let discount: number;
  if (coupon.type === 'PERCENTAGE') {
    const pct = Math.min(Math.max(coupon.value, 0), 100);
    discount = Math.floor((params.eligibleSubtotalPaise * pct) / 100);
    if (coupon.maxDiscountPaise !== null) discount = Math.min(discount, coupon.maxDiscountPaise);
    if (coupon.maxDiscountPercentCap !== null) {
      discount = Math.min(
        discount,
        Math.floor((params.eligibleSubtotalPaise * coupon.maxDiscountPercentCap) / 100),
      );
    }
  } else {
    discount = coupon.value;
  }

  // A coupon can never make the payable amount negative or exceed the
  // eligible subtotal. Clamp, then round to a positive amount.
  discount = Math.max(0, Math.min(discount, params.eligibleSubtotalPaise));
  discount = Math.round(discount);
  if (discount <= 0) {
    return fail('NO_APPLICABLE_PRODUCTS', 'This coupon gives no discount on your current cart.');
  }

  return { valid: true, code: 'VALID', message: 'Coupon applied.', discountPaise: discount, coupon };
}
