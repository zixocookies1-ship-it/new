import type { Metadata } from 'next';

import { SiteShell } from '@/components/layout/SiteShell';
import { CartProvider } from '@/components/cart/CartProvider';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { getShippingConfig, SHIPPING_DEFAULTS } from '@/lib/models/ShippingConfiguration';
import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';
import type { ShippingConfigurationDoc } from '@/lib/models/ShippingConfiguration';
import { publicEnv } from '@/lib/env';
import { toPlain } from '@/lib/plain';

/**
 * Storefront chrome.
 *
 * Everything a customer sees lives inside this group: header, footer, cart
 * drawer and analytics. `/admin` sits outside it, so the admin panel gets its
 * own layout (see `src/app/admin/layout.tsx`).
 */
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

function fallbackSettings(): BusinessSettingsDoc {
  return {
    ...SETTINGS_DEFAULTS,
    ...({} as Record<string, never>),
    _id: null as never,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function fallbackShipping(): ShippingConfigurationDoc {
  return {
    ...SHIPPING_DEFAULTS,
    ...({} as Record<string, never>),
    _id: null as never,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settingsRes, shippingRes] = await Promise.all([
    getBusinessSettings().catch(() => null),
    getShippingConfig().catch(() => null),
  ]);

  // `HeaderBar` is a Client Component, and a raw lean document still carries a
  // BSON ObjectId in `_id` — a class instance React refuses to serialise.
  // Normalise both singletons once, here, at the only place they cross over.
  const settings = toPlain(settingsRes ?? fallbackSettings());
  const shipping = toPlain(shippingRes ?? fallbackShipping());

  return (
    <CartProvider>
      <SiteShell
        settings={settings}
        shipping={shipping}
        gaId={publicEnv.gaMeasurementId}
        pixelId={publicEnv.metaPixelId}
      >
        {children}
      </SiteShell>
    </CartProvider>
  );
}
