import Link from 'next/link';

import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { OptimizedImage } from '@/components/media/OptimizedImage';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';
import { Prose } from '@/components/ui/Prose';
import { Reveal } from '@/components/ui/Reveal';
import { readSections } from '@/lib/content';
import type { MediaRef } from '@/lib/types';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * The shared shape for every long-form, content-driven page:
 * our story, why-natures-choice, FAQ and the five policy pages.
 *
 * Rules enforced here rather than per page:
 *  - copy comes from MongoDB; a missing body renders a visible placeholder
 *  - unconfirmed sections are labelled, never presented as settled policy
 *  - every page ends with a real route to contact, so a customer is never stuck
 */
export function ContentPage({
  content,
  title,
  eyebrow,
  body,
  breadcrumbs,
  fallbackBody,
  ctaTitle = 'Still have a question?',
  ctaBody = 'Ask us directly — a person reads every message.',
  updatedAt,
  showSections = true,
  sectionsOverride,
}: {
  content: ContentDoc | null;
  /** Content value first, then the caller's fallback. */
  title?: string;
  eyebrow?: string;
  body?: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  fallbackBody?: string;
  ctaTitle?: string;
  ctaBody?: string;
  updatedAt?: string | null;
  showSections?: boolean;
  /**
   * Lets a page contribute sections built from live configuration (e.g. the
   * real shipping rates) so the page can never contradict the pricing engine.
   */
  sectionsOverride?: Array<{
    heading: string;
    body: string;
    bullet?: string;
    image?: MediaRef | null;
    verified: boolean;
  }>;
}) {
  const heading = content?.title?.trim() || title || '';
  const kicker = content?.eyebrow?.trim() || eyebrow || '';
  const text = content?.body?.trim() || body || fallbackBody || '';
  const sections = sectionsOverride ?? (showSections ? readSections(content) : []);
  const heroImage = content?.images?.[0] ?? null;
  const hasUnverified = sections.some((s) => !s.verified && s.body);

  return (
    <>
      <div className="bg-cream-100">
        <div className="nc-container py-8 sm:py-12">
          <Breadcrumbs items={breadcrumbs} />

          <header className="mt-6 max-w-3xl">
            {kicker ? <p className="nc-eyebrow mb-3">{kicker}</p> : null}
            <h1 className="nc-h1">{heading}</h1>
            {text ? (
              <p className="nc-lede mt-5 whitespace-pre-line">{text}</p>
            ) : (
              <div className="mt-5">
                <PlaceholderNote label="This page is being written. Please check back shortly." />
              </div>
            )}
          </header>
        </div>
      </div>

      {heroImage ? (
        <div className="nc-container pb-10 sm:pb-14">
          <div className="overflow-hidden rounded-[1.75rem] border border-cream-300/70 bg-white shadow-card">
            <OptimizedImage
              media={heroImage}
              alt={heroImage.alt || heading}
              aspect="21/9"
              fit="cover"
              sizes="(min-width: 1400px) 1344px, 92vw"
              maxWidth={2000}
              priority
            />
          </div>
        </div>
      ) : null}

      <div className="bg-white py-12 sm:py-16">
        <div className="nc-container">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
            <div className="min-w-0">
              {sections.length > 0 ? (
                <div className="space-y-10">
                  {sections.map((section, i) => (
                    <Reveal key={`${section.heading}-${i}`} as="section" className="scroll-mt-28">
                      <div
                        className={
                          section.image
                            ? 'grid items-center gap-6 md:grid-cols-2 md:gap-10'
                            : ''
                        }
                      >
                        <div>
                          {section.heading ? (
                            <h2 className="nc-h3">{section.heading}</h2>
                          ) : null}
                          {section.body ? <Prose className="mt-3">{section.body}</Prose> : null}
                          {section.bullet ? (
                            <p className="mt-3 text-sm font-medium text-ginger-700">{section.bullet}</p>
                          ) : null}
                          {!section.verified ? (
                            <PlaceholderNote
                              compact
                              className="mt-3"
                              label="This section is still being confirmed by the team."
                            />
                          ) : null}
                        </div>

                        {section.image ? (
                          <div className="overflow-hidden rounded-xl2 border border-cream-300/70 bg-cream-50">
                            <OptimizedImage
                              media={section.image}
                              alt={section.image.alt || section.heading}
                              aspect="4/3"
                              fit="cover"
                              sizes="(min-width: 768px) 46vw, 92vw"
                              maxWidth={1200}
                            />
                          </div>
                        ) : null}
                      </div>
                    </Reveal>
                  ))}
                </div>
              ) : text ? (
                <Prose>{text}</Prose>
              ) : null}

              {hasUnverified ? (
                <div className="mt-10 rounded-card border border-dashed border-ginger-300 bg-ginger-50/60 p-5">
                  <p className="text-sm font-semibold text-ginger-700">A note on this page</p>
                  <p className="mt-1.5 text-sm text-ink-soft">
                    Parts of this page are marked as placeholders because we would rather show an
                    obvious gap than a detail we have not confirmed.
                  </p>
                </div>
              ) : null}

              {updatedAt ? (
                <p className="mt-10 text-xs text-ink-faint">
                  Last updated{' '}
                  {new Date(updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              ) : null}
            </div>

            {/* --- Sticky contact panel ----------------------------------- */}
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-card border border-cream-300 bg-cream-50 p-5">
                <h2 className="font-display text-lg text-jaggery-500">{ctaTitle}</h2>
                <p className="nc-body mt-2 text-ink-muted">{ctaBody}</p>
                <div className="mt-4 space-y-2">
                  <ButtonLink href="/contact" variant="accent" fullWidth size="sm">
                    Contact us
                  </ButtonLink>
                  <ButtonLink href="/faq" variant="outline" fullWidth size="sm">
                    Read the FAQ
                  </ButtonLink>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-ink-faint">
                  Policy pages are kept as plain text on purpose — if anything here is unclear, ask
                  us rather than assuming.
                </p>
              </div>
            </aside>
          </div>

          <p className="mt-12 text-sm text-ink-muted">
            Looking for something else?{' '}
            <Link href="/shop" className="nc-link">
              Browse the range
            </Link>{' '}
            or{' '}
            <Link href="/track-order" className="nc-link">
              track an order
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}