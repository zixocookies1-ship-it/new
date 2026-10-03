import Link from 'next/link';

import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import { readSections } from '@/lib/content';
import type { ContentDoc } from '@/lib/models/Content';
import type { ProductVM } from '@/lib/catalog';

/**
 * About page — Our Story.
 *
 * The narrative is built only from approved brand facts already in
 * the project (the brand idea, the slow-melt finish, the three
 * flavours, the pack and price). Nothing is invented: no founding
 * dates, no locations, no awards. Where the merchant has written
 * their own note in the `our_story` content block, it is quoted
 * verbatim as the pull-quote.
 */

const STORY_PARAGRAPHS = [
  'Jaggery has a place in Indian kitchens that few ingredients can claim — the sweetener behind chai, festivals and everyday cooking. It has been made the same way for generations: crush the cane, boil the juice down in open pans, and what remains is jaggery.',
  'Nature’s Choice was created with a simple idea — the new age of Indian jaggery. Keep everything that makes jaggery what it is, and give it a finish that suits the way the modern Indian home actually eats. We start with desi jaggery made from unrefined cane juice: nothing refined, nothing bleached, nothing added to lighten the colour. The jaggery is then melted slowly and left to cool into a soft, glossy slab, which rounds off the raw, mineral edge and leaves a deep, chocolatey character on top.',
  'From that one base, three flavours came about. The classic speaks for itself. Roasted sesame — til — is folded in for a nutty, savoury-sweet jar, and cracked whole green cardamom — elaichi — for a warm, floral lift. Every jar is a 500 g pack, priced at ₹249 against an MRP of ₹399, so the whole range is easy to try.',
];

/** The first line of the merchant's own note, used as the pull-quote. */
function pullQuote(content: ContentDoc | null): string {
  const first = (content?.body ?? '').split('\n')[0]?.trim();
  return (
    first ||
    'The rule is simple: we only print what we can show you evidence for.'
  );
}

export function StorySection({
  content,
  products,
}: {
  content: ContentDoc | null;
  products: ProductVM[];
}) {
  // Real brand imagery: the first product's pack shot. Never stock
  // photography — if the catalogue is empty the image simply waits.
  const image = products[0]?.primaryImage ?? null;
  const quote = pullQuote(content);
  const confirmedSections = readSections(content).filter((s) => s.verified);

  return (
    <section className="bg-white py-14 sm:py-20" aria-labelledby="story-heading">
      <div className="nc-container">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 id="story-heading" className="nc-h2">
              Our story
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <p className="nc-lede mt-4">
              From a simple idea to a new way of enjoying jaggery.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 grid items-start gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-14">
          {/* Story copy */}
          <div className="lg:col-span-7">
            {STORY_PARAGRAPHS.map((paragraph, i) => (
              <Reveal key={`p-${i}`} delay={i * 60} className="mb-6">
                <p className="nc-body text-[1.0625rem] leading-relaxed text-ink-soft">
                  {paragraph}
                </p>
              </Reveal>
            ))}

            {confirmedSections.length > 0 ? (
              <Reveal delay={120}>
                <p className="text-sm text-ink-muted">
                  {confirmedSections
                    .map((s) => (s.body ? s.body : ''))
                    .filter(Boolean)
                    .join(' ')}
                </p>
              </Reveal>
            ) : null}
          </div>

          {/* Visual + pull quote */}
          <div className="lg:col-span-5">
            <Reveal delay={80}>
              <div className="overflow-hidden rounded-[1.75rem] border border-cream-300/70 bg-cream-50 shadow-card">
                {image ? (
                  <OptimizedImage
                    media={image}
                    alt={image.alt || 'Desi Chocolatey Jaggery — the classic jar'}
                    aspect="4/5"
                    fit="cover"
                    sizes="(min-width: 1024px) 40vw, 92vw"
                    maxWidth={1200}
                  />
                ) : (
                  <OptimizedImage
                    media={null}
                    alt="Nature’s Choice jaggery"
                    aspect="4/5"
                    fit="cover"
                    sizes="(min-width: 1024px) 40vw, 92vw"
                  />
                )}
              </div>
            </Reveal>

            <Reveal delay={140}>
              <figure className="mt-6 rounded-card border-l-4 border-ginger-500 bg-jaggery-50 p-6">
                <blockquote className="font-display text-lg leading-relaxed text-jaggery-500">
                  “{quote}”
                </blockquote>
                <figcaption className="mt-3 text-sm text-ink-muted">
                  The Nature’s Choice rule
                </figcaption>
              </figure>
            </Reveal>

            <Reveal delay={180}>
              <p className="mt-6 text-sm text-ink-muted">
                Curious about the people?{' '}
                <Link href="#founder" className="nc-link">
                  Meet the co-founder
                </Link>{' '}
                — or{' '}
                <Link href="/shop" className="nc-link">
                  taste the range
                </Link>
                .
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
