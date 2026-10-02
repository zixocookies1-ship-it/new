import type { Metadata } from 'next';
import Link from 'next/link';

import { Accordion } from '@/components/ui/Accordion';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/StateBlocks';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';
import { Prose } from '@/components/ui/Prose';

import { getFaqCategories, getFaqs, safeContent } from '@/lib/catalog';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import type { FaqDoc } from '@/lib/models/Faq';
import { buildMetadata, faqJsonLd, jsonLdScript } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never);
  return buildMetadata(settings, {
    title: 'FAQ',
    description:
      'Answers about our jaggery, pack sizes, delivery, payments, refunds and how to get in touch.',
    path: '/faq',
  });
}

export default async function FaqPage() {
  const [faqs, categories, content, settings] = await Promise.all([
    getFaqs({ limit: 200 }).catch(() => [] as FaqDoc[]),
    getFaqCategories().catch(() => [] as string[]),
    safeContent(['home_faq']),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
  ]);

  const doc = content.home_faq ?? null;
  const heading = doc?.title?.trim() || 'Frequently asked questions';
  const intro = doc?.body?.trim() || '';

  // Group by category, preserving the operator-defined order within each group.
  const groups = categories
    .map((category) => ({
      category,
      items: faqs.filter((f) => f.category === category),
    }))
    .filter((g) => g.items.length > 0);

  const ungrouped = faqs.filter((f) => !categories.includes(f.category));
  if (ungrouped.length) groups.push({ category: 'More', items: ungrouped });

  const jsonLd = faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.answer })));

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      ) : null}

      <div className="bg-cream-100">
        <div className="nc-container py-8 sm:py-12">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'FAQ' }]} />

          <header className="mt-6 max-w-3xl">
            {doc?.eyebrow?.trim() ? <p className="nc-eyebrow mb-3">{doc.eyebrow.trim()}</p> : null}
            <h1 className="nc-h1">{heading}</h1>
            {intro ? (
              <p className="nc-lede mt-5">{intro}</p>
            ) : (
              <div className="mt-5">
                <PlaceholderNote label="FAQ introduction is being written." />
              </div>
            )}
          </header>

          {groups.length > 1 ? (
            <nav aria-label="FAQ categories" className="mt-8">
              <ul className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <li key={group.category}>
                    <a
                      href={`#faq-${slugify(group.category)}`}
                      className="inline-flex min-h-[38px] items-center rounded-full border border-cream-400 bg-white px-4 text-[0.8125rem] font-semibold text-ink-soft transition-colors hover:border-jaggery-500/40 hover:text-jaggery-500"
                    >
                      {group.category}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>

      <div className="bg-white py-12 sm:py-16">
        <div className="nc-container">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
            <div className="min-w-0 space-y-12">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <section key={group.category} id={`faq-${slugify(group.category)}`} className="scroll-mt-28">
                    <h2 className="nc-h3 mb-5">{group.category}</h2>
                    <Accordion
                      items={group.items.map((faq, i) => ({
                        id: String(faq._id ?? `${group.category}-${i}`),
                        question: faq.question,
                        answer: <Prose>{faq.answer}</Prose>,
                      }))}
                    />
                  </section>
                ))
              ) : (
                <EmptyState
                  title="The FAQ is being written"
                  message="We are putting together answers to the questions customers ask us most. In the meantime, ask us anything through the contact page."
                  action={{ label: 'Contact us', href: '/contact' }}
                />
              )}

              {settings.supportEmail || settings.supportPhone ? (
                <section className="rounded-card border border-cream-300 bg-cream-50 p-6">
                  <h2 className="font-display text-lg text-jaggery-500">Still stuck?</h2>
                  <p className="nc-body mt-1.5 text-ink-muted">
                    Reach us directly — a person reads every message.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {settings.supportEmail ? (
                      <li>
                        <a href={`mailto:${settings.supportEmail}`} className="nc-link">
                          {settings.supportEmail}
                        </a>
                      </li>
                    ) : null}
                    {settings.supportPhone ? (
                      <li>
                        <a
                          href={`tel:${settings.supportPhone.replace(/[^\d+]/g, '')}`}
                          className="nc-link"
                        >
                          {settings.supportPhone}
                        </a>
                      </li>
                    ) : null}
                  </ul>
                  <ButtonLink href="/contact" variant="accent" size="sm" className="mt-4">
                    Contact us
                  </ButtonLink>
                </section>
              ) : (
                <p className="text-sm text-ink-muted">
                  Support contact details have not been published yet —{' '}
                  <Link href="/contact" className="nc-link">
                    the contact form still reaches us
                  </Link>
                  .
                </p>
              )}
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-card border border-cream-300 bg-cream-50 p-5">
                <h2 className="font-display text-lg text-jaggery-500">Quick links</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link href="/shipping-policy" className="nc-link">
                      Shipping policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/cancellation-refund-return" className="nc-link">
                      Cancellation &amp; refunds
                    </Link>
                  </li>
                  <li>
                    <Link href="/track-order" className="nc-link">
                      Track an order
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy-policy" className="nc-link">
                      Privacy policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="nc-link">
                      Terms
                    </Link>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}