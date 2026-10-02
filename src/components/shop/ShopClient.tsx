'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/StateBlocks';
import { trackEvent } from '@/lib/analytics';
import type { ProductVM } from '@/lib/catalog';

const FLAVOURS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All flavours' },
  { value: 'classic', label: 'Classic' },
  { value: 'til', label: 'Til (sesame)' },
];

const SORTS: Array<{ value: string; label: string }> = [
  { value: 'featured', label: 'Featured first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name: A–Z' },
];

export function ShopClient({
  products,
  initialQuery = '',
}: {
  products: ProductVM[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [flavour, setFlavour] = useState('all');
  const [sort, setSort] = useState('featured');

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // One view_item_list per filter change, not per card.
  useEffect(() => {
    if (!products.length) return;
    trackEvent({
      name: 'view_item_list',
      items: products.slice(0, 12).map((p) => ({
        item_id: p.variants[0]?.sku ?? p.id,
        item_name: p.name,
        price: p.pricePaise / 100,
        quantity: 1,
        item_brand: "Nature's Choice Jaggery",
        item_category: 'jaggery',
      })),
    });
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => {
      if (flavour !== 'all' && p.flavour !== flavour) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.flavour.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q)
      );
    });

    const sorted = list.slice();
    sorted.sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return a.pricePaise - b.pricePaise;
        case 'price-desc':
          return b.pricePaise - a.pricePaise;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return (
            Number(b.isFeatured) - Number(a.isFeatured) ||
            a.sortOrder - b.sortOrder ||
            a.name.localeCompare(b.name)
          );
      }
    });
    return sorted;
  }, [products, query, flavour, sort]);

  const hasFilters = query.trim().length > 0 || flavour !== 'all' || sort !== 'featured';

  return (
    <div>
      {/* --- Filter bar ---------------------------------------------------- */}
      <div className="nc-card mb-8 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <label htmlFor="shop-search" className="sr-only">
              Search products
            </label>
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="m13.2 13.2 3.3 3.3" strokeLinecap="round" />
            </svg>
            <input
              id="shop-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a flavour…"
              className="nc-input !pl-10"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div>
              <label htmlFor="shop-sort" className="sr-only">
                Sort products
              </label>
              <select
                id="shop-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="nc-input sm:w-52"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FLAVOURS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFlavour(f.value)}
              aria-pressed={flavour === f.value}
              className={clsx(
                'min-h-[38px] rounded-full border px-4 text-[0.8125rem] font-semibold transition-colors',
                flavour === f.value
                  ? 'border-jaggery-500 bg-jaggery-500 text-cream-50'
                  : 'border-cream-400 bg-white text-ink-soft hover:border-jaggery-500/40',
              )}
            >
              {f.label}
            </button>
          ))}

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setFlavour('all');
                setSort('featured');
              }}
              className="ml-1 text-[0.8125rem] font-medium text-ginger-600 underline underline-offset-4"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {/* --- Results ------------------------------------------------------- */}
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
          {filtered.length !== products.length ? ` of ${products.length}` : ''}
        </p>
      </div>

      {filtered.length > 0 ? (
        <ProductGrid products={filtered} columns={3} />
      ) : (
        <EmptyState
          title="Nothing matched that"
          message={
            products.length === 0
              ? 'Our products are being prepared. Please check back shortly.'
              : 'Try a different search term or clear the filters to see the full range.'
          }
          action={{ label: 'Clear filters', href: '/shop' }}
        />
      )}
    </div>
  );
}