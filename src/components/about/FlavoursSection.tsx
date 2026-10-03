'use client';

import Link from 'next/link';
import { useState } from 'react';

import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Price } from '@/components/ui/Price';
import { Reveal } from '@/components/ui/Reveal';
import { useCart } from '@/components/cart/CartProvider';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';
import type { ProductVM } from '@/lib/catalog';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * About page — Three flavours.
 *
 * Live products from the store: real images, names, descriptions
 * and prices. "Add to cart" adds the item and confirms in place
 * (the cart drawer does NOT open); "Buy now" goes straight to
 * checkout.
 */

/** The flavour combination line, per database flavour slug. */
const COMBOS: Record<string, string> = {
  classic: 'Jaggery × chocolate',
  til: 'Jaggery × chocolate × roasted sesame',
  elaichi: 'Jaggery × chocolate × green cardamom',
};

export function FlavoursSection({
  products,
  content,
}: {
  products: ProductVM[];
  content: ContentDoc | null;
}) {
  const { addItem } = useCart();
  const [addedId, setAddedId] = useState<string | null>(null);

  const handleAdd = (product: ProductVM) => {
    const addable = product.variants.find((v) => v.inStock && v.pricePaise > 0);
    if (!addable) return;

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
      // Stay on the About page — the button itself confirms, so no toast.
      { openDrawer: false, silent: true },
    );

    setAddedId(product.id);
    window.setTimeout(() => {
      setAddedId((current) => (current === product.id ? null : current));
    }, 2000);
  };

  const title = content?.title?.trim() || 'Three flavours. One delicious idea.';
  const description =
    content?.body?.trim() ||
    'The same slow-set chocolatey jaggery, finished three ways — classic, roasted sesame (til) and green cardamom (elaichi).';

  return (
    <section
      className="bg-white py-14 sm:py-20"
      aria-labelledby="flavours-heading"
    >
      <div className="nc-container">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 id="flavours-heading" className="nc-h2">
              {title}
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <p className="nc-lede mt-4">{description}</p>
          </Reveal>
        </div>

        {products.length > 0 ? (
          <div className="mt-12 grid gap-5 sm:mt-14 lg:grid-cols-3">
            {products.slice(0, 3).map((product, i) => {
              const addable = product.variants.find(
                (v) => v.inStock && v.pricePaise > 0,
              );
              const combo = COMBOS[product.flavour] ?? product.tagline;
              const added = addedId === product.id;

              return (
                <Reveal key={product.id} delay={i * 80} className="h-full">
                  <article className="nc-card group flex h-full flex-col overflow-hidden transition-shadow duration-300 hover:shadow-card-hover">
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
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 92vw"
                        maxWidth={900}
                      />
                    </Link>

                    <div className="flex flex-1 flex-col gap-3 p-5">
                      {combo ? (
                        <p className="text-2xs font-semibold uppercase tracking-eyebrow text-ginger-600">
                          {combo}
                        </p>
                      ) : null}

                      <h3 className="font-display text-xl leading-snug text-jaggery-500">
                        <Link
                          href={`/products/${product.slug}`}
                          className="hover:text-jaggery-600"
                        >
                          {product.name}
                        </Link>
                      </h3>

                      {product.tagline ? (
                        <p className="text-sm font-medium text-ink">
                          {product.tagline}
                        </p>
                      ) : null}

                      <p className="nc-body flex-1 text-ink-muted">
                        {product.shortDescription}
                      </p>

                      <div className="mt-auto space-y-1 border-t border-cream-200 pt-3">
                        {product.variants.length === 1 ? (
                          <p className="text-xs text-ink-faint">
                            {product.variants[0].weightLabel}
                          </p>
                        ) : null}
                        <Price
                          pricePaise={product.pricePaise}
                          mrpPaise={product.mrpPaise}
                          size="md"
                        />
                      </div>

                      {addable ? (
                        <div className="mt-1 space-y-2">
                          <button
                            type="button"
                            onClick={() => handleAdd(product)}
                            className={`nc-btn nc-btn-sm nc-btn-block ${
                              added
                                ? 'bg-leaf-600 text-white'
                                : 'nc-btn-primary'
                            }`}
                          >
                            {added ? 'Added to cart ✓' : 'Add to cart'}
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
                          View details
                        </Link>
                      )}
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        ) : (
          <div className="mt-12">
            <PlaceholderNote label="Our three flavours are being listed. Please check back shortly." />
          </div>
        )}
      </div>
    </section>
  );
}
