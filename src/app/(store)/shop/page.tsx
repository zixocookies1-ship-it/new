import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/seo';
import { getShopData } from '@/lib/catalog';
import { SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { ShopClient } from '@/components/shop/ShopClient';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = (await searchParams) ?? {};
  const { settings } = await getShopData().catch(() => ({
    products: [],
    bundles: [],
    shipping: null as never,
    settings: { ...SETTINGS_DEFAULTS } as never,
  }));

  const q = Array.isArray(sp.q) ? sp.q[0]?.trim() : sp.q?.trim();
  const base = {
    title: q ? `Search: ${q}` : 'Shop',
    description:
      'Classic and roasted sesame (til) chocolatey jaggery. Choose your pack size and order online.',
    path: q ? `/shop?q=${encodeURIComponent(q)}` : '/shop',
  };

  return buildMetadata(settings, base);
}

export default async function ShopPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = (await searchParams) ?? {};
  const query = Array.isArray(sp.q) ? sp.q[0]?.trim() ?? '' : sp.q?.trim() ?? '';

  const data = await getShopData().catch(() => null);

  const products = data?.products ?? [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Shop',
            description: 'Browse Nature’s Choice chocolatey jaggery jars.',
          }),
        }}
      />

      <section className="bg-cream-100 pt-8 pb-16 sm:pt-10 sm:pb-20">
        <div className="nc-container">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="nc-h1">Shop chocolatey jaggery</h1>
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
                The duo bundle brings both flavours together — easy to share, easier to gift. </p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
