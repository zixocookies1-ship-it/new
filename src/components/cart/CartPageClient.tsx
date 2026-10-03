'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { useCart } from './CartProvider';
import { formatINR } from '@/lib/money';
import { ALL_ROUTES } from '@/lib/site';
import { OptimizedImage, ImageFallback } from '@/components/media/OptimizedImage';
import { PriceCompact } from '@/components/ui/Price';
import { Alert, Badge, EmptyState, LoadingState } from '@/components/ui/StateBlocks';

/**
 * Full-page cart.
 *
 * The client owns line identity and quantity only. Every amount below comes
 * from `quote`, which the server recomputed from MongoDB — the local snapshot
 * is used solely for the brief moment before the first quote lands.
 */
export function CartPageClient() {
  const {
    items,
    couponCode,
    quote,
    quoteLoading,
    hydrated,
    updateQty,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ ok: boolean; message: string } | null>(null);

  if (!hydrated) {
    return (
      <div className="nc-container py-16">
        <LoadingState title="Loading your cart" rows={4} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="nc-container py-16">
        <EmptyState
          icon={
            <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M10 15h28l-2 24a3 3 0 0 1-3 2.7H15A3 3 0 0 1 12 39L10 15Z" />
              <path d="M18 15v-2.5a6 6 0 0 1 12 0V15" />
            </svg>
          }
          title="Your cart is empty"
          message="Nothing here yet. Have a look at the three flavours and pick the one that sounds good."
          action={{ label: 'Shop all products', href: ALL_ROUTES.shop }}
          secondaryAction={{ label: 'Back to home', href: ALL_ROUTES.home }}
        />
      </div>
    );
  }

  const blocked = Boolean(quote?.issues?.length);
  const fallbackSubtotal = items.reduce((s, i) => s + i.unitPricePaise * i.qty, 0);
  const subtotal = quote?.subtotalPaise ?? fallbackSubtotal;

  async function onApplyCoupon(e: FormEvent) {
    e.preventDefault();
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponMessage(null);
    const res = await applyCoupon(code);
    setCouponMessage(res);
    setCouponBusy(false);
    if (res.ok) setCouponInput('');
  }

  return (
    <div className="nc-container py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        {/* ---------------------------------------------------------------- */}
        {/* Lines                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="nc-h2">Your cart</h1>
            <p className="text-sm text-ink-muted">
              {items.length} {items.length === 1 ? 'line' : 'lines'}
            </p>
          </div>

          {quote?.issues?.length ? (
            <Alert tone="warning" title="Some items need attention" className="mt-6">
              <ul className="mt-1 space-y-0.5">
                {quote.issues.map((issue, i) => (
                  <li key={`${issue.code}-${i}`}>{issue.message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <ul className="mt-6 divide-y divide-cream-300 border-y border-cream-300">
            {items.map((item) => (
              <li key={item.key} className="flex gap-4 py-5 sm:gap-5">
                <Link
                  href={item.bundleId ? ALL_ROUTES.shop : `/products/${item.slug}`}
                  className="shrink-0"
                  aria-label={item.name}
                >
                  {item.imageUrl ? (
                    <OptimizedImage
                      src={item.imageUrl}
                      alt={item.name}
                      aspect="1/1"
                      sizes="96px"
                      maxWidth={200}
                      className="w-20 rounded-xl border border-cream-300 bg-cream-50 sm:w-24"
                    />
                  ) : (
                    <ImageFallback
                      alt={item.name}
                      aspect="1/1"
                      className="w-20 rounded-xl border border-cream-300 sm:w-24"
                    />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg leading-snug text-jaggery-500">
                        <Link
                          href={item.bundleId ? ALL_ROUTES.shop : `/products/${item.slug}`}
                          className="hover:text-jaggery-600"
                        >
                          {item.name}
                        </Link>
                      </h2>
                      <p className="mt-1 text-sm text-ink-muted">
                        {item.bundleName ? 'Bundle' : item.weightLabel}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums text-jaggery-500">
                        <PriceCompact paise={item.unitPricePaise * item.qty} />
                      </p>
                      {item.qty > 1 ? (
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {formatINR(item.unitPricePaise)} each
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <div className="inline-flex items-center rounded-full border border-cream-400 bg-white">
                      <button
                        type="button"
                        onClick={() => updateQty(item.key, item.qty - 1)}
                        disabled={item.qty <= 1}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <path d="M5 10h10" />
                        </svg>
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.key, item.qty + 1)}
                        disabled={item.qty >= 20}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <path d="M10 5v10M5 10h10" />
                        </svg>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        removeItem(item.key);
                      }}
                      className="text-sm font-medium text-ink-muted underline decoration-cream-400 underline-offset-4 transition-colors hover:text-[#8F3333]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Link href={ALL_ROUTES.shop} className="nc-btn-outline">
              Continue shopping
            </Link>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Remove every item from your cart?')) clearCart();
              }}
              className="text-sm font-medium text-ink-faint underline decoration-cream-400 underline-offset-4 hover:text-ink-soft"
            >
              Clear cart
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Summary                                                          */}
        {/* ---------------------------------------------------------------- */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-card border border-cream-300 bg-white p-5 sm:p-6">
            <h2 className="font-display text-lg text-jaggery-500">Order summary</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {quoteLoading && !quote ? (
                    <span className="nc-skeleton inline-block h-4 w-16 rounded" />
                  ) : (
                    <PriceCompact paise={subtotal} />
                  )}
                </dd>
              </div>

              {quote && quote.productDiscountPaise > 0 ? (
                <div className="flex items-center justify-between text-leaf-500">
                  <dt>Product savings</dt>
                  <dd className="font-semibold tabular-nums">−<PriceCompact paise={quote.productDiscountPaise} /></dd>
                </div>
              ) : null}

              {quote && quote.couponDiscountPaise > 0 ? (
                <div className="flex items-center justify-between text-leaf-500">
                  <dt>Coupon ({quote.coupon?.code})</dt>
                  <dd className="font-semibold tabular-nums">−<PriceCompact paise={quote.couponDiscountPaise} /></dd>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Shipping</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {!quote ? (
                    <span className="text-ink-faint">Calculated at checkout</span>
                  ) : quote.shippingPaise === 0 ? (
                    'Free'
                  ) : (
                    formatINR(quote.shippingPaise)
                  )}
                </dd>
              </div>

              {quote && quote.taxPaise > 0 ? (
                <div className="flex items-center justify-between">
                  <dt className="text-ink-soft">Taxes</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    <PriceCompact paise={quote.taxPaise} />
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-cream-300 pt-4">
              <span className="text-sm font-semibold text-ink">Total</span>
              <span className="text-2xl font-semibold tabular-nums text-jaggery-500">
                {quote ? (
                  <PriceCompact paise={quote.totalPaise} />
                ) : (
                  <span className="nc-skeleton inline-block h-6 w-24 rounded" />
                )}
              </span>
            </div>

            {quote && quote.freeShippingThresholdPaise && !quote.freeShippingUnlocked ? (
              <p className="mt-3 text-xs text-ink-soft">
                Add{' '}
                <span className="font-semibold text-ginger-600">
                  {formatINR(quote.freeShippingShortfallPaise)}
                </span>{' '}
                more to qualify for free shipping.
              </p>
            ) : quote?.freeShippingUnlocked ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-leaf-500">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Free shipping applied
              </p>
            ) : null}

            {/* Coupon ---------------------------------------------------- */}
            <div className="mt-6 border-t border-cream-300 pt-5">
              {couponCode && quote?.coupon?.valid ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-soft">
                    Coupon <span className="font-semibold text-ink">{couponCode}</span> applied
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      removeCoupon();
                      setCouponMessage(null);
                    }}
                    className="text-xs font-semibold text-ink-muted underline decoration-cream-400 underline-offset-4 hover:text-[#8F3333]"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={onApplyCoupon}>
                  <label htmlFor="cart-coupon" className="nc-label">
                    Discount code
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="cart-coupon"
                      name="coupon"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      autoComplete="off"
                      spellCheck={false}
                      className="nc-input uppercase"
                      aria-describedby={couponMessage ? 'cart-coupon-message' : undefined}
                    />
                    <button
                      type="submit"
                      disabled={couponBusy || !couponInput.trim()}
                      className="nc-btn-outline shrink-0"
                    >
                      {couponBusy ? 'Checking…' : 'Apply'}
                    </button>
                  </div>
                  {couponMessage ? (
                    <p
                      id="cart-coupon-message"
                      className={`mt-2 text-xs ${couponMessage.ok ? 'text-leaf-500' : 'text-[#8F3333]'}`}
                      role="status"
                    >
                      {couponMessage.message}
                    </p>
                  ) : (
                    <p className="nc-hint mt-2">
                      If we are running a code, it will be applied here.
                    </p>
                  )}
                </form>
              )}
            </div>

            <Link
              href={ALL_ROUTES.checkout}
              className={`nc-btn-accent nc-btn-block mt-6 ${blocked ? 'pointer-events-none opacity-55' : ''}`}
              aria-disabled={blocked}
              tabIndex={blocked ? -1 : undefined}
            >
              Proceed to checkout
            </Link>

            {blocked ? (
              <Badge tone="warning" className="mt-3 w-full justify-center">
                Resolve the items above to continue
              </Badge>
            ) : null}

            <p className="mt-4 text-center text-2xs leading-relaxed text-ink-faint">
              Taxes and shipping are confirmed by the server at checkout. Prices are
              recalculated from our catalogue every time you load this page.
            </p>
          </div>

          <div className="mt-4 rounded-card border border-cream-300 bg-cream-50 p-5">
            <h3 className="font-display text-base text-jaggery-500">Need a hand?</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              Questions about a pack size, a delivery PIN code or an existing order?
              We answer messages ourselves.
            </p>
            <Link href={ALL_ROUTES.contact} className="nc-btn-outline mt-3">
              Contact us
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
