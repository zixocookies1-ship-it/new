import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { syncShipment, refreshOrderTracking } from '@/lib/orders';
import { getShippingConfig } from '@/lib/models/ShippingConfiguration';
import { isDelhiveryReady } from '@/lib/delhivery';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Fulfilment actions:
 *   action=retry-sync   → (re)create the Delhivery shipment for a paid order
 *   action=refresh      → pull the courier's current status onto the order
 *   action=config-check → is the courier actually ready to ship?
 *
 * A courier failure is *persisted* on the order rather than swallowed, so the
 * admin list shows a retryable row instead of an order that silently never
 * ships.
 */
export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'retry-sync';
    const raw = (await readJson(req, 8 * 1024)) as { orderId?: string };
    const orderId = (raw.orderId ?? '').trim().toUpperCase();

    if (action === 'config-check') {
      const cfg = await getShippingConfig({ fresh: true });
      const originComplete = Boolean(cfg.pickupName && cfg.pickupAddressLine1 && cfg.pickupCity && cfg.pickupPincode);
      return ok(
        {
          delhiveryConfigured: isDelhiveryReady(),
          shippingEnabled: cfg.shippingEnabled,
          serviceabilityMode: cfg.serviceabilityMode,
          originComplete,
          pickup: {
            name: cfg.pickupName,
            city: cfg.pickupCity,
            state: cfg.pickupState,
            pincode: cfg.pickupPincode,
          },
          blockers: [
            ...(isDelhiveryReady() ? [] : ['DELHIVERY_API_KEY is not set.']),
            ...(originComplete
              ? []
              : ['Pickup address is incomplete — fill name, address, city and PIN code in Admin → Shipping.']),
            ...(cfg.shippingEnabled ? [] : ['Shipping is switched off, so checkout is disabled.']),
          ],
        },
        { headers: noStore },
      );
    }

    if (!orderId) {
      return fail('An orderId is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    await connectDb();
    const order = await Order.findOne({ orderId }).select('_id orderId shipping').exec();
    if (!order) return fail('Order not found.', { status: 404, code: 'NOT_FOUND' });

    if (action === 'refresh') {
      const res = await refreshOrderTracking(orderId);
      if (!res.ok) {
        return fail(res.error, { status: 409, code: 'TRACKING_FAILED' });
      }
      return ok(
        {
          changed: res.changed,
          shippingStatus: res.order.shipping.status,
          orderStatus: res.order.status,
          lastStatusText: res.order.shipping.lastStatusText,
          lastSyncedAt: res.order.shipping.lastSyncedAt
            ? new Date(res.order.shipping.lastSyncedAt).toISOString()
            : null,
        },
        { headers: noStore },
      );
    }

    if (action === 'retry-sync') {
      const res = await syncShipment(order._id);
      if (!res.ok) {
        return fail(res.reason, {
          status: res.retryable ? 503 : 409,
          code: res.code,
          details: { retryable: res.retryable },
        });
      }
      const fresh = await Order.findById(order._id).select('shipping').exec();
      return ok(
        {
          waybill: res.waybill,
          alreadyExisted: res.alreadyExisted,
          shippingStatus: fresh?.shipping.status ?? null,
          syncStatus: fresh?.shipping.syncStatus ?? null,
          trackingUrl: fresh?.shipping.trackingUrl ?? null,
        },
        { headers: noStore },
      );
    }

    return fail(`Unknown action "${action}".`, { status: 400, code: 'UNKNOWN_ACTION' });
  } catch (err) {
    return handleRouteError(err);
  }
}