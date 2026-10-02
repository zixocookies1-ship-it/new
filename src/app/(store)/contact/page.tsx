import type { Metadata } from 'next';
import Link from 'next/link';

import { ContactForm } from '@/components/contact/ContactForm';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Prose } from '@/components/ui/Prose';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';

import { safeContent } from '@/lib/catalog';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { getShippingConfig, SHIPPING_DEFAULTS } from '@/lib/models/ShippingConfiguration';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never);
  return buildMetadata(settings, {
    title: 'Contact',
    description:
      'Questions about a product, an order or bulk orders? Send us a message — a person reads every one.',
    path: '/contact',
  });
}

export default async function ContactPage() {
  const [content, settings, shipping] = await Promise.all([
    safeContent(['contact']),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
    getShippingConfig().catch(() => ({ ...SHIPPING_DEFAULTS }) as never),
  ]);

  const doc = content.contact ?? null;

  const email = settings.supportEmail?.trim() || '';
  const phone = settings.supportPhone?.trim() || '';
  const address = [
    settings.businessAddressLine1,
    settings.businessAddressLine2,
    settings.businessCity,
    settings.businessState,
    settings.businessPincode,
    settings.businessCountry,
  ]
    .map((l) => l?.trim())
    .filter(Boolean);

  const hasAnyDetail = Boolean(email || phone || address.length || settings.businessHours?.trim());

  return (
    <>
      <div className="bg-cream-100">
        <div className="nc-container py-8 sm:py-12">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />

          <header className="mt-6 max-w-3xl">
            {doc?.eyebrow?.trim() ? <p className="nc-eyebrow mb-3">{doc.eyebrow.trim()}</p> : null}
            <h1 className="nc-h1">{doc?.title?.trim() || 'Talk to us'}</h1>
            <p className="nc-lede mt-5">
              {doc?.body?.trim() ||
                'Questions about a flavour, a pack size, an order or a bulk enquiry — send them over. A person reads every message.'}
            </p>
          </header>
        </div>
      </div>

      <div className="bg-white py-12 sm:py-16">
        <div className="nc-container">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <ContactForm />

            <div className="space-y-6">
              <section className="nc-card p-5 sm:p-6">
                <h2 className="font-display text-lg text-jaggery-500">Other ways to reach us</h2>

                {hasAnyDetail ? (
                  <dl className="mt-4 space-y-4 text-sm">
                    {email ? (
                      <div>
                        <dt className="font-semibold text-ink">Email</dt>
                        <dd className="mt-0.5">
                          <a href={`mailto:${email}`} className="nc-link break-all">
                            {email}
                          </a>
                        </dd>
                      </div>
                    ) : null}

                    {phone ? (
                      <div>
                        <dt className="font-semibold text-ink">Phone</dt>
                        <dd className="mt-0.5">
                          <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="nc-link">
                            {phone}
                          </a>
                        </dd>
                      </div>
                    ) : null}

                    {settings.whatsappNumber?.trim() ? (
                      <div>
                        <dt className="font-semibold text-ink">WhatsApp</dt>
                        <dd className="mt-0.5">{settings.whatsappNumber}</dd>
                      </div>
                    ) : null}

                    {settings.businessHours?.trim() ? (
                      <div>
                        <dt className="font-semibold text-ink">Hours</dt>
                        <dd className="mt-0.5 text-ink-muted">{settings.businessHours}</dd>
                      </div>
                    ) : null}

                    {address.length > 0 ? (
                      <div>
                        <dt className="font-semibold text-ink">Address</dt>
                        <dd className="mt-0.5 text-ink-muted">
                          {address.map((line, i) => (
                            <span key={line + i} className="block">
                              {line}
                            </span>
                          ))}
                        </dd>
                      </div>
                    ) : null}

                    {settings.fssaiNumber?.trim() ? (
                      <div>
                        <dt className="font-semibold text-ink">FSSAI licence</dt>
                        <dd className="mt-0.5 text-ink-muted">{settings.fssaiNumber}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <div className="mt-4">
                    <PlaceholderNote label="Direct contact details have not been published yet." />
                    <p className="mt-3 text-sm text-ink-muted">
                      The form on the left still reaches our inbox — it is the most reliable way to
                      reach us right now.
                    </p>
                  </div>
                )}
              </section>

              {doc?.body ? (
                <section className="nc-card p-5 sm:p-6">
                  <h2 className="font-display text-lg text-jaggery-500">Before you write</h2>
                  <Prose className="mt-3">{doc.body}</Prose>
                </section>
              ) : null}

              <section className="rounded-card border border-cream-300 bg-cream-50 p-5 sm:p-6">
                <h2 className="font-display text-lg text-jaggery-500">Faster answers</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link href="/faq" className="nc-link">
                      Read the FAQ
                    </Link>{' '}
                    <span className="text-ink-muted">— the questions we are asked most.</span>
                  </li>
                  <li>
                    <Link href="/track-order" className="nc-link">
                      Track your order
                    </Link>{' '}
                    <span className="text-ink-muted">— with your order ID and email or mobile.</span>
                  </li>
                  <li>
                    <Link href="/shipping-policy" className="nc-link">
                      Shipping policy
                    </Link>{' '}
                    <span className="text-ink-muted">— including how we check PIN codes.</span>
                  </li>
                  <li>
                    <Link href="/cancellation-refund-return" className="nc-link">
                      Cancellations &amp; refunds
                    </Link>
                  </li>
                </ul>

                {shipping.shippingEnabled ? (
                  <p className="mt-4 border-t border-cream-300 pt-4 text-xs leading-relaxed text-ink-muted">
                    Ordering is live — you can also just place the order and ask us afterwards.
                  </p>
                ) : (
                  <p className="mt-4 border-t border-cream-300 pt-4 text-xs leading-relaxed text-ink-muted">
                    {shipping.shippingDisabledMessage}
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}