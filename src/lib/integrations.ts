import 'server-only';

import { integrationState, integrationLabels, publicEnv, type IntegrationKey } from './env';
import { isRazorpayReady } from './razorpay';
import { isDelhiveryReady } from './delhivery';

/**
 * A single, authoritative view of "what is actually connected right now".
 *
 * Used by:
 *  - the admin Setup checklist (so nothing stays silently broken)
 *  - the storefront footer, which only advertises capabilities that are true
 *
 * There is no code path that claims a capability this function reports as
 * `missing`.
 */

const KEYS: IntegrationKey[] = ['mongo', 'cloudinary', 'razorpay', 'delhivery', 'auth'];

export interface IntegrationHealthEntry {
  key: IntegrationKey;
  label: string;
  state: 'configured' | 'missing';
  /** Actionable next step shown in the admin checklist. */
  hint: string;
}

export function getIntegrationHealth(): Record<IntegrationKey, 'configured' | 'missing'> {
  const out = {} as Record<IntegrationKey, 'configured' | 'missing'>;
  for (const key of KEYS) out[key] = integrationState(key);
  return out;
}

export function getIntegrationChecklist(): IntegrationHealthEntry[] {
  const hints: Record<IntegrationKey, string> = {
    mongo: 'Set MONGODB_URI in .env.local. Without it, no product or order data can load.',
    cloudinary:
      'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to enable image uploads and optimised delivery.',
    razorpay:
      'Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and NEXT_PUBLIC_RAZORPAY_KEY_ID, then enable online payments in Settings.',
    delhivery:
      'Set DELHIVERY_API_KEY, then complete the pickup address in Admin → Shipping before orders can ship.',
    auth: 'Set AUTH_SECRET to a long random string, then create an admin account with `npm run seed:admin`.',
  };

  return KEYS.map((key) => ({
    key,
    label: integrationLabels[key],
    state: integrationState(key),
    hint: hints[key],
  }));
}

/* -------------------------------------------------------------------------- */
/* Storefront capability flags                                                */
/* -------------------------------------------------------------------------- */

export interface StoreCapabilities {
  /** Razorpay keys present AND an admin has switched online payments on. */
  onlinePayments: boolean;
  /** Razorpay is not usable — checkout must not offer a fake payment option. */
  cod: boolean;
  /** Live courier tracking is available. */
  liveTracking: boolean;
  /** Images will be served from Cloudinary. */
  images: boolean;
  analytics: { ga: boolean; meta: boolean };
}

export async function getStoreCapabilities(params: {
  onlinePaymentEnabled: boolean;
  codEnabled: boolean;
}): Promise<StoreCapabilities> {
  const razorpayOk = isRazorpayReady();
  return {
    // Both conditions required. This is what stops a "Pay online" button that
    // cannot complete.
    onlinePayments: razorpayOk && params.onlinePaymentEnabled,
    cod: params.codEnabled,
    liveTracking: isDelhiveryReady(),
    images: integrationState('cloudinary') === 'configured',
    analytics: {
      ga: Boolean(publicEnv.gaMeasurementId),
      meta: Boolean(publicEnv.metaPixelId),
    },
  };
}
