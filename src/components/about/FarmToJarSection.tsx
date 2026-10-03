import { Fragment } from 'react';
import Link from 'next/link';

import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import type { ContentDoc } from '@/lib/models/Content';
import type { ProductVM } from '@/lib/catalog';

/**
 * About page — From Farm to Jar.
 *
 * A five-step visual chain: Sourced → Prepared → Blended →
 * Packed → Delivered. Each step's text comes from the
 * verified `home_process` content block already seeded for
 * the brand — no invented manufacturing detail. The pack
 * shots below are the real products from the store.
 */

interface ProcessStep {
  name: string;
  text: string;
}

const STEPS: ProcessStep[] = [
  {
    name: 'Sourced',
    text: 'Cane is crushed and the juice is boiled down in open pans to remove the water. That is what produces jaggery rather than sugar.',
  },
  {
    name: 'Prepared',
    text: 'As the juice thickens it is poured into moulds and allowed to set into blocks, then dried.',
  },
  {
    name: 'Blended',
    text: 'The blocks are melted slowly and cooled into a soft, glossy slab — the step that gives our jaggery its chocolatey character. For the til and elaichi jars, roasted sesame or cracked green cardamom is folded in before the slab sets.',
  },
  {
    name: 'Packed',
    text: 'The jars are packed — every jar is a 500 g pack, sealed and ready to travel.',
  },
  {
    name: 'Delivered',
    text: 'The jars are handed to our courier. You get an order ID and a waybill to track — a real, live status rather than an invented delivery date.',
  },
];

export function FarmToJarSection({
  content,
  products,
}: {
  content: ContentDoc | null;
  products: ProductVM[];
}) {
  const description =
    content?.title?.trim() || 'What actually happens before it reaches you.';

  return (
    <section
      className="bg-leaf-600 py-14 text-cream-50 sm:py-20"
      aria-labelledby="process-heading"
    >
      <div className="nc-container">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="text-2xs font-semibold uppercase tracking-eyebrow text-ginger-200">
              Farm to jar
            </p>
          </Reveal>
          <Reveal delay={60}>
            <h2 id="process-heading" className="nc-h2 text-cream-50">
              From farm to jar
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="nc-lede mt-4 text-cream-200/90">{description}</p>
          </Reveal>
        </div>

        {/* Step chain — vertical arrows on mobile, horizontal on desktop */}
        <ol className="mt-12 grid gap-3 lg:mt-14 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-2">
          {STEPS.map((step, i) => (
            <Fragment key={step.name}>
              <Reveal as="li" delay={i * 70} className="flex">
                <div className="flex flex-1 flex-col gap-3 rounded-card border border-cream-50/15 bg-cream-50/[0.06] p-6 backdrop-blur-sm">
                  <span
                    className="font-display text-3xl text-ginger-300"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display text-xl text-cream-50">
                    {step.name}
                  </h3>
                  <p className="nc-body text-cream-200/85">{step.text}</p>
                </div>
              </Reveal>
              {i < STEPS.length - 1 ? (
                <li
                  aria-hidden="true"
                  className="flex items-center justify-center py-1 lg:py-0"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-5 w-5 rotate-90 text-ginger-300 lg:rotate-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
                  </svg>
                </li>
              ) : null}
            </Fragment>
          ))}
        </ol>

        {/* Real pack shots from the store */}
        {products.length > 0 ? (
          <Reveal className="mt-10" delay={120}>
            <div className="grid gap-4 sm:grid-cols-3">
              {products.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className="group rounded-card border border-cream-50/15 bg-white/95 p-3 transition-shadow duration-300 hover:shadow-card-hover"
                >
                  <OptimizedImage
                    media={p.primaryImage}
                    alt={p.primaryImage?.alt || `${p.name} pack`}
                    aspect="4/3"
                    fit="contain"
                    sizes="(min-width: 640px) 33vw, 92vw"
                    maxWidth={800}
                    background="#FFFFFF"
                  />
                  <p className="mt-2 text-center text-xs font-semibold text-jaggery-500">
                    {p.name}
                  </p>
                </Link>
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-cream-200/80">
              Every jar starts from the same slow-set base — then the flavour
              is folded in.
            </p>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
