import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { readCards, readSections } from '@/lib/content';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * Section 4 — Why Nature’s Choice.
 *
 * Reasons-to-believe, not reasons-to-buy. Copy lives in `Content` so the team
 * can revise it; there is no default text asserting anything about sourcing,
 * certifications or health that the business has not written itself.
 */
export function WhySection({ content }: { content: ContentDoc | null }) {
  const cards = readCards(content?.items);
  const sections = readSections(content);
  const points = cards.length
    ? cards.map((c) => ({ title: c.title, text: c.text, verified: true }))
    : sections.map((s) => ({ title: s.heading, text: s.body, verified: s.verified }));

  const image = content?.images?.[0] ?? sections.find((s) => s.image)?.image ?? null;

  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="nc-container grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <div className="overflow-hidden rounded-[1.75rem] border border-cream-300/70 bg-cream-50 shadow-card">
            <OptimizedImage
              media={image}
              alt={image?.alt || content?.title || 'Nature’s Choice jaggery'}
              aspect="4/5"
              fit="cover"
              sizes="(min-width: 1024px) 46vw, 92vw"
              maxWidth={1400}
            />
          </div>
        </Reveal>

        <div>
          <SectionHeading
            align="left"
            as="h2"
            eyebrow={content?.eyebrow?.trim() || 'Why Nature’s Choice'}
            title={content?.title?.trim() || 'Why people keep coming back'}
            className="max-w-none"
          />

          {points.length > 0 ? (
            <ul className="mt-8 space-y-6">
              {points.slice(0, 6).map((point, i) => (
                <Reveal as="li" key={`${point.title}-${i}`} delay={i * 60} className="flex gap-4">
                  <span
                    className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf-50 text-leaf-600"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M10 3v14M3 10h14" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="font-display text-lg text-jaggery-500">{point.title}</h3>
                    {point.text ? (
                      <p className="nc-body mt-1.5 text-ink-muted">{point.text}</p>
                    ) : null}
                  </div>
                </Reveal>
              ))}
            </ul>
          ) : (
            <p className="nc-body mt-6 text-ink-muted">
              Our reasons for choosing this product are being written up. Please check back shortly.
            </p>
          )}

          <div className="mt-8">
            <ButtonLink href="/our-story" variant="outline">
              Read the full story
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}