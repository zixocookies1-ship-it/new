import { priceCart } from '@/lib/pricing';
import { ok, handleRouteError, noStore, fail, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { couponValidateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Coupon validation.
 *
 * Returns the server-computed discount in paise. A client that asks for a
 * specific discount amount is simply ignored — there is no parameter for it.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('cart:coupon', RATE_LIMITS.coupon.limit, RATE_LIMITS.coupon.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = couponValidateSchema.parse(await req.json());
    const pricing = await priceCart({
      lines: body.lines,
      bundles: body.bundles,
      couponCode: body.code,
      paymentMethod: body.paymentMethod,
    });

    if (!pricing.coupon) {
      return fail('That coupon could not be validated.', { status: 422, code: 'NO_RESULT' });
    }

    return ok(
      {
        valid: pricing.coupon.valid,
        code: pricing.coupon.code,
        message: pricing.coupon.message,
        discountPaise: pricing.coupon.discountPaise,
        totalPaise: pricing.totalPaise,
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
