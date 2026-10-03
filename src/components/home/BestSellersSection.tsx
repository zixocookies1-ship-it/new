import Link from 'next/link';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { Reveal } from '@/components/ui/Reveal';
import type { ProductVM } from '@/lib/catalog';
import type { ContentDoc } from '@/lib/models/Content';

/** Human label for a database flavour slug. */
function flavourLabel(slug: string): string {
  const known: Record<string, string> = {
    classic: 'Classic',
    til: 'Til',
    elaichi: 'Elaichi',
  };
  return known[slug] ?? slug;
}

/**
 * Section 3 — Best Sellers.
 *
 * Renders *every* active product straight from MongoDB, so the homepage can
 * never show fewer products than the shop. The flavour chips are shortcuts into
 * the shop's own filters, which read the same database rows.
 */
export function BestSellersSection({
  content,
  products,
}: {
  content: ContentDoc | null;
  products: ProductVM[];
}) {
  const flavours = products.slice(0, 4);

  return (
    <section id="flavours" className="bg-cream-100 py-14 sm:py-20">
      <div className="nc-container">
        <SectionHeading
          eyebrow={content?.eyebrow?.trim() || 'Best sellers'}
          title={content?.title?.trim() || 'Our best sellers'}
          description={
            content?.body?.trim() ||
            'Every flavour we make, in one place. Pick your pack size and order online.'
          }
          as="h2"
          className="[&_h2]:!text-3xl sm:[&_h2]:!text-4xl"
        />

        {products.length > 0 ? (
          <>
            <Reveal className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/shop"
                className="nc-btn nc-btn-sm rounded-full bg-jaggery-500 text-cream-50 hover:bg-jaggery-600"
              >
                All flavours
              </Link>
              {flavours.map((p) => (
                <Link
                  key={p.id}
                  href={`/shop?f=${encodeURIComponent(p.flavour)}`}
                  className="nc-btn nc-btn-outline nc-btn-sm rounded-full"
                >
                  {flavourLabel(p.flavour)}
                </Link>
              ))}
            </Reveal>

            <Reveal className="mt-8 sm:mt-10">
              <ProductGrid products={products} columns={products.length >= 3 ? 3 : 2} />
            </Reveal>
          </>
        ) : (
          <p className="mt-10 text-center text-sm text-ink-muted">
            Our products are being listed. Please check back shortly.
          </p>
        )}

        <div className="mt-10 flex justify-center">
          <ButtonLink href="/shop" variant="outline">
            View the full range
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
