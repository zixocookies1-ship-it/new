import { searchProducts } from '@/lib/catalog';
import { ok, handleRouteError, publicCache, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
// Search varies by query string and reads request headers for rate limiting, so it
// must never be prerendered at build time.
export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * Header search. Returns a compact, cacheable result set.
 *
 * Analytics are *not* fired here. `@/lib/analytics` is a `'use client'` module —
 * importing its `trackEvent` from a route handler yields a client reference that
 * throws the moment it is invoked on the server. The browser already reports the
 * `search` event from `HeaderBar`'s debounced `SearchBox`, which is also where
 * the analytics consent gate is actually known.
 */
export async function GET(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('search', RATE_LIMITS.serviceability.limit, RATE_LIMITS.serviceability.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);

    if (q.length < 2) {
      return ok({ query: q, results: [] }, { headers: publicCache(60) });
    }

    const products = await searchProducts(q, 6);

    return ok(
      {
        query: q,
        results: products.map((p) => ({
          name: p.name,
          slug: p.slug,
          flavour: p.flavour,
          pricePaise: p.pricePaise,
          imageUrl: p.primaryImage?.url ?? null,
        })),
      },
      { headers: publicCache(60) },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
