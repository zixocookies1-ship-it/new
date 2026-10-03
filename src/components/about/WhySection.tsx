import { Reveal } from '@/components/ui/Reveal';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * About page — Why Nature's Choice.
 *
 * Five reasons-to-believe. Every line is drawn from facts the brand
 * has already published (unrefined cane juice, the slow melt, whole
 * spices, the three flavours, the 500 g pack and its price). No
 * health claims, no "chemical-free", no invented certifications.
 */

interface WhyBlock {
  num: string;
  title: string;
  text: string;
}

const BLOCKS: WhyBlock[] = [
  {
    num: '01',
    title: 'Indian roots',
    text: 'Jaggery needs no introduction in India. It is the sweetener behind chai, desserts and everyday cooking — a familiar favourite at the heart of Indian food culture. Every Nature’s Choice jar starts from that same traditional desi jaggery, so the familiarity is always there underneath the twist.',
  },
  {
    num: '02',
    title: 'A different flavour experience',
    text: 'The difference is the finish. Our jaggery is melted slowly and cooled into a soft, glossy slab, which rounds off the raw edge and leaves a deep, chocolatey character. That one base becomes three flavour combinations — classic, roasted sesame (til) and cracked green cardamom (elaichi).',
  },
  {
    num: '03',
    title: 'Made for the modern home',
    text: 'A jar that fits the way you already eat. Spoon it straight, grate it into a hot drink, spread it on toast or drop it into a dessert — no new techniques, no specialist ingredients. The flavours are built for chai, coffee, breakfast and sweet moments, not for a shelf of rarities.',
  },
  {
    num: '04',
    title: 'Quality & transparency',
    text: 'Our jaggery is made from unrefined cane juice — we do not bleach it, refine it or lighten the colour to make it look uniform. The til is roasted sesame; the elaichi is cracked whole green cardamom, never a powder. And we print only what we can show evidence for: no health claims, no invented certifications, no badges we cannot document.',
  },
  {
    num: '05',
    title: 'Simple enjoyment',
    text: 'Taste it slowly from the jar, stir it through warm milk, or shave it over a dessert. The chocolatey depth works wherever you would reach for jaggery — and the 500 g jar is made to be used, not saved. Every jar is priced at ₹249 against an MRP of ₹399.',
  },
];

export function WhySection({ content }: { content: ContentDoc | null }) {
  const title = content?.title?.trim() || 'Why Nature’s Choice?';
  const description =
    content?.body?.trim() || 'A modern take on a timeless Indian favourite.';

  return (
    <section className="bg-cream-100 py-14 sm:py-20" aria-labelledby="why-heading">
      <div className="nc-container">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 id="why-heading" className="nc-h2">
              {title}
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <p className="nc-lede mt-4">{description}</p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-5 sm:mt-14 sm:grid-cols-2">
          {BLOCKS.slice(0, 4).map((block, i) => (
            <Reveal key={block.num} delay={i * 70} className="h-full">
              <article className="flex h-full flex-col gap-3 rounded-card border border-cream-300/80 bg-white p-6 shadow-card transition-shadow duration-300 hover:shadow-card-hover sm:p-7">
                <span
                  className="font-display text-3xl text-ginger-500"
                  aria-hidden="true"
                >
                  {block.num}
                </span>
                <h3 className="font-display text-xl text-jaggery-500">
                  {block.title}
                </h3>
                <p className="nc-body text-ink-muted">{block.text}</p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* 05 — full-width closing block */}
        <Reveal delay={160} className="mt-5">
          <article className="flex flex-col gap-4 rounded-card border border-cream-300/80 bg-white p-6 shadow-card transition-shadow duration-300 hover:shadow-card-hover sm:flex-row sm:items-start sm:gap-8 sm:p-8">
            <div className="flex items-center gap-4 sm:w-64 sm:shrink-0 sm:flex-col sm:items-start sm:gap-3">
              <span
                className="font-display text-3xl text-ginger-500"
                aria-hidden="true"
              >
                05
              </span>
              <h3 className="font-display text-xl text-jaggery-500">
                {BLOCKS[4].title}
              </h3>
            </div>
            <p className="nc-body max-w-3xl text-ink-muted">
              {BLOCKS[4].text}
            </p>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
