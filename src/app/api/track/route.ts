import type { HydratedDocument } from 'mongoose';
import type { OrderDoc } from '@/lib/models/Order';
import { getLiveTracking, findOrderForCustomer } from '@/lib/orders';
import { ok, fail, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackOrderSchema } from '@/lib/validation';
import { buildTrackingUrl } from '@/lib/delhivery';
import { getShippingConfig } from '@/lib/models/ShippingConfiguration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin-configured delivery estimate, shown only while there is no waybill to
 * read a real date from. Returns null when estimates are switched off or the
 * window is not configured — we never invent a date.
 */
async function deliveryEstimateFor(order: {
  shipping: { waybill: string | null };
}): Promise<{ minDays: number; maxDays: number } | null> {
  if (order.shipping.waybill) return null;
  const cfg = await getShippingConfig();
  if (!cfg.showEstimatedDelivery) return null;
  const min = cfg.defaultEstimatedDeliveryDaysMin;
  const max = cfg.defaultEstimatedDeliveryDaysMax;
  if (!min || !max || max < min) return null;
  return { minDays: min, maxDays: max };
}

/** Public, non-sensitive projection of an order for the tracking page. */
async function publicOrderView(order: HydratedDocument<OrderDoc>): Promise<Record<string, unknown>> {
  const contact = (v: string | null | undefined) => {
    if (!v) return null;
    const s = String(v);
    if (s.length <= 2) return '••';
    return `${s.slice(0, 2)}${'•'.repeat(Math.max(2, s.length - 4))}${s.slice(-2)}`;
  };

  return {
    orderId: order.orderId,
    reference: order.reference,
    status: order.status,
    placedAt: new Date(order.createdAt).toISOString(),
    // Enough for a customer to recognise the parcel; never the whole address.
    shipTo: {
      name: order.shippingAddress.name,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      pincode: order.shippingAddress.pincode,
      phone: contact(order.shippingAddress.phone),
      email: contact(order.shippingAddress.email),
    },
    items: order.items.map((i) => ({
      name: i.name,
      weightLabel: i.weightLabel,
      qty: i.qty,
      imageUrl: i.imageUrl,
      unitPricePaise: i.unitPricePaise,
      lineTotalPaise: i.lineTotalPaise,
    })),
    totals: {
      subtotalPaise: order.subtotalPaise,
      mrpTotalPaise: order.mrpTotalPaise,
      discountPaise: order.discountPaise,
      couponCode: order.couponCode ?? null,
      couponDiscountPaise: order.couponDiscountPaise ?? 0,
      shippingPaise: order.shippingPaise,
      shippingChargedPaise: order.shippingChargedPaise,
      taxPaise: order.taxPaise,
      totalPaise: order.totalPaise,
    },
    deliveryEstimate: await deliveryEstimateFor(order),
    payment: {
      method: order.payment.method,
      status: order.payment.status,
      amountPaise: order.payment.amount,
      refundId: order.payment.refundId,
    },
    shipping: {
      status: order.shipping.status,
      carrier: order.shipping.carrier,
      waybill: order.shipping.waybill,
      trackingUrl: order.shipping.waybill ? buildTrackingUrl(order.shipping.waybill) : null,
      lastStatusText: order.shipping.lastStatusText,
      lastSyncedAt: order.shipping.lastSyncedAt
        ? new Date(order.shipping.lastSyncedAt).toISOString()
        : null,
      // A courier sync failure is surfaced as such — never hidden, never faked.
      syncStatus: order.shipping.syncStatus,
      syncError: order.shipping.syncStatus === 'FAILED' ? order.shipping.syncError : null,
      history: order.shipping.statusHistory
        .slice()
        .reverse()
        .map((h) => ({
          status: h.status,
          at: new Date(h.at).toISOString(),
          note: h.note ?? null,
        })),
    },
    timeline: order.statusHistory
      .slice()
      .reverse()
      .map((h) => ({
        status: h.status,
        at: new Date(h.at).toISOString(),
        note: h.note ?? null,
      })),
  };
}

/**
 * Order tracking.
 *
 * Requires the order ID **plus** the email or mobile used on the order. A wrong
 * contact value returns the same generic error as an unknown order, so this
 * endpoint cannot be used to enumerate or confirm the existence of orders.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('track', RATE_LIMITS.track.limit, RATE_LIMITS.track.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = trackOrderSchema.parse(await req.json());

    // One shared ownership check: null covers both "no such order" and
    // "wrong contact", so this endpoint cannot be used to enumerate orders.
    const order = await findOrderForCustomer(body.orderId, body.contact);

    const generic = fail(
      'We could not find an order with those details. Please check the order ID and the email or mobile used.',
      { status: 404, code: 'NOT_FOUND' },
    );

    if (!order) return generic;

    const view = await publicOrderView(order);

    // Enrich with live courier status when we have a waybill.
    let live: { waybill: string; status: string; delivered: boolean; events: unknown[] } | null = null;
    let liveError: string | null = null;

    if (order.shipping.waybill && order.shipping.syncStatus !== 'FAILED') {
      const res = await getLiveTracking(order.shipping.waybill);
      if (res.ok && res.data) {
        live = {
          waybill: res.data.waybill,
          status: res.data.status,
          delivered: res.data.delivered,
          events: res.data.events,
        };
      } else {
        liveError = res.error;
      }
    }

    return ok({ order: view, live, liveError }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}