import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo';
import { getStorefrontProducts } from '@/lib/catalog';
import { connectDb } from '@/lib/db';

/**
 * Sitemap.
 *
 * Only routes that are genuinely public and genuinely exist are listed:
 *  - products come from the database, so an unpublished item is never
 *    advertised to a crawler
 *  - cart / checkout / order / admin are excluded (private or transactional)
 *
 * If MongoDB is unreachable the stable pages are still listed rather than the
 * whole sitemap failing with a 500.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/shop'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/contact'), lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
  ];

  try {
    await connectDb();

    const products = await getStorefrontProducts().catch(() => null);

    const productRoutes: MetadataRoute.Sitemap = (products?.products ?? []).map((p) => ({
      url: absoluteUrl(`/products/${p.slug}`),
      lastModified: p.createdAt ? new Date(p.createdAt) : now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    return [...staticRoutes, ...productRoutes];
  } catch {
    // A sitemap listing only the stable pages beats a 500.
    return staticRoutes;
  }
}
