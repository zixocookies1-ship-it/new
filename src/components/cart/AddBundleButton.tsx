'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useCart } from '@/components/cart/CartProvider';
import { trackEvent } from '@/lib/analytics';
import { formatINR } from '@/lib/money';

export interface BundleCartItem {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  flavour: string;
  weightLabel: string;
  imageUrl: string | null;
  unitPricePaise: number;
  mrpPaise: number | null;
  qty: number;
}

/**
 * Adds a configured bundle to the cart as a single line.
 *
 * The bundle price itself is never taken from the client — the cart quotes
 * `/api/cart/quote` with just the bundle id, so a tampered payload cannot buy
 * a bundle at a price the server did not agree to.
 */
export function AddBundleButton({
  bundleId,
  name,
  items,
  variant = 'accent',
  className = '',
  label = 'Add the trio to cart',
}: {
  bundleId: string;
  name: string;
  items: BundleCartItem[];
  variant?: 'accent' | 'primary' | 'outline';
  className?: string;
  label?: string;
}) {
  const { addBundle } = useCart();
  const [added, setAdded] = useState(false);

  const handle = () => {
    if (!items.length) return;
    addBundle({ bundleId, name, items }, 1);
    trackEvent({
      name: 'select_promotion',
      promotion_name: name,
      value: items.reduce((s, i) => s + i.unitPricePaise, 0) / 100,
      currency: 'INR',
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const cls = {
    accent: 'nc-btn-accent',
    primary: 'nc-btn-primary',
    outline: 'nc-btn-outline',
  }[variant];

  return (
    <button
      type="button"
      onClick={handle}
      disabled={items.length === 0}
      className={clsx(cls, 'nc-btn', className)}
    >
      {added ? 'Added ✓' : label}
    </button>
  );
}

export function BundlePrice({
  pricePaise,
  savingsPaise,
  individualTotalPaise,
  className = '',
}: {
  pricePaise: number;
  savingsPaise: number;
  individualTotalPaise: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="font-semibold tabular-nums text-jaggery-500 text-2xl">
        {pricePaise > 0 ? formatINR(pricePaise) : 'Price to be announced'}
      </p>
      {savingsPaise > 0 ? (
        <p className="mt-1 text-sm text-ink-muted">
          Individual total {formatINR(individualTotalPaise)} — you save{' '}
          <span className="font-semibold text-leaf-600">{formatINR(savingsPaise)}</span>
        </p>
      ) : pricePaise > 0 && pricePaise === individualTotalPaise ? (
        <p className="mt-1 text-sm text-ink-muted">Same price as buying the three separately.</p>
      ) : pricePaise > 0 ? (
        <p className="mt-1 text-sm text-ink-muted">
          Individual total {formatINR(individualTotalPaise)}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">Bundle pricing will be announced shortly.</p>
      )}
    </div>
  );
}