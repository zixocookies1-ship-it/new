'use client';

import Link from 'next/link';
import { useState } from 'react';
import clsx from 'clsx';

import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Price } from '@/components/ui/Price';
import { Rating } from '@/components/ui/Rating';
import { useCart } from '@/components/cart/CartProvider';
import type { ProductVM } from '@/lib/catalog';

/**
 * Product card.
 *
 * Design rules enforced here:
 *  - packaging is never cropped (`fit="contain"`, `.nc-product-media`)
 *  - "Add to cart" only appears when the product has a priced, in-stock variant
 *  - no urgency/scarcity language, no invented badges
 */
export function ProductCard({
  product,
  priority = false,
  className = '',
  compact = false,
}: {
  product: ProductVM;
  priority?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);

  // Only in-stock, priced, active variants are addable.
  const addable = product.variants.find((v) => v.inStock && v.pricePaise > 0) ?? null;
  const soldOut = !product.inStock;
  const hasRating = product.rating.count > 0;

  const handleAdd = () => {
    if (!addable || adding) return;
    setAdding(true);
    addItem(
      {
        productId: product.id,
        variantId: addable.id,
        slug: product.slug,
        name: product.name,
        flavour: product.flavour,
        weightLabel: addable.weightLabel,
        imageUrl: product.primaryImage?.url ?? null,
        unitPricePaise: addable.pricePaise,
        mrpPaise: addable.mrpPaise,
      },
      1,
    );
    // Brief feedback; the cart drawer opening is the real confirmation.
    setTimeout(() => setAdding(false), 900);
  };

  return (
    <article
      className={clsx(
        'group nc-card flex flex-col overflow-hidden transition-shadow duration-300 hover:shadow-card-hover',
        className,
      )}
    >
      <Link
        href={`/products/${product.slug}`}
        className="relative block nc-product-media aspect-4/5"
        aria-label={`View ${product.name}`}
      >
        <OptimizedImage
          media={product.primaryImage}
          alt={product.primaryImage?.alt || `${product.name} pack`}
          aspect="4/5"
          fit="contain"
          sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
          priority={priority}
          maxWidth={900}
        />

        {soldOut ? (
          <span className="absolute left-3 top-3 rounded-full bg-jaggery-500/92 px-3 py-1 text-2xs font-bold uppercase tracking-wide text-cream-50 backdrop-blur-sm">
            Sold out
          </span>
        ) : product.isFeatured ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1 text-2xs font-bold uppercase tracking-wide text-jaggery-600 backdrop-blur-sm">
            Featured
          </span>
        ) : null}
      </Link>

      <div className={clsx('flex flex-1 flex-col', compact ? 'gap-2 p-4' : 'gap-3 p-5')}>
        {product.tagline ? (
          <p className="text-2xs font-semibold uppercase tracking-eyebrow text-ginger-600">
            {product.tagline}
          </p>
        ) : null}

        <h3 className={clsx('font-display leading-snug text-jaggery-500', compact ? 'text-base' : 'text-lg')}>
          <Link href={`/products/${product.slug}`} className="hover:text-jaggery-600">
            {product.name}
          </Link>
        </h3>

        {hasRating ? (
          <Rating value={product.rating.average} count={product.rating.count} size="xs" />
        ) : null}

        {!compact ? (
          <p className="nc-body line-clamp-2 flex-1 text-ink-muted">{product.shortDescription}</p>
        ) : null}

        <div className="mt-auto space-y-1">
          {product.variants.length > 1 ? (
            <p className="text-xs text-ink-faint">
              {product.variants.map((v) => v.weightLabel).join(' · ')}
            </p>
          ) : product.variants.length === 1 ? (
            <p className="text-xs text-ink-faint">{product.variants[0].weightLabel}</p>
          ) : null}
          <Price
            pricePaise={product.pricePaise}
            mrpPaise={product.mrpPaise}
            size={compact ? 'sm' : 'md'}
          />
        </div>

        {addable ? (
          <div className="mt-1 space-y-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding}
              className={clsx(
                'nc-btn nc-btn-sm nc-btn-block',
                adding ? 'bg-leaf-600 text-white' : 'nc-btn-primary',
              )}
            >
              {adding ? 'Added ✓' : 'Add to cart'}
            </button>
            <Link
              href={`/checkout?product=${product.slug}&variant=${addable.id}`}
              className="nc-btn nc-btn-accent nc-btn-sm nc-btn-block"
            >
              Buy now
            </Link>
          </div>
        ) : (
          <Link
            href={`/products/${product.slug}`}
            className="nc-btn nc-btn-outline nc-btn-sm nc-btn-block mt-1"
          >
            {soldOut ? 'View details' : 'View details'}
          </Link>
        )}
      </div>
    </article>
  );
}