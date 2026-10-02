import { getStorefrontProducts, getActiveBundles } from '@/lib/catalog';
import { ok, handleRouteError, publicCache } from '@/lib/http';

export const runtime = 'nodejs';
export const revalidate = 300;

/**
 * Public product catalogue.
 *
 * Only active products and variants are exposed, and only the fields a
 * storefront needs. Inventory counts are reduced to a boolean so we never leak
 * exact stock levels to competitors.
 */
export async function GET() {
  try {
    const [{ products }, bundles] = await Promise.all([
      getStorefrontProducts(),
      getActiveBundles(),
    ]);

    return ok(
      {
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          flavour: p.flavour,
          tagline: p.tagline,
          shortDescription: p.shortDescription,
          pricePaise: p.pricePaise,
          mrpPaise: p.mrpPaise,
          inStock: p.inStock,
          rating: p.rating,
          image: p.primaryImage?.url ?? null,
          variants: p.variants.map((v) => ({
            id: v.id,
            weightLabel: v.weightLabel,
            pricePaise: v.pricePaise,
            mrpPaise: v.mrpPaise,
            inStock: v.inStock,
          })),
        })),
        bundles: bundles.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          shortDescription: b.shortDescription,
          bundlePricePaise: b.bundlePricePaise,
          savings: b.savings,
        })),
      },
      { headers: publicCache(300) },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
