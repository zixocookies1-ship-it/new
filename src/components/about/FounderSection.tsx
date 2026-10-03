import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * About page — the people behind Nature's Choice.
 *
 * Only approved facts are stated: the co-founder's name and
 * role, plus the note the merchant has published in the
 * `our_story` content block. No biography is invented, and
 * where no photo has been uploaded yet the tile says so.
 */

const FOUNDER_NAME = 'Vijay Gupta';
const FOUNDER_ROLE = 'Co-founder, Nature’s Choice Jaggery';

export function FounderSection({ content }: { content: ContentDoc | null }) {
  const images = content?.images ?? [];
  const founderImage =
    images.find((img) => img.role === 'founder') ??
    images.find((img) => img.role === 'lifestyle') ??
    images[0] ??
    null;

  const message =
    content?.body?.trim() ||
    'The rule is simple: we only print what we can show you evidence for. That is why there are no invented certifications on this site, no health claims on the label, and no customer quotes we did not receive.\n\nThe fuller story of how the brand started is still being written and will be published here once it is confirmed.';

  return (
    <section
      id="founder"
      className="bg-white py-14 sm:py-20"
      aria-labelledby="founder-heading"
    >
      <div className="nc-container">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 id="founder-heading" className="nc-h2">
              The people behind Nature’s Choice
            </h2>
          </Reveal>
        </div>

        <div className="mt-10 grid items-center gap-10 sm:mt-14 lg:grid-cols-2 lg:gap-16">
          <Reveal delay={60}>
            <div className="overflow-hidden rounded-[1.75rem] border border-cream-300/70 bg-cream-50 shadow-card">
              <OptimizedImage
                media={founderImage}
                alt={
                  founderImage?.alt ||
                  `${FOUNDER_NAME}, ${FOUNDER_ROLE}`
                }
                aspect="4/5"
                fit="cover"
                sizes="(min-width: 1024px) 46vw, 92vw"
                maxWidth={1200}
              />
            </div>
          </Reveal>

          <div>
            <Reveal delay={80}>
              <p className="font-display text-2xl text-jaggery-500">
                {FOUNDER_NAME}
              </p>
              <p className="mt-1 text-sm font-medium text-ink-muted">
                {FOUNDER_ROLE}
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="nc-prose mt-6 max-w-2xl">
                {message.split(/\n+/).map((paragraph, i) => (
                  <p key={`fp-${i}`}>{paragraph}</p>
                ))}
              </div>
            </Reveal>

            {!founderImage ? (
              <Reveal delay={160}>
                <p className="mt-6 max-w-2xl text-sm text-ink-muted">
                  A photo of {FOUNDER_NAME.split(' ')[0]} will appear here
                  once the team has approved one.
                </p>
              </Reveal>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
