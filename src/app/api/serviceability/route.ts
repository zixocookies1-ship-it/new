import { getShippingConfig } from '@/lib/models/ShippingConfiguration';
import { checkServiceability, isDelhiveryReady } from '@/lib/delhivery';
import { ok, fail, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { serviceabilitySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PIN-code serviceability check.
 *
 * Honest by construction: it reports one of SERVICEABLE / UNSERVICEABLE /
 * UNKNOWN and never invents an estimated delivery date unless the courier has
 * actually returned one. When shipping is switched off in the admin panel we
 * say so plainly instead of pretending to check.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('serviceability', RATE_LIMITS.serviceability.limit, RATE_LIMITS.serviceability.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const { pincode } = serviceabilitySchema.parse(await req.json());
    const cfg = await getShippingConfig();

    if (!cfg.shippingEnabled) {
      return fail(
        cfg.shippingDisabledMessage ||
          'Online ordering is being set up. Please check back shortly or contact us.',
        { status: 503, code: 'SHIPPING_DISABLED' },
      );
    }

    if (cfg.serviceabilityMode === 'DISABLED') {
      return fail(
        'We are not able to confirm delivery for this PIN code right now.',
        { status: 422, code: 'CHECK_UNAVAILABLE' },
      );
    }

    if (cfg.serviceabilityMode === 'LIST') {
      if (cfg.blockedPincodes.includes(pincode)) {
        return fail(cfg.unserviceableMessage, { status: 422, code: 'UNSERVICEABLE' });
      }
      const serviceable = cfg.serviceablePincodes.includes(pincode);
      return ok(
        {
          pincode,
          serviceability: serviceable ? 'SERVICEABLE' : 'UNKNOWN',
          message: serviceable
            ? 'We deliver to this PIN code.'
            : cfg.unknownPincodeMessage ||
              'We could not confirm this PIN code. Please continue and we will get in touch if there is an issue.',
          // Only present when the courier actually supplied it.
          estimatedDeliveryDays: null,
          estimatedPickupDate: null,
          codAvailable: cfg.codEnabled,
          source: 'LIST' as const,
        },
        { headers: noStore },
      );
    }

    // DELHIVERY_API
    if (!isDelhiveryReady()) {
      return fail(
        'We are not able to confirm delivery for this PIN code right now.',
        { status: 503, code: 'COURIER_UNAVAILABLE' },
      );
    }

    try {
      const res = await checkServiceability(pincode);

      if (res.serviceability === 'UNSERVICEABLE') {
        return fail(res.message || cfg.unserviceableMessage, {
          status: 422,
          code: 'UNSERVICEABLE',
        });
      }

      return ok(
        {
          pincode,
          serviceability: res.serviceability,
          message:
            res.message ||
            (res.serviceability === 'SERVICEABLE'
              ? 'We deliver to this PIN code.'
              : cfg.unknownPincodeMessage ||
                'We could not confirm this PIN code. Please continue and we will get in touch if there is an issue.'),
          estimatedDeliveryDays: res.estimatedDeliveryDays ?? null,
          estimatedPickupDate: res.estimatedPickupDate ?? null,
          codAvailable: cfg.codEnabled,
          source: 'DELHIVERY_API' as const,
        },
        { headers: noStore },
      );
    } catch (err) {
      // A courier outage must not block checkout — report UNKNOWN, do not guess.
      console.error('[serviceability] courier lookup failed', err);
      return ok(
        {
          pincode,
          serviceability: 'UNKNOWN',
          message:
            cfg.unknownPincodeMessage ||
            'We could not confirm this PIN code right now. Please continue and we will get in touch if there is an issue.',
          estimatedDeliveryDays: null,
          estimatedPickupDate: null,
          codAvailable: cfg.codEnabled,
          source: 'DELHIVERY_API' as const,
        },
        { headers: noStore },
      );
    }
  } catch (err) {
    return handleRouteError(err);
  }
}