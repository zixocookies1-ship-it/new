import { customerCancelOrder } from '@/lib/orders';
import { ok, fail, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { cancelOrderSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Customer-initiated cancellation.
 *
 * Same verification bar as tracking: order ID plus the email or mobile on the
 * order. Eligibility rules live in `customerCancelOrder` (no waybill, not paid,
 * self-service enabled in settings) so there is exactly one source of truth.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('order:cancel', RATE_LIMITS.orderCreate.limit, RATE_LIMITS.orderCreate.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = cancelOrderSchema.parse(await req.json());

    const res = await customerCancelOrder({
      orderId: body.orderId.toUpperCase(),
      emailOrPhone: body.contact,
      reason: body.reason,
    });

    if (!res.ok || !res.order) {
      return fail(res.error ?? 'This order could not be cancelled.', {
        status: 422,
        code: 'CANCEL_REJECTED',
      });
    }

    return ok(
      {
        cancelled: true,
        orderId: res.order.orderId,
        status: res.order.status,
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}