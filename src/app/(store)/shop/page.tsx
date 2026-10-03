import type { Metadata } from 'next';
import Link from 'next/link';
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
      'Classic, roasted sesame (til) and cardamom (elaichi) chocolatey jaggery. 500 g packs — MRP ₹399, now ₹249.',
    path: q ? `/shop?q=${encodeURIComponent(q)}` : '/shop',
  };

  return buildMetadata(settings, base);
}

export default async function ShopPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = (await searchParams) ?? {};
  const query = Array.isArray(sp.q) ? sp.q[0]?.trim() ?? '' : sp.q?.trim() ?? '';
  const flavourParam = Array.isArray(sp.f) ? sp.f[0]?.trim() ?? '' : sp.f?.trim() ?? '';

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
            description: 'Browse Nature’s Choice chocolatey jaggery — classic, til and elaichi.',
          }),
        }}
      />

      <section className="bg-cream-100 pt-8 pb-16 sm:pt-10 sm:pb-20">
        <div className="nc-container">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="nc-h1">Shop chocolatey jaggery</h1>
            <p className="nc-lede mt-4">
              Three flavours, 500 g each. MRP ₹399 — now ₹249. Pick one and we will take it from
              there.
            </p>
          </div>

          <div className="mt-8 sm:mt-10">
            <ShopClient
              products={products}
              initialQuery={query}
              initialFlavour={flavourParam}
            />
          </div>

          {data && data.bundles.length > 0 ? (
            <div className="mt-12 rounded-card border border-cream-300 bg-white p-6 text-center shadow-card">
              <h2 className="font-display text-xl text-jaggery-500">Looking for the pair?</h2>
              <p className="nc-body mt-2 text-ink-muted">
                The duo bundle brings two flavours together — easy to share, easier to gift.
              </p>
              <Link href="#flavours" className="nc-btn nc-btn-primary mt-6">
                Add a second pack
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
