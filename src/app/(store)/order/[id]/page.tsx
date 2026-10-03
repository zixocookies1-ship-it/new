import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { OrderPageClient } from '@/components/order/OrderPageClient';
import { buildMetadata } from '@/lib/seo';
import { orderIdParamSchema } from '@/lib/validation';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const settings = await getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never);
  const parsed = orderIdParamSchema.safeParse({ orderId: decodeURIComponent(id) });
  if (!parsed.success) {
    return buildMetadata(settings, {
      title: 'Order not found',
      description: 'That order link does not look valid.',
      path: '/contact',
      noIndex: true,
    });
  }
  return buildMetadata(settings, {
    title: `Order ${parsed.data.orderId}`,
    description: 'Order status, tracking and details.',
    path: `/order/${parsed.data.orderId}`,
    // Order pages must never be indexed — they are per-customer.
    noIndex: true,
  });
}

export default async function OrderPage({ params }: Params) {
  const { id } = await params;
  const parsed = orderIdParamSchema.safeParse({ orderId: decodeURIComponent(id) });
  if (!parsed.success) notFound();

  const orderId = parsed.data.orderId;

  return (
    <div className="bg-cream-100">
      <div className="nc-container pt-6">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Your order', href: `/order/${orderId}` },
            { label: orderId },
          ]}
        />
      </div>

      <OrderPageClient orderId={orderId} />
    </div>
  );
}
