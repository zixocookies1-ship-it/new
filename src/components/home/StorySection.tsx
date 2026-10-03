import Link from 'next/link';
import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';
import { Prose } from '@/components/ui/Prose';
import { readSections } from '@/lib/content';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * Section 7 — Our Story / Co-founder.
 *
 * The founder's name and role are known facts and are stated plainly. The
 * biography itself is merchant copy: if it has not been written or confirmed we
 * render a clearly-marked placeholder rather than inventing a personal history.
 */
export function StorySection({ content }: { content: ContentDoc | null }) {
  const body = content?.body?.trim() ?? '';
  const sections = readSections(content);
  const images = content?.images ?? [];
  const founderImage =
    images.find((img) => img.role === 'founder') ??
    images.find((img) => img.role === 'lifestyle') ??
    images[0] ??
    null;

  const paragraphs = sections.filter((s) => s.body && !s.heading).map((s) => s.body);

  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="nc-container grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <Reveal>
          <div className="overflow-hidden rounded-[1.75rem] border border-cream-300/70 bg-cream-50 shadow-card">
            <OptimizedImage
              media={founderImage}
              alt={founderImage?.alt || 'Vijay Gupta, Co-founder of Nature’s Choice Jaggery'}
              aspect="4/5"
              fit="cover"
              sizes="(min-width: 1024px) 40vw, 92vw"
              maxWidth={1200}
            />
          </div>

          <div className="mt-4">
            <p className="font-display text-lg text-jaggery-500">Vijay Gupta</p>
            <p className="text-sm text-ink-muted">Co-founder, Nature’s Choice Jaggery</p>
          </div>
        </Reveal>

        <div>
          {content?.eyebrow?.trim() ? (
            <p className="nc-eyebrow mb-3">{content.eyebrow.trim()}</p>
          ) : null}

          <h2 className="nc-h2">
            {content?.title?.trim() || 'Why we started Nature’s Choice'}
          </h2>

          {body ? (
            <Prose className="mt-5">{body}</Prose>
          ) : paragraphs.length > 0 ? (
            <Prose className="mt-5">{paragraphs.join('\n\n')}</Prose>
          ) : (
            <div className="mt-5">
              <PlaceholderNote label="Our founder’s note is being written and will be published here." />
            </div>
          )}

          {sections.some((s) => !s.verified && s.body) ? (
            <div className="mt-5">
              <PlaceholderNote
                compact
                label="Some detail above is still being confirmed by the team."
              />
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ButtonLink href="/about" variant="primary">
              Read our story
            </ButtonLink>
            <Link href="/contact" className="nc-link text-sm">
              Talk to us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}