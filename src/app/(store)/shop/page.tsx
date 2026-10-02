import type { Metadata } from 'next';
import Link from 'next/link';

import { ShopClient } from '@/components/shop/ShopClient';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { getShopData } from '@/lib/catalog';
import { buildMetadata, breadcrumbJsonLd, jsonLdScript } from '@/lib/seo';
import { SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';

export const revalidate = 60;

/** Next.js always hands page props a Promise for `searchParams` (App Router). */
type SearchParams = Promise<{ q?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SearchParams;
}): Promise<Metadata> {
  const sp = (await searchParams) ?? {};
  const { settings } = await getShopData().catch(() => ({
    products: [],
    bundles: [],
    shipping: null as never,
    settings: { ...SETTINGS_DEFAULTS } as never,
  }));

  const q = sp.q?.trim();
  const base = {
    title: q ? `Search: ${q}` : 'Shop',
    description:
      'Classic and roasted sesame (til) chocolatey jaggery. Choose your pack size and order online.',
    path: q ? `/shop?q=${encodeURIComponent(q)}` : '/shop',
  };

  return buildMetadata(settings, base);
}

export default async function ShopPage({ searchParams }: { searchParams?: SearchParams }) {
  const sp = (await searchParams) ?? {};
  const query = sp.q?.trim() ?? '';

  const data = await getShopData().catch(() => null);

  const products = data?.products ?? [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Shop', path: '/shop' },
            ]),
          ),
        }}
      />

      <div className="bg-cream-100">
        <div className="nc-container py-8 sm:py-12">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Shop' },
            ]}
          />

          <div className="mt-6 max-w-2xl">
            <p className="nc-eyebrow mb-3">The full range</p>
            <h1 className="nc-h2">
              {query ? `Results for “${query}”` : 'Every flavour, every pack size'}
            </h1>
            <p className="nc-lede mt-4">
              {query
                ? `${products.length} product${products.length === 1 ? '' : 's'} available.`
                : 'Pick a flavour, pick a size, and we will take it from there.'}
            </p>
          </div>

          <div className="mt-8 sm:mt-10">
            <ShopClient products={products} initialQuery={query} />
          </div>

          {data && data.bundles.length > 0 ? (
            <div className="mt-12 rounded-card border border-cream-300 bg-white p-6 text-center shadow-card">
              <h2 className="font-display text-xl text-jaggery-500">Looking for the pair?</h2>
              <p className="nc-body mt-2 text-ink-muted">
                The duo bundle brings both flavours together — easy to share, easier to gift.
              </p>
              <Link href="/#trio-bundle" className="nc-btn-primary nc-btn-sm mt-4 inline-flex">
                See the trio bundle
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}