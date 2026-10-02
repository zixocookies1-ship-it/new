/**
 * Environment configuration.
 *
 * Rules enforced here:
 *  - secrets are only ever read on the server (`server-only` guard)
 *  - nothing throws at import time; integrations degrade gracefully and report
 *    "not configured" so the storefront still renders (never a blank page)
 */

import 'server-only';

export type IntegrationState = 'configured' | 'missing';

function str(key: string): string {
  const v = process.env[key];
  return typeof v === 'string' ? v.trim() : '';
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

/** Public site configuration — safe to reference from client components. */
export const publicEnv = {
  siteUrl: (str('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000').replace(/\/+$/, ''),
  razorpayKeyId: str('NEXT_PUBLIC_RAZORPAY_KEY_ID') || str('RAZORPAY_KEY_ID'),
  gaMeasurementId: str('NEXT_PUBLIC_GA_MEASUREMENT_ID'),
  metaPixelId: str('NEXT_PUBLIC_META_PIXEL_ID'),
  googleSiteVerification: str('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION'),
  /**
   * The Meta Conversions API access token is deliberately NOT here and must
   * never be a `NEXT_PUBLIC_*` variable — that would publish the secret to every
   * visitor. It is read server-side only in `/api/analytics/purchase-mirror`
   * (META_CAPI_ACCESS_TOKEN), and the browser simply POSTs to that route.
   */
} as const;

export const serverEnv = {
  mongodbUri: str('MONGODB_URI'),

  cloudinary: {
    cloudName: str('CLOUDINARY_CLOUD_NAME'),
    apiKey: str('CLOUDINARY_API_KEY'),
    apiSecret: str('CLOUDINARY_API_SECRET'),
  },

  razorpay: {
    keyId: str('RAZORPAY_KEY_ID'),
    keySecret: str('RAZORPAY_KEY_SECRET'),
    webhookSecret: str('RAZORPAY_WEBHOOK_SECRET'),
  },

  delhivery: {
    apiKey: str('DELHIVERY_API_KEY'),
    baseUrl: str('DELHIVERY_BASE_URL') || 'https://api.delhivery.com',
  },

  /** Signs admin session cookies. */
  authSecret: str('AUTH_SECRET'),
  adminBootstrapEmail: str('ADMIN_EMAIL'),
  adminBootstrapPassword: str('ADMIN_PASSWORD'),

  /** Default origin Delhivery should use for pickup. */
  defaultPincode: str('DELHIVERY_DEFAULT_PINCODE'),
  defaultCity: str('DELHIVERY_DEFAULT_CITY'),
  defaultState: str('DELHIVERY_DEFAULT_STATE'),
  defaultCountry: str('DELHIVERY_DEFAULT_COUNTRY') || 'India',

  /** Internal secret used to authenticate webhook delivery from Razorpay. */
  internalApiKey: str('INTERNAL_API_KEY'),

  featureFlags: {
    delhiveryAutoCreate: bool('DELHIVERY_AUTO_CREATE', true),
    autoSyncDelhiveryStatus: bool('DELHIVERY_AUTO_STATUS_SYNC', false),
  },

  cacheTtl: num('CACHE_TTL_SECONDS', 300),
} as const;

export type IntegrationKey = 'mongo' | 'cloudinary' | 'razorpay' | 'delhivery' | 'auth';

export function integrationState(key: IntegrationKey): IntegrationState {
  switch (key) {
    case 'mongo':
      return serverEnv.mongodbUri ? 'configured' : 'missing';
    case 'cloudinary':
      return serverEnv.cloudinary.cloudName &&
        serverEnv.cloudinary.apiKey &&
        serverEnv.cloudinary.apiSecret
        ? 'configured'
        : 'missing';
    case 'razorpay':
      return serverEnv.razorpay.keyId && serverEnv.razorpay.keySecret
        ? 'configured'
        : 'missing';
    case 'delhivery':
      return serverEnv.delhivery.apiKey ? 'configured' : 'missing';
    case 'auth':
      return serverEnv.authSecret ? 'configured' : 'missing';
  }
}

/** Human-readable label used by the admin "Setup checklist". */
export const integrationLabels: Record<IntegrationKey, string> = {
  mongo: 'MongoDB connection',
  cloudinary: 'Cloudinary (image delivery + admin uploads)',
  razorpay: 'Razorpay (online payments)',
  delhivery: 'Delhivery (shipping + tracking)',
  auth: 'Admin session signing secret (AUTH_SECRET)',
};
