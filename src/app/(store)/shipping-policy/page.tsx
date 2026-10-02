import type { Metadata } from 'next';

import { ContentPage } from '@/components/content/ContentPage';
import { safeContent } from '@/lib/catalog';
import { getShippingConfig, SHIPPING_DEFAULTS } from '@/lib/models/ShippingConfiguration';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { buildMetadata } from '@/lib/seo';
import { formatINR } from '@/lib/money';
import { Prose } from '@/components/ui/Prose';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [content, settings] = await Promise.all([
    safeContent(['policies_shipping']),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
  ]);
  const doc = content.policies_shipping;

  return buildMetadata(settings, {
    title: doc?.seoTitle?.trim() || 'Shipping Policy',
    description:
      doc?.seoDescription?.trim() ||
      'How your order is packed, dispatched and delivered, and what happens if a PIN code is not serviceable.',
    path: '/shipping-policy',
  });
}

export default async function ShippingPolicyPage() {
  const [content, shipping] = await Promise.all([
    safeContent(['policies_shipping']),
    getShippingConfig().catch(() => ({ ...SHIPPING_DEFAULTS }) as never),
  ]);

  const doc = content.policies_shipping ?? null;

  /*
   * Shipping charges are read from live configuration rather than written into
   * the copy, so the policy can never contradict what the pricing engine
   * actually charges. When shipping is switched off we say so instead of
   * describing a service that does not exist yet.
   */
  const charges = shipping.shippingEnabled
    ? [
        {
          heading: 'Shipping charges',
          body:
            shipping.weightBasedShipping
              ? `Shipping is calculated from the weight of your parcel at ₹${
                  shipping.weightRatePaisePerKg / 100
                } per kg` +
                (shipping.handlingPaise > 0
                  ? `, plus a handling charge of ₹${shipping.handlingPaise / 100}.`
                  : '.') +
                ' The exact figure is shown in your cart before you pay.'
              : `A flat shipping charge of ₹${shipping.flatShippingPaise / 100} applies to orders.` +
                (shipping.freeShippingEnabled && shipping.freeShippingThresholdPaise
                  ? ` Orders above ₹${shipping.freeShippingThresholdPaise / 100} ship free.`
                  : ''),
          verified: true,
        },
      ]
    : [];

  const serviceability: Array<{ heading: string; body: string; verified: boolean }> = shipping
    .shippingEnabled
    ? [
        {
          heading: 'Checking your PIN code',
          body:
            shipping.serviceabilityMode === 'DISABLED'
              ? 'Enter your PIN code on any product page and we will tell you whether we can deliver there. Where the courier has not given us a definite answer, we will say so rather than guess — you can still place the order and we will contact you if there is a problem.'
              : 'Enter your PIN code on any product page and we will check it against live courier data before you pay.',
          verified: true,
        },
        {
          heading: 'If your PIN code is not serviceable',
          body: shipping.unserviceableMessage,
          verified: true,
        },
      ]
    : [];

  const liveSections = [...charges, ...serviceability];

  return (
    <>
      <ContentPage
        content={doc}
        eyebrow="Policy"
        title="Shipping policy"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Shipping Policy' },
        ]}
        ctaTitle="Shipping question?"
        ctaBody="Tell us your PIN code and we will check it for you."
        updatedAt={doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null}
        sectionsOverride={liveSections}
      />

      {!shipping.shippingEnabled ? (
        <div className="bg-cream-100 pb-14">
          <div className="nc-container">
            <div className="mx-auto max-w-3xl rounded-card border border-ginger-200 bg-ginger-50/70 p-5">
              <p className="text-sm font-semibold text-ginger-700">Current status</p>
              <p className="mt-1.5 text-sm text-ink-soft">{shipping.shippingDisabledMessage}</p>
              <p className="mt-3 text-xs text-ink-muted">
                {shipping.shippingPolicyNote || 'Shipping terms will be published here once they are confirmed.'}
              </p>
              {shipping.flatShippingPaise > 0 ? (
                <p className="mt-2 text-xs text-ink-muted">
                  Configured flat rate so far: {formatINR(shipping.flatShippingPaise)} — not yet live.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : shipping.shippingPolicyNote ? (
        <div className="bg-cream-100 pb-14">
          <div className="nc-container">
            <div className="mx-auto max-w-3xl">
              <Prose>{shipping.shippingPolicyNote}</Prose>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}