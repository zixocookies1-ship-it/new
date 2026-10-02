import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { readSections } from '@/lib/content';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * Section 6 — Farm to Jar (process).
 *
 * The step-by-step story of how the product is made. Each step is merchant
 * copy from `Content.home_process.sections`; unconfirmed steps are labelled as
 * placeholders instead of being presented as established fact.
 */
export function ProcessSection({ content }: { content: ContentDoc | null }) {
  const steps = readSections(content).slice(0, 6);
  const images = content?.images ?? [];
  const body = content?.body?.trim() ?? '';

  return (
    <section className="bg-leaf-500 text-cream-50">
      <div className="nc-container py-14 sm:py-20">
        <SectionHeading
          as="h2"
          eyebrow={content?.eyebrow?.trim() || 'Farm to jar'}
          title={content?.title?.trim() || 'From farm to jar'}
          description={body}
          className="[&_p]:!text-cream-200/90"
        />

        {steps.length > 0 ? (
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, i) => (
              <Reveal
                as="li"
                key={`${step.heading}-${i}`}
                delay={i * 70}
                className="group relative overflow-hidden rounded-card border border-cream-50/15 bg-cream-50/[0.06] p-6 backdrop-blur-sm"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl text-ginger-300">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {step.heading ? (
                    <h3 className="font-display text-xl text-cream-50">{step.heading}</h3>
                  ) : null}
                </div>
                {step.body ? (
                  <p className="nc-body mt-3 text-cream-200/85">{step.body}</p>
                ) : null}
                {step.bullet ? (
                  <p className="mt-3 text-xs font-medium uppercase tracking-eyebrow text-ginger-300">
                    {step.bullet}
                  </p>
                ) : null}
              </Reveal>
            ))}
          </ol>
        ) : null}

        {images.length > 0 ? (
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-3">
            {images.slice(0, 3).map((img, i) => (
              <div
                key={img.publicId || i}
                className="overflow-hidden rounded-card border border-cream-50/15 bg-cream-50/[0.06]"
              >
                <OptimizedImage
                  media={img}
                  alt={img.alt}
                  aspect="3/2"
                  fit="cover"
                  sizes="(min-width: 640px) 33vw, 92vw"
                  maxWidth={1000}
                />
              </div>
            ))}
          </Reveal>
        ) : null}

        {steps.length === 0 ? (
          <p className="mt-10 text-center text-sm text-cream-200/80">
            We are documenting our process step by step. This section will be updated soon.
          </p>
        ) : null}
      </div>
    </section>
  );
}