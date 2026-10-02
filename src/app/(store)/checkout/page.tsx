import type { Metadata } from 'next';

import { CheckoutClient } from '@/components/checkout/CheckoutClient';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { buildMetadata } from '@/lib/seo';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { getShippingConfig } from '@/lib/models/ShippingConfiguration';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never);
  return buildMetadata(settings, {
    title: 'Checkout',
    description: 'Complete your order. Secure payments and a confirmation you can track.',
    path: '/checkout',
    noIndex: true,
  });
}

export default async function CheckoutPage() {
  const settings = await getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never);
  const shipping = await getShippingConfig().catch(() => null);

  return (
    <div className="bg-cream-100">
      <div className="nc-container pt-6">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />
      </div>

      <CheckoutClient
        shippingEnabled={shipping?.shippingEnabled ?? false}
        shippingDisabledMessage={
          shipping?.shippingDisabledMessage ??
          'Online ordering is being set up. Please check back shortly or use the contact page to reach us.'
        }
        supportEmail={settings.supportEmail || undefined}
        supportPhone={settings.supportPhone || undefined}
      />
    </div>
  );
}
