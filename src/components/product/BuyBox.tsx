'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';

import { Price } from '@/components/ui/Price';
import { Rating } from '@/components/ui/Rating';
import { Alert, Badge } from '@/components/ui/StateBlocks';
import { PincodeChecker } from './PincodeChecker';
import { useCart } from '@/components/cart/CartProvider';
import { formatINR } from '@/lib/money';
import type { ProductVM, VariantVM } from '@/lib/catalog';

interface BuyBoxProps {
  product: ProductVM;
  /** When checkout is disabled server-side, the CTA becomes an enquiry. */
  canCheckout: boolean;
  shippingEnabled: boolean;
  className?: string;
}

/**
 * Buy box: variant picker, quantity, PIN check, and the primary CTA.
 *
 * Mobile gets a sticky bar pinned to the bottom of the viewport so "Add to
 * cart" is always one thumb-tap away while reading the page.
 */
export function BuyBox({ product, canCheckout, shippingEnabled, className }: BuyBoxProps) {
  const { addItem } = useCart();
  const inStockVariants = useMemo(() => product.variants.filter((v) => v.inStock), [product.variants]);

  const [selectedId, setSelectedId] = useState<string>(
    () => inStockVariants[0]?.id ?? product.variants[0]?.id ?? '',
  );
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const selected: VariantVM | null =
    product.variants.find((v) => v.id === selectedId) ?? inStockVariants[0] ?? null;

  const purchasable = Boolean(selected && selected.inStock && selected.pricePaise > 0);
  const maxQty = selected ? Math.max(1, Math.min(10, selected.inventory || 10)) : 10;

  function add(buyNow = false) {
    if (!selected || !purchasable) return;
    addItem(
      {
        productId: product.id,
        variantId: selected.id,
        slug: product.slug,
        name: product.name,
        flavour: product.flavour,
        weightLabel: selected.weightLabel,
        imageUrl: product.primaryImage?.url ?? null,
        unitPricePaise: selected.pricePaise,
        mrpPaise: selected.mrpPaise,
      },
      qty,
    );
    if (buyNow) return;
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  }

  const ctaDisabled = !purchasable;

  return (
    <div className={className}>
      <div className="space-y-5">
        {product.tagline ? <p className="nc-eyebrow">{product.tagline}</p> : null}

        <h1 className="nc-h1 text-[1.75rem] sm:text-4xl">{product.name}</h1>

        {product.rating.count > 0 ? (
          <Rating value={product.rating.average} count={product.rating.count} size="sm" />
        ) : null}

        <p className="nc-lede">{product.shortDescription}</p>

        {selected ? (
          <Price
            pricePaise={selected.pricePaise}
            mrpPaise={selected.mrpPaise}
            size="lg"
            showFreeShipping={false}
          />
        ) : null}

        {/* --- Variant picker ------------------------------------------- */}
        {product.variants.length > 0 ? (
          <fieldset>
            <legend className="nc-label">
              {product.variants.length > 1 ? 'Choose a pack size' : 'Pack size'}
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {product.variants.map((v) => {
                const active = v.id === selected?.id;
                return (
                  <label
                    key={v.id}
                    className={clsx(
                      'relative flex min-h-[56px] cursor-pointer flex-col justify-center rounded-xl border px-3.5 py-2 transition-all duration-200',
                      active
                        ? 'border-jaggery-500 bg-jaggery-50/70 ring-1 ring-jaggery-500'
                        : 'border-cream-400 bg-white hover:border-cream-500',
                      !v.inStock && 'cursor-not-allowed opacity-55',
                    )}
                  >
                    <input
                      type="radio"
                      name="variant"
                      value={v.id}
                      checked={active}
                      disabled={!v.inStock}
                      onChange={() => {
                        setSelectedId(v.id);
                        setQty(1);
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-ink">{v.weightLabel}</span>
                    <span className="mt-0.5 text-xs tabular-nums text-ink-muted">
                      {v.pricePaise > 0 ? formatINR(v.pricePaise) : 'Price to be announced'}
                    </span>
                    {!v.inStock ? (
                      <span className="absolute right-2 top-2">
                        <Badge tone="neutral">Sold out</Badge>
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {/* --- Quantity ------------------------------------------------- */}
        <div>
          <span className="nc-label" id="qty-label">
            Quantity
          </span>
          <div className="mt-2 inline-flex items-center rounded-full border border-cream-400 bg-white">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, Math.min(maxQty, q - 1)))}
              disabled={qty <= 1}
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-jaggery-500 transition hover:bg-jaggery-500/10 disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span
              className="min-w-[2.5rem] text-center text-base font-semibold tabular-nums text-ink"
              aria-live="polite"
              aria-labelledby="qty-label"
            >
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty}
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-jaggery-500 transition hover:bg-jaggery-500/10 disabled:opacity-40"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          {selected && selected.inventory > 0 && selected.inventory <= 10 ? (
            <p className="nc-hint">Only {selected.inventory} left in stock.</p>
          ) : null}
        </div>

        {/* --- Primary CTA ---------------------------------------------- */}
        <div className="space-y-2">
          {canCheckout && purchasable ? (
            <>
              <button
                type="button"
                onClick={() => add(false)}
                disabled={ctaDisabled}
                className={clsx(
                  'nc-btn-block',
                  justAdded ? 'bg-leaf-600 text-white' : 'nc-btn-primary',
                )}
              >
                {justAdded ? 'Added to cart ✓' : 'Add to cart'}
              </button>
              <button
                type="button"
                onClick={() => add(true)}
                disabled={ctaDisabled}
                className="nc-btn-accent nc-btn-block"
              >
                Buy now
              </button>
            </>
          ) : (
            <Alert tone="warning" title="Ordering is being set up">
              <p>
                Online checkout is not available right now. Please use the contact page and we will
                help you place your order.
              </p>
            </Alert>
          )}
        </div>

        {/* --- Delivery check ------------------------------------------- */}
        {shippingEnabled ? (
          <div className="rounded-xl border border-cream-300 bg-white/70 p-4">
            <PincodeChecker weightGrams={selected?.weightGrams ?? undefined} />
          </div>
        ) : null}

        {/* --- Fact rows ------------------------------------------------- */}
        <dl className="divide-y divide-cream-200 border-y border-cream-200 text-sm">
          {selected?.weightGrams ? (
            <FactRow label="Net weight" value={`${selected.weightGrams} g`} />
          ) : null}
          <FactRow label="SKU" value={selected?.sku ?? '—'} mono />
          {product.shelfLife ? <FactRow label="Shelf life" value={product.shelfLife} /> : null}
          {product.storage ? <FactRow label="Storage" value={product.storage} /> : null}
        </dl>
      </div>

      {/* --- Sticky mobile CTA ------------------------------------------ */}
      <div
        className={clsx(
          'fixed inset-x-0 bottom-0 z-40 border-t border-cream-300 bg-cream-50/95 px-4 py-3 backdrop-blur-sm',
          'nc-safe-bottom lg:hidden',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 shrink-0">
            {selected ? (
              <Price pricePaise={selected.pricePaise} mrpPaise={selected.mrpPaise} size="sm" />
            ) : null}
            <p className="truncate text-2xs text-ink-faint">
              {selected?.weightLabel ?? product.name}
            </p>
          </div>
          {canCheckout && purchasable ? (
            <button
              type="button"
              onClick={() => add(false)}
              className={clsx('flex-1 nc-btn', justAdded ? 'bg-leaf-600 text-white' : 'nc-btn-primary')}
            >
              {justAdded ? 'Added ✓' : 'Add to cart'}
            </button>
          ) : (
            <span className="flex-1 text-center text-sm font-medium text-ink-muted">
              Checkout unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FactRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={clsx('text-right font-medium text-ink', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}