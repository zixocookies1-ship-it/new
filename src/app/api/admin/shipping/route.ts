import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import {
  ShippingConfiguration,
  getShippingConfig,
  invalidateShippingConfigCache,
} from '@/lib/models/ShippingConfiguration';
import { isDelhiveryReady } from '@/lib/delhivery';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { shippingConfigSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const cfg = await getShippingConfig({ fresh: true });
    const originComplete = Boolean(
      cfg.pickupName && cfg.pickupAddressLine1 && cfg.pickupCity && cfg.pickupPincode,
    );

    return ok(
      {
        config: cfg,
        blockers: [
          ...(isDelhiveryReady() ? [] : ['DELHIVERY_API_KEY is not set — shipments cannot be created.']),
          ...(originComplete
            ? []
            : ['Pickup address is incomplete. Required: name, address line 1, city and PIN code.']),
        ],
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = shippingConfigSchema.parse(await readJson(req, 512 * 1024));

    await connectDb();
    const doc = await ShippingConfiguration.findOne({}).exec();
    if (!doc) {
      return fail('Shipping configuration document not found.', { status: 404, code: 'NOT_FOUND' });
    }

    // Refuse to enable shipping without a real pickup address — that is the
    // single most common cause of a shipment failing at the courier.
    const merged = { ...doc.toObject(), ...body } as typeof doc;
    if (body.shippingEnabled === true || merged.shippingEnabled) {
      const missing = [
        !merged.pickupName && 'pickup name',
        !merged.pickupAddressLine1 && 'address line 1',
        !merged.pickupCity && 'city',
        !merged.pickupPincode && 'PIN code',
      ].filter(Boolean);
      if (missing.length) {
        return fail(
          `Complete the pickup address before enabling shipping. Missing: ${missing.join(', ')}.`,
          { status: 422, code: 'ORIGIN_INCOMPLETE' },
        );
      }
    }

    // COD must never be offered while it is not configured end to end.
    if (body.codEnabled === true) {
      if (!merged.codMaxOrderPaise || merged.codMaxOrderPaise <= 0) {
        return fail('Set a COD order limit before enabling cash on delivery.', {
          status: 422,
          code: 'COD_LIMIT_REQUIRED',
        });
      }
    }

    // A "free shipping" promise must have a real threshold behind it.
    if (body.freeShippingEnabled === true) {
      if (!merged.freeShippingThresholdPaise || merged.freeShippingThresholdPaise <= 0) {
        return fail('Set a free-shipping threshold before enabling free shipping.', {
          status: 422,
          code: 'FREE_SHIPPING_THRESHOLD_REQUIRED',
        });
      }
    }

    // Delivery estimates are only published when the courier can back them.
    if (body.showEstimatedDelivery === true && body.serviceabilityMode === 'DISABLED') {
      return fail(
        'Delivery estimates need a working serviceability source. Choose the Delhivery API or a PIN code list first.',
        { status: 422, code: 'ESTIMATES_NEED_SOURCE' },
      );
    }

    doc.set(body as never);
    await doc.save();
    invalidateShippingConfigCache();

    const fresh = await getShippingConfig({ fresh: true });
    return ok({ config: fresh }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}