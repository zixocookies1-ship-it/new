import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo';

/**
 * robots.txt
 *
 * Blocks only what must not be crawled (admin panel, API surface, per-customer
 * order pages). Everything else is allowed — this is a D2C store, the whole point
 * is to be found.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/admin/', '/cart', '/checkout', '/order/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
