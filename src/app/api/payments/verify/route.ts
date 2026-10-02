import { verifyPaymentForOrder, markPaymentFailed } from '@/lib/orders';
import { ok, fail, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyPaymentSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Payment verification.
 *
 * This is the endpoint the browser calls after Razorpay checkout returns. It
 * is a *request for verification*, never a declaration of success: the
 * signature is checked, the payment is re-fetched from Razorpay, and only then
 * is the order marked PAID. A page refresh or a duplicate call is idempotent.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('payments:verify', RATE_LIMITS.paymentVerify.limit, RATE_LIMITS.paymentVerify.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = verifyPaymentSchema.parse(await req.json());

    const result = await verifyPaymentForOrder({
      orderId: body.orderId,
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
    });

    if (!result.ok) {
      return fail(result.error, {
        status: result.status,
        code: result.retryable ? 'PAYMENT_PENDING' : 'PAYMENT_FAILED',
        details: {
          paymentStatus: result.order?.payment.status ?? null,
          retryable: Boolean(result.retryable),
        },
      });
    }

    const order = result.order!;
    return ok(
      {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.payment.status,
        signatureVerified: order.payment.signatureVerified,
        alreadyProcessed: result.alreadyProcessed,
        waybill: order.shipping.waybill,
        shippingStatus: order.shipping.status,
        totalPaise: order.totalPaise,
        items: order.items.map((i) => ({
          name: i.name,
          variantId: i.variantId ? String(i.variantId) : null,
          qty: i.qty,
          lineTotalPaise: i.lineTotalPaise,
        })),
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Explicit record of a payment the customer abandoned or that failed. */
export async function PUT(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('payments:fail', RATE_LIMITS.paymentVerify.limit, RATE_LIMITS.paymentVerify.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = (await req.json().catch(() => ({}))) as {
      orderId?: string;
      code?: string;
      description?: string;
      paymentId?: string;
    };
    if (!body.orderId) return fail('orderId is required.', { status: 400 });

    const order = await markPaymentFailed({
      orderId: body.orderId,
      code: body.code ?? 'CANCELLED_BY_USER',
      description: body.description ?? 'Payment was not completed.',
      paymentId: body.paymentId ?? null,
    });

    if (!order) return fail('Order not found.', { status: 404 });
    // Already paid orders are never downgraded.
    return ok({ orderId: order.orderId, paymentStatus: order.payment.status }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}
