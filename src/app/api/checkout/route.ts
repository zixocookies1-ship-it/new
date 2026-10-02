import { createOrder } from '@/lib/orders';
import { checkServiceability } from '@/lib/delhivery';
import { getShippingConfig } from '@/lib/models/ShippingConfiguration';
import { ok, fail, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { createOrderSchema } from '@/lib/validation';
import { publicEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Order creation.
 *
 * The only input the client controls is *what* it wants to buy, *how many*, and
 * *where to ship it*. Every amount is computed server-side from MongoDB.
 *
 * `clientCheckoutToken` makes this endpoint idempotent: a double tap, a
 * retried fetch or a refresh cannot create a second order.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('checkout:create', RATE_LIMITS.orderCreate.limit, RATE_LIMITS.orderCreate.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = createOrderSchema.parse(await req.json());

    // Optional live serviceability check. A courier failure must never block
    // checkout, so we degrade to UNKNOWN and the order still records it.
    let serviceability: 'SERVICEABLE' | 'UNSERVICEABLE' | 'UNKNOWN' = 'UNKNOWN';
    const cfg = await getShippingConfig();
    if (cfg.serviceabilityMode === 'DELHIVERY_API') {
      try {
        const res = await checkServiceability(body.address.pincode);
        serviceability = res.serviceability;
        if (serviceability === 'UNSERVICEABLE') {
          return fail(
            res.message ?? 'We are not able to deliver to that PIN code yet.',
            { status: 422, code: 'UNSERVICEABLE' },
          );
        }
      } catch {
        serviceability = 'UNKNOWN';
      }
    } else if (cfg.serviceabilityMode === 'LIST') {
      const pin = body.address.pincode;
      if (cfg.blockedPincodes.includes(pin)) {
        return fail('We are not able to deliver to that PIN code yet.', {
          status: 422,
          code: 'UNSERVICEABLE',
        });
      }
      serviceability = cfg.serviceablePincodes.includes(pin) ? 'SERVICEABLE' : 'UNKNOWN';
    }

    const result = await createOrder({
      lines: body.lines,
      bundles: body.bundles,
      couponCode: body.couponCode ?? null,
      paymentMethod: body.paymentMethod,
      address: body.address,
      customerNote: body.customerNote,
      clientCheckoutToken: body.clientCheckoutToken,
      serviceability,
    });

    if (!result.ok) {
      return fail(result.error, {
        status: result.status,
        code: 'ORDER_REJECTED',
        details: result.issues,
      });
    }

    const order = result.order;

    return ok(
      {
        orderId: order.orderId,
        reference: order.reference,
        totalPaise: order.totalPaise,
        currency: 'INR',
        paymentMethod: order.payment.method,
        paymentStatus: order.payment.status,
        status: order.status,
        // The client needs the Razorpay key id to open checkout. It is a public
        // key; the secret never leaves the server.
        razorpayKeyId: order.payment.method === 'RAZORPAY' ? publicEnv.razorpayKeyId : null,
        reused: result.reused,
        items: order.items.map((i) => ({
          name: i.name,
          weightLabel: i.weightLabel,
          qty: i.qty,
          lineTotalPaise: i.lineTotalPaise,
        })),
      },
      { status: result.reused ? 200 : 201, headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
