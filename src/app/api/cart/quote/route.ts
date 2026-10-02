import { z } from 'zod';
import { priceCart } from '@/lib/pricing';
import { ok, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { getBusinessSettings } from '@/lib/models/BusinessSettings';
import { isRazorpayReady } from '@/lib/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-authoritative cart quote.
 *
 * The client posts only ids + quantities. Prices, discounts, shipping and the
 * total are all recomputed here from MongoDB, and the response is the single
 * source of truth the cart UI, the drawer and checkout all render from.
 */
const schema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
        variantId: z.string().regex(/^[0-9a-fA-F]{24}$/),
        qty: z.coerce.number().int().min(1).max(20),
      }),
    )
    .max(30)
    .default([]),
  bundles: z
    .array(
      z.object({
        bundleId: z.string().regex(/^[0-9a-fA-F]{24}$/),
        qty: z.coerce.number().int().min(1).max(20),
      }),
    )
    .max(10)
    .default([]),
  couponCode: z.string().trim().max(40).nullish(),
  paymentMethod: z.enum(['RAZORPAY', 'COD']).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('cart:quote', RATE_LIMITS.coupon.limit, RATE_LIMITS.coupon.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = schema.parse(await req.json());
    const settings = await getBusinessSettings();

    const pricing = await priceCart({
      lines: body.lines,
      bundles: body.bundles,
      couponCode: body.couponCode ?? null,
      paymentMethod: body.paymentMethod,
    });

    return ok(
      {
        ok: pricing.ok,
        lines: pricing.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          name: l.name,
          weightLabel: l.weightLabel,
          imageUrl: l.imageUrl,
          unitPricePaise: l.unitPricePaise,
          mrpPaise: l.mrpPaise,
          qty: l.qty,
          lineTotalPaise: l.lineTotalPaise,
        })),
        issues: pricing.issues,
        subtotalPaise: pricing.subtotalPaise,
        mrpTotalPaise: pricing.mrpTotalPaise,
        productDiscountPaise: pricing.productDiscountPaise,
        couponDiscountPaise: pricing.couponDiscountPaise,
        discountPaise: pricing.discountPaise,
        shippingPaise: pricing.shippingPaise,
        taxPaise: pricing.taxPaise,
        totalPaise: pricing.totalPaise,
        coupon: pricing.coupon
          ? {
              valid: pricing.coupon.valid,
              code: pricing.coupon.code,
              message: pricing.coupon.message,
              discountPaise: pricing.coupon.discountPaise,
            }
          : null,
        freeShippingThresholdPaise: pricing.freeShippingThresholdPaise,
        freeShippingShortfallPaise: pricing.freeShippingShortfallPaise,
        freeShippingUnlocked: pricing.freeShippingUnlocked,
        codAvailable: pricing.codAvailable,
        codBlockedReason: pricing.codBlockedReason,
        onlinePaymentAvailable: settings.onlinePaymentEnabled && isRazorpayReady(),
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
