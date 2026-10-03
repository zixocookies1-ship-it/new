import { BrandStrip } from './BrandStrip';
import { HeaderBar } from './HeaderBar';
import { Footer } from './Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';
import type { ShippingConfigurationDoc } from '@/lib/models/ShippingConfiguration';

import type { IntegrationKey } from '@/lib/env';

/**
 * Site chrome shared by the storefront and the public content pages.
 * The admin panel deliberately does NOT use this shell.
 */
export function SiteShell({
  settings,
  shipping,
  children,
}: {
  settings: BusinessSettingsDoc;
  shipping: ShippingConfigurationDoc;
  children: React.ReactNode;
}) {
  // Integration health is handled separately; no global health check here.

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-jaggery-500 focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-cream-50"
      >
        Skip to content
      </a>

      <BrandStrip settings={settings} shipping={shipping} />
      <HeaderBar settings={settings} />

      <main id="main" className="flex-1">
        {children}
      </main>

      <Footer settings={settings} shipping={shipping} />
      <CartDrawer />
    </div>
  );
}

export type IntegrationHealth = Partial<Record<IntegrationKey, 'configured' | 'missing'>>;
