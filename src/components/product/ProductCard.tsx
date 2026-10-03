'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import clsx from 'clsx';

import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Price } from '@/components/ui/Price';
import { Rating } from '@/components/ui/Rating';
import { useCart } from '@/components/cart/CartProvider';
import { ALL_ROUTES } from '@/lib/site';
import type { ProductVM } from '@/lib/catalog';

/**
 * Product card.
 *
 * Design rules enforced here:
 *  - packaging is never cropped (`fit="contain"`, `.nc-product-media`)
 *  - "Add to cart" only appears when the product has a priced, in-stock variant
 *  - no urgency/scarcity language, no invented badges
 *
 * Purchase paths:
 *  - "Add to cart" adds the product and leaves the customer exactly where they
 *    are; the shared toast confirms it so they can keep browsing.
 *  - "Buy now" makes this product the checkout item and navigates straight to
 *    checkout, without requiring a trip through the cart first and without
 *    disturbing whatever else is already in the cart.
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
  const router = useRouter();
  const { addItem, buyNow } = useCart();
  const [adding, setAdding] = useState(false);
  const addingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only in-stock, priced, active variants are addable.
  const addable = product.variants.find((v) => v.inStock && v.pricePaise > 0) ?? null;
  const soldOut = !product.inStock;
  const hasRating = product.rating.count > 0;

  const lineFor = (variant: NonNullable<typeof addable>) => ({
    productId: product.id,
    variantId: variant.id,
    slug: product.slug,
    name: product.name,
    flavour: product.flavour,
    weightLabel: variant.weightLabel,
    imageUrl: product.primaryImage?.url ?? null,
    unitPricePaise: variant.pricePaise,
    mrpPaise: variant.mrpPaise,
  });

  const handleAdd = () => {
    if (!addable || adding) return;
    setAdding(true);
    addItem(lineFor(addable), 1);
    // Brief inline feedback; the shared toast carries the confirmation.
    if (addingTimer.current) clearTimeout(addingTimer.current);
    addingTimer.current = setTimeout(() => setAdding(false), 1200);
  };

  const handleBuyNow = () => {
    if (!addable) return;
    buyNow(lineFor(addable), 1);
    router.push(ALL_ROUTES.checkout);
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
            <button
              type="button"
              onClick={handleBuyNow}
              className="nc-btn nc-btn-accent nc-btn-sm nc-btn-block"
            >
              Buy now
            </button>
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