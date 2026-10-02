import { ProductGrid } from '@/components/product/ProductGrid';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { Reveal } from '@/components/ui/Reveal';
import type { ProductVM } from '@/lib/catalog';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * Section 3 — Three flavours.
 *
 * The three-flavour range is a brand fact, so this section renders exactly the
 * products in the database. If the catalogue is empty we say so rather than
 * illustrating three imaginary jars.
 */
export function FlavoursSection({
  content,
  products,
}: {
  content: ContentDoc | null;
  products: ProductVM[];
}) {
  const three = products.slice(0, 2);

  return (
    <section id="flavours" className="bg-cream-100 py-14 sm:py-20">
      <div className="nc-container">
        <SectionHeading
          eyebrow={content?.eyebrow?.trim() || 'Our flavours'}
          title={content?.title?.trim() || 'Two flavours, one base'}
          description={
            content?.body?.trim() ||
            'Classic and roasted sesame (til) — each built on the same jaggery base.'
          }
          as="h2"
          className="[&_h2]:!text-3xl sm:[&_h2]:!text-4xl"
        />

        {three.length > 0 ? (
          <Reveal className="mt-10 sm:mt-12">
            <ProductGrid products={three} columns={2} />
          </Reveal>
        ) : (
          <p className="mt-10 text-center text-sm text-ink-muted">
            Our flavours are being listed. Please check back shortly.
          </p>
        )}

        <div className="mt-10 flex justify-center">
          <ButtonLink href="/shop" variant="outline">
            {three.length > 0 ? 'View the full range' : 'Visit the shop'}
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M4 10h11M11 5.5 15.5 10 11 14.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}