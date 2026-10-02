'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import { Logo } from '@/components/brand/Logo';
import { useCart } from '@/components/cart/CartProvider';
import { trackEvent } from '@/lib/analytics';
import { PRIMARY_NAV, ALL_ROUTES } from '@/lib/site';
import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';
import type { MediaRef } from '@/lib/types';

/**
 * Sticky responsive header.
 *
 * Desktop: logo, primary nav, search, account, cart.
 * Mobile: hamburger, logo, search, cart — cart stays permanently visible and
 * thumb-reachable. Body scroll is locked while the drawer is open, and Escape
 * closes it.
 */
export function HeaderBar({ settings }: { settings: BusinessSettingsDoc }) {
  const pathname = usePathname();
  const { count, openDrawer, hydrated } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Close the mobile panel on navigation.
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Condense the header once the page has scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll + Escape to close while open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstLinkRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Simple focus trap.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
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
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 border-b transition-all duration-200 ease-out-soft',
        scrolled
          ? 'border-cream-300/80 bg-cream-100/95 shadow-header backdrop-blur-md'
          : 'border-transparent bg-cream-100',
      )}
    >
      <div className="nc-container">
        <div
          className={clsx(
            'flex items-center justify-between gap-3 transition-all duration-200',
            scrolled ? 'h-[60px] lg:h-[68px]' : 'h-[60px] lg:h-[76px]',
          )}
        >
          {/* Left: hamburger (mobile) / nav (desktop) */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-jaggery-500 transition-colors hover:bg-jaggery-500/[0.06] lg:hidden"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M3.5 7h17M3.5 12h17M3.5 17h11" />
              </svg>
            </button>

            <Logo logo={settings.logo as MediaRef | null} priority className="lg:hidden" />

            <nav aria-label="Primary" className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {PRIMARY_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className={clsx(
                        'relative inline-flex h-11 items-center rounded-full px-3.5 text-[0.875rem] font-medium transition-colors',
                        isActive(item.href)
                          ? 'text-jaggery-500'
                          : 'text-ink-soft hover:text-jaggery-500',
                      )}
                    >
                      {item.label}
                      {isActive(item.href) ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-3.5 -bottom-px h-[2px] rounded-full bg-ginger-500"
                        />
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Centre: logo (desktop) */}
          <div className="hidden flex-1 justify-center lg:flex">
            <Logo logo={settings.logo as MediaRef | null} priority />
          </div>

          {/* Right: actions — cart is always present and thumb-reachable */}
          <div className="flex flex-1 items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-jaggery-500 transition-colors hover:bg-jaggery-500/[0.06]"
              aria-label="Search products"
              aria-expanded={searchOpen}
              aria-controls="header-search"
            >
              <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </button>

            <Link
              href={ALL_ROUTES.trackOrder}
              className="hidden h-11 w-11 items-center justify-center rounded-full text-jaggery-500 transition-colors hover:bg-jaggery-500/[0.06] sm:flex"
              aria-label="Track your order"
            >
              <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5 3.5 16.5v-9Z" />
                <path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" />
              </svg>
            </Link>

            <button
              type="button"
              onClick={openDrawer}
              className="relative -mr-2 flex h-11 items-center gap-1.5 rounded-full px-2.5 text-jaggery-500 transition-colors hover:bg-jaggery-500/[0.06]"
              aria-label={hydrated && count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}
            >
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 7Z" />
                <path d="M8.5 7V5.8a3.5 3.5 0 0 1 7 0V7" />
              </svg>
              {hydrated && count > 0 ? (
                <span
                  className="absolute right-0 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ginger-500 px-1 text-[0.625rem] font-bold text-white tabular-nums"
                  aria-hidden="true"
                >
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {/* Search drawer */}
      <div
        id="header-search"
        hidden={!searchOpen}
        className="border-t border-cream-300/70 bg-cream-50/95 backdrop-blur-md"
      >
        <div className="nc-container py-4">
          <SearchBox autoFocus={searchOpen} onDone={() => setSearchOpen(false)} />
        </div>
      </div>

      {/* Mobile navigation panel */}
      <div
        id="mobile-nav"
        className={clsx(
          'fixed inset-0 z-50 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className={clsx(
            'absolute inset-0 bg-jaggery-900/45 transition-opacity duration-300',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          aria-label="Close menu"
          tabIndex={-1}
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal={mobileOpen}
          aria-label="Site menu"
          className={clsx(
            'absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-cream-50 shadow-2xl transition-transform duration-300 ease-out-soft',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-cream-300 px-5 py-4">
            <Logo logo={settings.logo as MediaRef | null} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-jaggery-500 hover:bg-jaggery-500/[0.06]"
              aria-label="Close menu"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-0.5">
              {PRIMARY_NAV.map((item, i) => (
                <li key={item.href}>
                  <Link
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    tabIndex={mobileOpen ? 0 : -1}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={clsx(
                      'flex min-h-[48px] items-center justify-between rounded-xl px-3.5 text-[0.9375rem] font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-jaggery-50 text-jaggery-500'
                        : 'text-ink-soft hover:bg-cream-200/70',
                    )}
                  >
                    {item.label}
                    <svg viewBox="0 0 16 16" className="h-4 w-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="m6 3 5 5-5 5" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="my-4 h-px bg-cream-300" />

            <ul className="space-y-0.5">
              {[
                { label: 'Track Order', href: ALL_ROUTES.trackOrder },
                { label: 'Your Cart', href: ALL_ROUTES.cart },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    tabIndex={mobileOpen ? 0 : -1}
                    className="flex min-h-[48px] items-center rounded-xl px-3.5 text-[0.875rem] text-ink-soft hover:bg-cream-200/70"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-cream-300 px-5 py-4 nc-safe-bottom">
            <Link
              href="/admin/login"
              tabIndex={mobileOpen ? 0 : -1}
              className="nc-btn-outline nc-btn-sm nc-btn-block"
            >
              Staff sign in
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

function SearchBox({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{ name: string; slug: string; flavour: string; pricePaise: number; imageUrl: string | null }>
  >([]);
  const [state, setState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setState('idle');
      return;
    }
    setState('loading');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('search failed');
        const json = (await res.json()) as {
          ok: boolean;
          data?: { results: typeof results };
        };
        const list = json.data?.results ?? [];
        setResults(list);
        setState(list.length === 0 ? 'empty' : 'idle');
        // Reported here rather than in the API route: this is the only place
        // the debounce has already collapsed a burst of keystrokes into one
        // query, and the only place the consent state is known.
        trackEvent({ name: 'search', term: q, results: list.length });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState('error');
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div>
      <div className="relative">
        <label htmlFor="header-search-input" className="sr-only">
          Search products
        </label>
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          id="header-search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Search flavours, ingredients…"
          autoComplete="off"
          className="nc-input h-12 rounded-full pl-12 pr-4"
        />
      </div>

      <div aria-live="polite" className="mt-3">
        {state === 'loading' ? (
          <p className="px-1 text-xs text-ink-muted">Searching…</p>
        ) : state === 'empty' ? (
          <p className="px-1 text-xs text-ink-muted">
            No products match “{query}”.{' '}
            <Link href="/shop" className="nc-link" onClick={onDone}>
              Browse all products
            </Link>
          </p>
        ) : state === 'error' ? (
          <p className="px-1 text-xs text-[#8F3333]">Search is unavailable right now.</p>
        ) : results.length > 0 ? (
          <ul className="divide-y divide-cream-300 overflow-hidden rounded-xl border border-cream-300 bg-white">
            {results.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/products/${r.slug}`}
                  onClick={onDone}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-cream-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-jaggery-500">{r.name}</span>
                    <span className="block truncate text-xs capitalize text-ink-muted">
                      {r.flavour} flavour
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                    {r.pricePaise > 0 ? `₹${Math.round(r.pricePaise / 100)}` : '—'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-xs text-ink-muted">
            Try “chocolatey”, “til” or “jaggery”.
          </p>
        )}
      </div>
    </div>
  );
}
