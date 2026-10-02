import Link from 'next/link';
import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Price } from '@/components/ui/Price';
import { Rating } from '@/components/ui/Rating';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';
import { formatINR } from '@/lib/money';
import type { ProductVM } from '@/lib/catalog';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * Section 5 — Featured product.
 *
 * Deliberately NOT labelled "Best Seller": we have no verified sales ranking
 * and inventing one would be a fabricated claim. The label used is simply
 * "Featured", which the merchant sets deliberately.
 */
export function FeaturedProductSection({
  content,
  product,
}: {
  content: ContentDoc | null;
  product: ProductVM | null;
}) {
  if (!product) {
    return (
      <section className="bg-cream-100 py-14 sm:py-20">
        <div className="nc-container">
          <SectionHeading title="Featured product" />
          <p className="mt-6 text-center text-sm text-ink-muted">
            Our featured product is being selected. Please check back shortly.
          </p>
        </div>
      </section>
    );
  }

  const cheapest = product.variants
    .filter((v) => v.pricePaise > 0)
    .reduce<ProductVM['variants'][number] | null>(
      (min, v) => (min === null || v.pricePaise < min.pricePaise ? v : min),
      null,
    );

  const bullets = (content?.items ?? [])
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return '';
      const record = raw as Record<string, unknown>;
      const t = (record.title ?? record.text ?? record.bullet ?? '') as string;
      return typeof t === 'string' ? t.trim() : '';
    })
    .filter(Boolean)
    .slice(0, 4);

  return (
    <section className="bg-cream-100 py-14 sm:py-20">
      <div className="nc-container">
        <SectionHeading
          align="center"
          eyebrow={content?.eyebrow?.trim() || 'Featured'}
          title={content?.title?.trim() || product.name}
          description={content?.body?.trim() || product.shortDescription}
        />

        <Reveal className="mt-10 sm:mt-12">
          <div className="nc-card grid overflow-hidden md:grid-cols-2">
            <Link
              href={`/products/${product.slug}`}
              className="nc-product-media aspect-[4/5] md:aspect-auto md:min-h-[26rem]"
              aria-label={`View ${product.name}`}
            >
              <OptimizedImage
                media={product.primaryImage}
                alt={product.primaryImage?.alt || `${product.name} pack`}
                aspect="4/5"
                fit="contain"
                sizes="(min-width: 768px) 50vw, 92vw"
                maxWidth={1200}
              />
            </Link>

            <div className="flex flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10">
              {product.tagline ? <p className="nc-eyebrow">{product.tagline}</p> : null}

              <h3 className="nc-h3 font-display">{product.name}</h3>

              {product.rating.count > 0 ? (
                <Rating value={product.rating.average} count={product.rating.count} size="sm" />
              ) : null}

              <p className="nc-body text-ink-soft">{product.shortDescription}</p>

              {bullets.length > 0 ? (
                <ul className="space-y-2">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-[0.875rem] text-ink-soft">
                      <svg
                        viewBox="0 0 20 20"
                        className="mt-0.5 h-4 w-4 shrink-0 text-leaf-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path d="M4.5 10.5 8 14l7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-1">
                <Price
                  pricePaise={cheapest?.pricePaise ?? product.pricePaise}
                  mrpPaise={cheapest?.mrpPaise ?? product.mrpPaise}
                  size="lg"
                />
                {product.variants.length > 1 && cheapest ? (
                  <p className="mt-1 text-xs text-ink-faint">
                    Across {product.variants.length} pack sizes — starting from{' '}
                    {formatINR(product.pricePaise)}
                  </p>
                ) : null}
              </div>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={`/products/${product.slug}`} variant="accent">
                  {product.inStock ? 'Choose your pack size' : 'View product'}
                </ButtonLink>
                {!product.isVerified ? (
                  <div className="flex items-center">
                    <PlaceholderNote
                      compact
                      label="Product details awaiting final review"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}