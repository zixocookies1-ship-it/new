import type { Metadata } from 'next';

import { ContentPage } from '@/components/content/ContentPage';
import { safeContent } from '@/lib/catalog';
import { getShippingConfig, SHIPPING_DEFAULTS } from '@/lib/models/ShippingConfiguration';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [content, settings] = await Promise.all([
    safeContent(['policies_cancellation_refund_return']),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
  ]);
  const doc = content.policies_cancellation_refund_return;

  return buildMetadata(settings, {
    title: doc?.seoTitle?.trim() || 'Cancellation, Refund & Return',
    description:
      doc?.seoDescription?.trim() ||
      'How to cancel an order, when a refund is issued, and what happens if something arrives damaged.',
    path: '/cancellation-refund-return',
  });
}

export default async function CancellationPolicyPage() {
  const [content, shipping] = await Promise.all([
    safeContent(['policies_cancellation_refund_return']),
    getShippingConfig().catch(() => ({ ...SHIPPING_DEFAULTS }) as never),
  ]);

  const doc = content.policies_cancellation_refund_return ?? null;

  // The cancellation window is a configured value, so it is printed from
  // configuration rather than typed into the copy twice.
  const liveSections = shipping.allowCancellation
    ? [
        {
          heading: 'Cancelling an order',
          body: `You can request a cancellation from your order page for up to ${shipping.cancelWindowHours} hour${
            shipping.cancelWindowHours === 1 ? '' : 's'
          } after placing it. Once the parcel has been handed to the courier we can no longer stop it — at that point the request becomes a return instead.`,
          verified: true,
        },
      ]
    : [
        {
          heading: 'Cancelling an order',
          body: 'Self-service cancellation is currently switched off. Please contact us and we will help — an order can usually still be stopped before it ships.',
          verified: true,
        },
      ];

  return (
    <ContentPage
      content={doc}
      eyebrow="Policy"
      title="Cancellation, refund & return"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Cancellation, Refund & Return' },
      ]}
      ctaTitle="Need to cancel or return?"
      ctaBody="Send us the order ID and what went wrong — we will sort it out."
      updatedAt={doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null}
      sectionsOverride={liveSections}
    />
  );
}