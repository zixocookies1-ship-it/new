'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import clsx from 'clsx';

import { useCart } from './CartProvider';
import { formatINR } from '@/lib/money';
import { OptimizedImage, ImageFallback } from '@/components/media/OptimizedImage';
import { PriceCompact } from '@/components/ui/Price';
import { Alert, EmptyState, Badge } from '@/components/ui/StateBlocks';
import { trackEvent } from '@/lib/analytics';
import { ALL_ROUTES } from '@/lib/site';

/** Slide-over mini cart. Focus-trapped, Escape-closable, scroll-locked. */
export function CartDrawer() {
  const { items, drawerOpen, closeDrawer, updateQty, removeItem, quote, quoteLoading, hydrated } =
    useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen, closeDrawer]);

  if (!hydrated) return null;

  const subtotal = quote?.subtotalPaise ?? items.reduce((s, i) => s + i.unitPricePaise * i.qty, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  return (
    <>
      <button
        type="button"
        aria-hidden="true"
        onClick={closeDrawer}
        className={clsx(
          'fixed inset-0 z-50 bg-jaggery-900/45 backdrop-blur-[2px] transition-opacity duration-300',
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal={drawerOpen}
        aria-label="Shopping cart"
        className={clsx(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col bg-cream-50 shadow-2xl transition-transform duration-300 ease-out-soft',
          drawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b border-cream-300 px-5 py-4">
          <h2 className="font-display text-lg text-jaggery-500">
            Your cart
            {itemCount > 0 ? (
              <span className="ml-2 text-sm font-sans font-normal text-ink-muted">
                {itemCount} item{itemCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeDrawer}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-jaggery-500 hover:bg-jaggery-500/[0.06]"
            aria-label="Close cart"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {items.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState
                icon={
                  <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M10 15h28l-2 24a3 3 0 0 1-3 2.7H15A3 3 0 0 1 12 39L10 15Z" />
                    <path d="M18 15v-2.5a6 6 0 0 1 12 0V15" />
                  </svg>
                }
                title="Your cart is empty"
                message="Explore our three flavours and find your new favourite way to eat jaggery."
                action={{ label: 'Shop all products', href: ALL_ROUTES.shop }}
              />
            </div>
          ) : (
            <>
              {quote?.issues?.length ? (
                <div className="px-5 pt-4">
                  <Alert tone="warning" title="Some items need attention">
                    <ul className="mt-1 space-y-0.5">
                      {quote.issues.map((issue, i) => (
                        <li key={`${issue.code}-${i}`}>{issue.message}</li>
                      ))}
                    </ul>
                  </Alert>
                </div>
              ) : null}

              <ul className="divide-y divide-cream-300">
                {items.map((item) => (
                  <li key={item.key} className="flex gap-3.5 px-5 py-4">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={closeDrawer}
                      className="shrink-0"
                      aria-label={item.name}
                    >
                      {item.imageUrl ? (
                        <OptimizedImage
                          src={item.imageUrl}
                          alt={item.name}
                          aspect="1/1"
                          sizes="72px"
                          maxWidth={160}
                          className="w-[72px] rounded-lg border border-cream-300 bg-cream-50"
                        />
                      ) : (
                        <ImageFallback
                          alt={item.name}
                          aspect="1/1"
                          className="w-[72px] rounded-lg border border-cream-300"
                        />
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/products/${item.slug}`}
                            onClick={closeDrawer}
                            className="block truncate text-sm font-semibold text-jaggery-500 hover:text-ginger-600"
                          >
                            {item.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {item.bundleName ? 'Bundle' : item.weightLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            trackEvent({
                              name: 'remove_from_cart',
                              items: [
                                {
                                  item_id: item.variantId,
                                  item_name: item.name,
                                  price: item.unitPricePaise / 100,
                                  quantity: item.qty,
                                },
                              ],
                              value: (item.unitPricePaise * item.qty) / 100,
                              currency: 'INR',
                            });
                            removeItem(item.key);
                          }}
                          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-cream-200 hover:text-[#8F3333]"
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                            <path d="m5 5 10 10M15 5 5 15" />
                          </svg>
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-full border border-cream-400 bg-white">
                          <QtyButton
                            label={`Decrease quantity of ${item.name}`}
                            onClick={() => updateQty(item.key, item.qty - 1)}
                            disabled={item.qty <= 1}
                          >
                            <path d="M5 10h10" />
                          </QtyButton>
                          <span
                            className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-ink"
                            aria-live="polite"
                          >
                            {item.qty}
                          </span>
                          <QtyButton
                            label={`Increase quantity of ${item.name}`}
                            onClick={() => updateQty(item.key, item.qty + 1)}
                            disabled={item.qty >= 20}
                          >
                            <path d="M10 5v10M5 10h10" />
                          </QtyButton>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-jaggery-500">
                            <PriceCompact paise={item.unitPricePaise * item.qty} />
                          </p>
                          {item.qty > 1 ? (
                            <p className="text-2xs text-ink-faint">
                              {formatINR(item.unitPricePaise)} each
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {items.length > 0 ? (
          <div className="border-t border-cream-300 bg-white px-5 py-4 nc-safe-bottom">
            {quote && quote.freeShippingThresholdPaise && !quote.freeShippingUnlocked ? (
              <div className="mb-3.5">
                <p className="text-xs text-ink-soft">
                  Add{' '}
                  <span className="font-semibold text-ginger-600">
                    {formatINR(quote.freeShippingShortfallPaise)}
                  </span>{' '}
                  more to unlock free shipping
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-300">
                  <div
                    className="h-full rounded-full bg-ginger-500 transition-all duration-500 ease-out-soft"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (quote.subtotalPaise / quote.freeShippingThresholdPaise) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : quote?.freeShippingUnlocked ? (
              <p className="mb-3.5 flex items-center gap-1.5 text-xs font-medium text-leaf-500">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Free shipping unlocked
              </p>
            ) : null}

            <dl className="space-y-1.5 text-sm">
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
              {quote && quote.couponDiscountPaise > 0 ? (
                <div className="flex items-center justify-between text-leaf-500">
                  <dt>Coupon discount</dt>
                  <dd className="font-semibold tabular-nums">
                    −<PriceCompact paise={quote.couponDiscountPaise} />
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Shipping</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {quote
                    ? quote.shippingPaise === 0
                      ? quote.freeShippingUnlocked
                        ? 'Free'
                        : formatINR(0)
                      : formatINR(quote.shippingPaise)
                    : '—'}
                </dd>
              </div>
            </dl>

            {quote && quote.totalPaise !== subtotal ? (
              <div className="mt-3 flex items-baseline justify-between border-t border-cream-300 pt-3">
                <span className="text-sm font-semibold text-ink">Total</span>
                <span className="text-lg font-semibold tabular-nums text-jaggery-500">
                  {formatINR(quote.totalPaise)}
                </span>
              </div>
            ) : null}

            <Link
              href={ALL_ROUTES.checkout}
              onClick={closeDrawer}
              className="nc-btn-accent nc-btn-block mt-4"
              aria-disabled={Boolean(quote?.issues?.length)}
            >
              Proceed to checkout
            </Link>
            <Link
              href={ALL_ROUTES.cart}
              onClick={closeDrawer}
              className="mt-2.5 block text-center text-xs font-medium text-ink-muted underline decoration-cream-400 underline-offset-4 hover:text-jaggery-500"
            >
              View full cart
            </Link>

            {quote?.issues?.length ? (
              <Badge tone="warning" className="mt-3 w-full justify-center">
                Resolve issues to continue
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function QtyButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-35"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        {children}
      </svg>
    </button>
  );
}
