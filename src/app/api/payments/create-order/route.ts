import { ensureRazorpayOrder } from '@/lib/orders';
import { ok, fail, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create (or reuse) the Razorpay order for an existing order.
 *
 * The amount is read from the persisted MongoDB order — never from the
 * request body. Re-calling this after a failed payment returns the same
 * gateway order so a retry cannot orphan the previous attempt.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('payments:create', RATE_LIMITS.paymentVerify.limit, RATE_LIMITS.paymentVerify.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = (await req.json().catch(() => ({}))) as { orderId?: string };
    const orderId = (body.orderId ?? '').trim();
    if (!orderId) return fail('orderId is required.', { status: 400, code: 'BAD_REQUEST' });

    const result = await ensureRazorpayOrder(orderId);
    if (!result.ok) return fail(result.error, { status: result.status, code: 'PAYMENT_UNAVAILABLE' });

    return ok(
      {
        orderId: result.order.orderId,
        razorpayOrderId: result.gateway.razorpayOrderId,
        amount: result.gateway.amount,
        currency: result.gateway.currency,
        keyId: result.gateway.keyId,
        // Echoed to the client so it can name the company on the Razorpay form.
        name: result.order.address.name,
        email: result.order.email ?? undefined,
        contact: result.order.phone,
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
