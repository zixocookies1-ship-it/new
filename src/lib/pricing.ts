import 'server-only';

import { connectDb } from './db';
import { Product } from './models/Product';
import { ProductVariant } from './models/ProductVariant';
import { Bundle, computeBundleSavings } from './models/Bundle';
import { getShippingConfig, type ShippingConfigurationDoc } from './models/ShippingConfiguration';
import { validateCoupon, type CouponValidationResult } from './models/Coupon';
import { Coupon } from './models/Coupon';
import { primaryMedia } from './models/media';

/**
 * The single authority on what an order costs.
 *
 * The client sends only identifiers + quantities. Every rupee in the returned
 * breakdown is derived from MongoDB here. Nothing the browser sends (price,
 * mrp, discount, shipping, total, payment status) is ever trusted.
 */

export interface RequestedLine {
  productId: string;
  variantId: string;
  qty: number;
}

export interface RequestedBundleLine {
  bundleId: string;
  qty: number;
}

export interface PricedLine {
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  flavour: string;
  sku: string;
  weightLabel: string;
  weightGrams: number | null;
  imageUrl: string | null;
  unitPricePaise: number;
  mrpPaise: number | null;
  qty: number;
  lineTotalPaise: number;
  bundleId: string | null;
  bundleName: string | null;
}

export interface PricingIssue {
  code:
    | 'PRODUCT_UNAVAILABLE'
    | 'VARIANT_UNAVAILABLE'
    | 'OUT_OF_STOCK'
    | 'PRICE_UNSET'
    | 'PRODUCT_INACTIVE'
    | 'BUNDLE_UNAVAILABLE'
    | 'CARTS_EMPTY';
  message: string;
  productId?: string;
  variantId?: string;
  requestedQty?: number;
  availableQty?: number;
}

export interface PricingResult {
  ok: boolean;
  lines: PricedLine[];
  issues: PricingIssue[];

  /** Paise */
  subtotalPaise: number;
  mrpTotalPaise: number;
  productDiscountPaise: number;
  couponDiscountPaise: number;
  discountPaise: number;
  shippingPaise: number;
  shippingWaivedPaise: number;
  codHandlingPaise: number;
  taxPaise: number;
  totalPaise: number;

  coupon: CouponValidationResult | null;
  freeShippingThresholdPaise: number | null;
  /** Paise still needed to unlock free shipping (0 when already unlocked). */
  freeShippingShortfallPaise: number;
  freeShippingUnlocked: boolean;
  totalWeightGrams: number;
  codAvailable: boolean;
  codBlockedReason: string | null;
  shippingConfigured: boolean;
  /** Sourced from the courier only — never a fabricated date. */
  estimatedDeliveryDays: number | null;
}

const MAX_QTY_PER_LINE = 20;

function emptyResult(): PricingResult {
  return {
    ok: false,
    lines: [],
    issues: [],
    subtotalPaise: 0,
    mrpTotalPaise: 0,
    productDiscountPaise: 0,
    couponDiscountPaise: 0,
    discountPaise: 0,
    shippingPaise: 0,
    shippingWaivedPaise: 0,
    codHandlingPaise: 0,
    taxPaise: 0,
    totalPaise: 0,
    coupon: null,
    freeShippingThresholdPaise: null,
    freeShippingShortfallPaise: 0,
    freeShippingUnlocked: false,
    totalWeightGrams: 0,
    codAvailable: false,
    codBlockedReason: null,
    shippingConfigured: false,
    estimatedDeliveryDays: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Shipping charge computation                                                 */
/* -------------------------------------------------------------------------- */

function computeShipping(params: {
  cfg: ShippingConfigurationDoc;
  subtotalPaise: number;
  totalWeightGrams: number;
  isCod: boolean;
}): { shippingPaise: number; waivedPaise: number; handlingPaise: number } {
  const { cfg, subtotalPaise, totalWeightGrams, isCod } = params;

  if (!cfg.shippingEnabled) {
    return { shippingPaise: 0, waivedPaise: 0, handlingPaise: 0 };
  }

  let charge = 0;

  if (cfg.weightBasedShipping && cfg.weightRatePaisePerKg > 0) {
    // Ceil to whole kilograms so a 1.2kg parcel is billed as 2kg.
    const kg = Math.ceil(totalWeightGrams / 1000);
    charge = kg * cfg.weightRatePaisePerKg;
  } else {
    charge = cfg.flatShippingPaise;
  }

  charge += cfg.handlingPaise;

  if (isCod) charge += cfg.codHandlingPaise;

  // Free-shipping threshold — only when the business actually configured one.
  let waived = 0;
  if (
    cfg.freeShippingEnabled &&
    cfg.freeShippingThresholdPaise !== null &&
    subtotalPaise >= cfg.freeShippingThresholdPaise
  ) {
    waived = charge;
    charge = 0;
  }

  return { shippingPaise: Math.max(0, Math.round(charge)), waivedPaise: waived, handlingPaise: 0 };
}

/* -------------------------------------------------------------------------- */
/* Main pricing entry point                                                   */
/* -------------------------------------------------------------------------- */

export interface PriceCartInput {
  lines?: RequestedLine[];
  bundles?: RequestedBundleLine[];
  couponCode?: string | null;
  paymentMethod?: 'RAZORPAY' | 'COD';
  /** Only used to look up pincode weight/charge context; never trusted. */
  pincode?: string | null;
  userId?: string | null;
}

export async function priceCart(input: PriceCartInput): Promise<PricingResult> {
  const result = emptyResult();

  await connectDb();

  const cfg = await getShippingConfig();
  result.shippingConfigured = cfg.shippingEnabled;
  result.freeShippingThresholdPaise = cfg.freeShippingEnabled
    ? cfg.freeShippingThresholdPaise
    : null;

  const requestedLines = (input.lines ?? []).filter(
    (l) => l && l.productId && l.variantId && Number.isFinite(l.qty) && l.qty > 0,
  );
  const requestedBundles = (input.bundles ?? []).filter(
    (b) => b && b.bundleId && Number.isFinite(b.qty) && b.qty > 0,
  );

  if (requestedLines.length === 0 && requestedBundles.length === 0) {
    result.issues.push({ code: 'CARTS_EMPTY', message: 'Your cart is empty.' });
    return result;
  }

  // ---------------------------------------------------------------- bundles
  if (requestedBundles.length > 0) {
    const bundleDocs = await Bundle.find({
      _id: { $in: requestedBundles.map((b) => b.bundleId) },
      isActive: true,
    })
      .lean()
      .exec();

    for (const req of requestedBundles) {
      const bundle = bundleDocs.find((b) => String(b._id) === req.bundleId);
      if (!bundle) {
        result.issues.push({
          code: 'BUNDLE_UNAVAILABLE',
          message: 'That bundle is no longer available.',
          productId: req.bundleId,
        });
        continue;
      }

      const qty = Math.min(Math.max(Math.floor(req.qty), 1), MAX_QTY_PER_LINE);

      const productDocs = await Product.find({
        _id: { $in: bundle.lines.map((l) => l.productId) },
        isActive: true,
      })
        .lean()
        .exec();
      const bundleVariantIds = bundle.lines
        .map((l) => (l.variantId ? String(l.variantId) : null))
        .filter((v): v is string => Boolean(v));

      const variantDocs = bundleVariantIds.length
        ? await ProductVariant.find({ _id: { $in: bundleVariantIds }, isActive: true })
            .lean()
            .exec()
        : [];

      // Verify every bundle member is purchasable before we price it.
      let bundleBroken = false;
      for (const bl of bundle.lines) {
        const product = productDocs.find((p) => String(p._id) === String(bl.productId));
        if (!product) {
          bundleBroken = true;
          result.issues.push({
            code: 'PRODUCT_UNAVAILABLE',
            message: `${bundle.name} is temporarily unavailable.`,
            productId: String(bl.productId),
          });
          continue;
        }
        const variant = bl.variantId
          ? variantDocs.find((v) => String(v._id) === String(bl.variantId))
          : (await ProductVariant.findOne({ productId: bl.productId, isActive: true })
              .sort({ sortOrder: 1 })
              .lean()
              .exec());
        if (!variant) {
          bundleBroken = true;
          result.issues.push({
            code: 'VARIANT_UNAVAILABLE',
            message: `${product.name} has no available pack size right now.`,
            productId: String(bl.productId),
          });
          continue;
        }
        if (variant.inventory < bl.qty * qty) {
          bundleBroken = true;
          result.issues.push({
            code: 'OUT_OF_STOCK',
            message: `${product.name} (${variant.weightLabel}) is out of stock.`,
            productId: String(bl.productId),
            variantId: String(variant._id),
            availableQty: variant.inventory,
            requestedQty: bl.qty * qty,
          });
        }
      }
      if (bundleBroken) continue;

      // Bundle price is configured by an admin in MongoDB. Savings are derived.
      const individualTotal = bundle.lines.reduce((sum, bl) => {
        const variant = variantDocs.find((v) => String(v._id) === String(bl.variantId));
        if (variant) return sum + variant.pricePaise * bl.qty;
        const product = productDocs.find((p) => String(p._id) === String(bl.productId));
        const fallback = product ? 0 : 0;
        return sum + fallback;
      }, 0);

      const savings = computeBundleSavings(individualTotal, bundle.bundlePricePaise);
      if (bundle.bundlePricePaise <= 0) {
        result.issues.push({
          code: 'PRICE_UNSET',
          message: `${bundle.name} is not available for purchase yet.`,
          productId: bundle.slug,
        });
        continue;
      }

      // Expand into snapshot lines so the order document and the invoice stay
      // identical in shape whether a bundle or a single item was bought.
      for (const bl of bundle.lines) {
        const product = productDocs.find((p) => String(p._id) === String(bl.productId))!;
        const variant =
          variantDocs.find((v) => String(v._id) === String(bl.variantId)) ??
          (await ProductVariant.findOne({ productId: bl.productId, isActive: true })
            .sort({ sortOrder: 1 })
            .lean()
            .exec());
        if (!product || !variant) continue;

        const lineQty = bl.qty * qty;
        const unitPrice = Math.round(bundle.bundlePricePaise / bundle.lines.length);
        result.lines.push({
          productId: String(product._id),
          variantId: String(variant._id),
          name: product.name,
          slug: product.slug,
          flavour: product.flavour,
          sku: variant.sku,
          weightLabel: variant.weightLabel,
          weightGrams: variant.weightGrams ?? null,
          imageUrl: primaryMedia(product.images)?.url ?? null,
          unitPricePaise: unitPrice,
          mrpPaise: variant.mrpPaise ?? null,
          qty: lineQty,
          lineTotalPaise: unitPrice * lineQty,
          bundleId: String(bundle._id),
          bundleName: bundle.name,
        });
        result.totalWeightGrams += (variant.weightGrams ?? 0) * lineQty;
      }

      void savings;
    }
  }

  // ------------------------------------------------------------- plain lines
  // Merge duplicate (product, variant) pairs so qty is enforced in aggregate.
  const merged = new Map<string, RequestedLine>();
  for (const l of requestedLines) {
    const key = `${l.productId}:${l.variantId}`;
    const existing = merged.get(key);
    if (existing) existing.qty += l.qty;
    else merged.set(key, { ...l });
  }

  if (merged.size > 0) {
    const productIds = [...new Set([...merged.values()].map((l) => l.productId))];
    const variantIds = [...new Set([...merged.values()].map((l) => l.variantId))];

    const [productDocs, variantDocs] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).lean().exec(),
      ProductVariant.find({ _id: { $in: variantIds } }).lean().exec(),
    ]);

    for (const [key, req] of merged) {
      const product = productDocs.find((p) => String(p._id) === req.productId);
      const variant = variantDocs.find((v) => String(v._id) === req.variantId);

      if (!product) {
        result.issues.push({
          code: 'PRODUCT_UNAVAILABLE',
          message: 'A product in your cart is no longer available.',
          productId: req.productId,
        });
        continue;
      }
      if (!product.isActive) {
        result.issues.push({
          code: 'PRODUCT_INACTIVE',
          message: `${product.name} is currently unavailable.`,
          productId: req.productId,
        });
        continue;
      }
      if (!variant || !variant.isActive) {
        result.issues.push({
          code: 'VARIANT_UNAVAILABLE',
          message: `${product.name} — that pack size is unavailable.`,
          productId: req.productId,
          variantId: req.variantId,
        });
        continue;
      }
      if (String(variant.productId) !== String(product._id)) {
        // Mismatched pairing is tampering, not a user error.
        result.issues.push({
          code: 'VARIANT_UNAVAILABLE',
          message: 'A product and pack size in your cart could not be matched.',
          productId: req.productId,
          variantId: req.variantId,
        });
        continue;
      }

      const qty = Math.min(Math.max(Math.floor(req.qty), 1), MAX_QTY_PER_LINE);

      if (variant.inventory <= 0) {
        result.issues.push({
          code: 'OUT_OF_STOCK',
          message: `${product.name} (${variant.weightLabel}) is out of stock.`,
          productId: req.productId,
          variantId: req.variantId,
          availableQty: 0,
        });
        continue;
      }
      if (qty > variant.inventory) {
        result.issues.push({
          code: 'OUT_OF_STOCK',
          message: `Only ${variant.inventory} left of ${product.name} (${variant.weightLabel}).`,
          productId: req.productId,
          variantId: req.variantId,
          availableQty: variant.inventory,
          requestedQty: qty,
        });
        continue;
      }
      if (variant.pricePaise <= 0) {
        result.issues.push({
          code: 'PRICE_UNSET',
          message: `${product.name} is not available for purchase yet.`,
          productId: req.productId,
          variantId: req.variantId,
        });
        continue;
      }

      result.lines.push({
        productId: String(product._id),
        variantId: String(variant._id),
        name: product.name,
        slug: product.slug,
        flavour: product.flavour,
        sku: variant.sku,
        weightLabel: variant.weightLabel,
        weightGrams: variant.weightGrams ?? null,
        imageUrl: primaryMedia(product.images)?.url ?? null,
        unitPricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise ?? null,
        qty,
        lineTotalPaise: variant.pricePaise * qty,
        bundleId: null,
        bundleName: null,
      });
      result.totalWeightGrams += (variant.weightGrams ?? 0) * qty;

      void key;
    }
  }

  if (result.lines.length === 0) {
    if (result.issues.length === 0) {
      result.issues.push({ code: 'CARTS_EMPTY', message: 'Your cart is empty.' });
    }
    return result;
  }

  // ------------------------------------------------------------------ totals
  result.subtotalPaise = result.lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  result.mrpTotalPaise = result.lines.reduce(
    (s, l) => s + (l.mrpPaise ?? l.unitPricePaise) * l.qty,
    0,
  );
  result.productDiscountPaise = Math.max(0, result.mrpTotalPaise - result.subtotalPaise);

  // Coupon — validated server-side, discount returned in paise.
  const code = input.couponCode?.trim();
  if (code) {
    const lineProductIds = result.lines.map((l) => l.productId);
    // Bundles are excluded from percentage coupons to keep maths predictable.
    const eligibleSubtotal = result.lines
      .filter((l) => !l.bundleId)
      .reduce((s, l) => s + l.lineTotalPaise, 0);

    const validation = await validateCoupon({
      code,
      eligibleSubtotalPaise: eligibleSubtotal,
      cartSubtotalPaise: result.subtotalPaise,
      lineProductIds,
      userId: input.userId ?? null,
    });
    result.coupon = validation;
    if (validation.valid) result.couponDiscountPaise = validation.discountPaise;
  }

  const isCod = input.paymentMethod === 'COD';
  const { shippingPaise, waivedPaise } = computeShipping({
    cfg,
    subtotalPaise: result.subtotalPaise - result.couponDiscountPaise,
    totalWeightGrams: result.totalWeightGrams,
    isCod,
  });
  result.shippingPaise = shippingPaise;
  result.shippingWaivedPaise = waivedPaise;

  // COD gating — only offered when genuinely configured and within limits.
  const afterDiscount = result.subtotalPaise - result.couponDiscountPaise;
  if (!cfg.codEnabled) {
    result.codAvailable = false;
    result.codBlockedReason = 'Cash on delivery is not available.';
  } else if (cfg.codMaxOrderPaise !== null && afterDiscount > cfg.codMaxOrderPaise) {
    result.codAvailable = false;
    result.codBlockedReason = 'Cash on delivery is not available for this order value.';
  } else {
    result.codAvailable = true;
  }
  if (!isCod) result.codHandlingPaise = 0;
  else result.codHandlingPaise = cfg.codEnabled ? cfg.codHandlingPaise : 0;

  result.discountPaise = result.productDiscountPaise + result.couponDiscountPaise;

  // Tax: inclusive by default (prices already contain it), so nothing is added
  // on top. Exclusive mode adds tax on the discounted base.
  if (cfg.taxEnabled && !cfg.taxInclusive) {
    result.taxPaise = Math.round((afterDiscount * cfg.taxPercent) / 100);
  } else {
    result.taxPaise = 0;
  }

  result.totalPaise = Math.max(
    0,
    afterDiscount + result.shippingPaise + result.taxPaise,
  );

  // Free-shipping progress
  if (cfg.freeShippingEnabled && cfg.freeShippingThresholdPaise) {
    result.freeShippingUnlocked = afterDiscount >= cfg.freeShippingThresholdPaise;
    result.freeShippingShortfallPaise = result.freeShippingUnlocked
      ? 0
      : Math.max(0, cfg.freeShippingThresholdPaise - afterDiscount);
  }

  if (cfg.maxWeightPerOrderGrams > 0 && result.totalWeightGrams > cfg.maxWeightPerOrderGrams) {
    result.ok = false;
    result.issues.push({
      code: 'OUT_OF_STOCK',
      message: 'This order is too heavy for our courier. Please contact support.',
    });
    return result;
  }

  result.ok = result.issues.length === 0;
  return result;
}

/**
 * Decrement stock atomically using a conditional update, so two simultaneous
 * checkouts can never oversell. Returns false when stock ran out mid-flight.
 */
export async function commitInventory(
  lines: Array<{ variantId: string; qty: number }>,
): Promise<{ ok: boolean; failedVariantId?: string }> {
  await connectDb();
  for (const line of lines) {
    const res = await ProductVariant.updateOne(
      { _id: line.variantId, isActive: true, inventory: { $gte: line.qty } },
      { $inc: { inventory: -line.qty } },
    );
    if (res.modifiedCount === 0) {
      return { ok: false, failedVariantId: line.variantId };
    }
  }
  return { ok: true };
}

/** Restore stock when an order is cancelled/refunded. */
export async function releaseInventory(
  lines: Array<{ variantId: string | null; qty: number }>,
): Promise<void> {
  await connectDb();
  for (const line of lines) {
    if (!line.variantId) continue;
    await ProductVariant.updateOne(
      { _id: line.variantId },
      { $inc: { inventory: Math.max(0, line.qty) } },
    ).exec();
  }
}

export async function incrementCouponUsage(code: string): Promise<void> {
  await connectDb();
  await Coupon.updateOne({ code: code.toUpperCase() }, { $inc: { usageCount: 1 } }).exec();
}
