import type { Metadata } from 'next';

import { CartPageClient } from '@/components/cart/CartPageClient';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { buildMetadata } from '@/lib/seo';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never);
  return buildMetadata(settings, {
    title: 'Your cart',
    description: 'Review the items in your cart before checkout.',
    path: '/cart',
    // A cart is private; keep it out of search results.
    noIndex: true,
  });
}

export default function CartPage() {
  return (
    <div className="bg-cream-100">
      <div className="nc-container pt-6">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Cart' }]} />
      </div>
      <CartPageClient />
    </div>
  );
}
