import 'server-only';

import { connectDb } from './db';
import { Product, type ProductDoc } from './models/Product';
import { ProductVariant, type ProductVariantDoc } from './models/ProductVariant';
import { Review, getRatingSummary } from './models/Review';
import { Bundle, computeBundleSavings, type BundleSavings } from './models/Bundle';
import { Content, getContentMap, type ContentDoc } from './models/Content';
import { Faq, type FaqDoc } from './models/Faq';
import { Recipe, type RecipeDoc } from './models/Recipe';
import { getShippingConfig, type ShippingConfigurationDoc } from './models/ShippingConfiguration';
import { getBusinessSettings, type BusinessSettingsDoc } from './models/BusinessSettings';
import { primaryMedia } from './models/media';
import type { ContentKey, MediaRef } from './types';

/* -------------------------------------------------------------------------- */
/* View models                                                                */
/* -------------------------------------------------------------------------- */

export interface VariantVM {
  id: string;
  sku: string;
  weightLabel: string;
  weightGrams: number | null;
  pricePaise: number;
  mrpPaise: number | null;
  inStock: boolean;
  inventory: number;
  lowStock: boolean;
}

export interface ProductVM {
  id: string;
  name: string;
  slug: string;
  flavour: string;
  tagline: string;
  shortDescription: string;
  description: string;
  ingredients: string[];
  allergens: string[];
  nutrition: ProductDoc['nutrition'];
  nutritionPer: ProductDoc['nutritionPer'];
  storage: string;
  shelfLife: string;
  howToUse: string[];
  fssaiNote: string;
  images: MediaRef[];
  primaryImage: MediaRef | null;
  ogImage: MediaRef | null;
  variants: VariantVM[];
  isFeatured: boolean;
  isVerified: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  /** Derived from the cheapest in-stock variant, or 0 when unpriced. */
  pricePaise: number;
  mrpPaise: number | null;
  inStock: boolean;
  rating: { average: number; count: number };
  createdAt: string;
}

export interface BundleVM {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  image: MediaRef | null;
  lines: Array<{
    productId: string;
    variantId: string | null;
    qty: number;
    name: string;
    weightLabel: string;
    imageUrl: string | null;
  }>;
  bundlePricePaise: number;
  savings: BundleSavings;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
}

export interface ReviewVM {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  authorName: string;
  authorLocation: string;
  rating: number;
  title: string;
  body: string;
  isVerifiedPurchase: boolean;
  images: MediaRef[];
  videoUrl: string | null;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

function toVariantVM(v: ProductVariantDoc & { _id: unknown }): VariantVM {
  const inventory = v.inventory ?? 0;
  return {
    id: String(v._id),
    sku: v.sku,
    weightLabel: v.weightLabel,
    weightGrams: v.weightGrams ?? null,
    pricePaise: v.pricePaise,
    mrpPaise: v.mrpPaise ?? null,
    inStock: inventory > 0 && v.isActive,
    inventory,
    lowStock: inventory > 0 && inventory <= (v.lowStockThreshold || 0),
  };
}

function toProductVM(
  p: ProductDoc & { _id: unknown },
  variants: VariantVM[],
  rating: { average: number; count: number },
): ProductVM {
  // `variants` already contains only active variants (query-level filter).
  // "From" price = cheapest priced active variant, or 0 when nothing is priced.
  const prices = variants.map((v) => v.pricePaise).filter((n) => n > 0);
  const pricePaise = prices.length ? Math.min(...prices) : 0;

  const mrps = variants
    .filter((v) => v.pricePaise === pricePaise && v.mrpPaise)
    .map((v) => v.mrpPaise as number);
  const mrpPaise = mrps.length ? Math.max(...mrps) : null;

  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    flavour: p.flavour,
    tagline: p.tagline ?? '',
    shortDescription: p.shortDescription,
    description: p.description,
    ingredients: p.ingredients ?? [],
    allergens: p.allergens ?? [],
    nutrition: p.nutrition ?? [],
    nutritionPer: p.nutritionPer ?? { amount: 100, unit: 'g', label: 'Per 100g' },
    storage: p.storage ?? '',
    shelfLife: p.shelfLife ?? '',
    howToUse: p.howToUse ?? [],
    fssaiNote: p.fssaiNote ?? '',
    images: p.images ?? [],
    primaryImage: primaryMedia(p.images) ?? null,
    ogImage: p.ogImage ?? primaryMedia(p.images) ?? null,
    variants,
    isFeatured: p.isFeatured,
    isVerified: p.isVerified,
    sortOrder: p.sortOrder,
    seoTitle: p.seoTitle || p.name,
    seoDescription: p.seoDescription || p.shortDescription,
    pricePaise,
    mrpPaise,
    inStock: variants.some((v) => v.inStock),
    rating,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Core queries (batch where possible to keep the query count low)            */
/* -------------------------------------------------------------------------- */

export interface StorefrontProducts {
  products: ProductVM[];
  settings: BusinessSettingsDoc;
  shipping: ShippingConfigurationDoc;
}

export async function getStorefrontProducts(): Promise<StorefrontProducts> {
  await connectDb();

  const [productDocs, settings, shipping] = await Promise.all([
    Product.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean().exec(),
    getBusinessSettings(),
    getShippingConfig(),
  ]);

  if (productDocs.length === 0) {
    return { products: [], settings, shipping };
  }

  const productIds = productDocs.map((p) => p._id);

  const [variantDocs, ratings] = await Promise.all([
    ProductVariant.find({ productId: { $in: productIds }, isActive: true })
      .sort({ sortOrder: 1 })
      .lean()
      .exec(),
    getRatingSummary(productIds.map(String)),
  ]);

  const variantsByProduct = new Map<string, VariantVM[]>();
  for (const v of variantDocs) {
    const key = String(v.productId);
    const list = variantsByProduct.get(key) ?? [];
    list.push(toVariantVM(v as ProductVariantDoc & { _id: unknown }));
    variantsByProduct.set(key, list);
  }

  const products = productDocs.map((p) =>
    toProductVM(
      p as ProductDoc & { _id: unknown },
      variantsByProduct.get(String(p._id)) ?? [],
      ratings.get(String(p._id)) ?? { average: 0, count: 0 },
    ),
  );

  return { products, settings, shipping };
}

export async function getProductBySlug(
  slug: string,
): Promise<{ product: ProductVM; settings: BusinessSettingsDoc; shipping: ShippingConfigurationDoc } | null> {
  await connectDb();

  const doc = await Product.findOne({ slug, isActive: true }).lean().exec();
  if (!doc) return null;

  const [variants, ratings, settings, shipping] = await Promise.all([
    ProductVariant.find({ productId: doc._id, isActive: true })
      .sort({ sortOrder: 1 })
      .lean()
      .exec(),
    getRatingSummary([String(doc._id)]),
    getBusinessSettings(),
    getShippingConfig(),
  ]);

  return {
    product: toProductVM(
      doc as ProductDoc & { _id: unknown },
      variants.map((v) => toVariantVM(v as ProductVariantDoc & { _id: unknown })),
      ratings.get(String(doc._id)) ?? { average: 0, count: 0 },
    ),
    settings,
    shipping,
  };
}

export async function getProductsBySlugs(
  slugs: string[],
): Promise<ProductVM[]> {
  if (!slugs.length) return [];
  await connectDb();
  const docs = await Product.find({ slug: { $in: slugs }, isActive: true })
    .sort({ sortOrder: 1 })
    .lean()
    .exec();
  if (!docs.length) return [];

  const [variants, ratings] = await Promise.all([
    ProductVariant.find({
      productId: { $in: docs.map((d) => d._id) },
      isActive: true,
    })
      .sort({ sortOrder: 1 })
      .lean()
      .exec(),
    getRatingSummary(docs.map((d) => String(d._id))),
  ]);

  const byProduct = new Map<string, VariantVM[]>();
  for (const v of variants) {
    const key = String(v.productId);
    const list = byProduct.get(key) ?? [];
    list.push(toVariantVM(v as ProductVariantDoc & { _id: unknown }));
    byProduct.set(key, list);
  }

  return docs.map((d) =>
    toProductVM(
      d as ProductDoc & { _id: unknown },
      byProduct.get(String(d._id)) ?? [],
      ratings.get(String(d._id)) ?? { average: 0, count: 0 },
    ),
  );
}

export async function getActiveBundles(): Promise<BundleVM[]> {
  await connectDb();
  const docs = await Bundle.find({ isActive: true }).sort({ sortOrder: 1 }).lean().exec();
  if (!docs.length) return [];

  const productIds = [...new Set(docs.flatMap((b) => b.lines.map((l) => String(l.productId))))];
  const variantIds = docs
    .flatMap((b) => b.lines.map((l) => (l.variantId ? String(l.variantId) : null)))
    .filter((v): v is string => Boolean(v));

  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).lean().exec(),
    variantIds.length
      ? ProductVariant.find({ _id: { $in: variantIds } }).lean().exec()
      : Promise.resolve([] as (ProductVariantDoc & { _id: unknown })[]),
  ]);

  return docs.map((b) => {
    const lines = b.lines.map((l) => {
      const product = products.find((p) => String(p._id) === String(l.productId));
      const variant = l.variantId
        ? variants.find((v) => String(v._id) === String(l.variantId))
        : null;
      return {
        productId: String(l.productId),
        variantId: l.variantId ? String(l.variantId) : null,
        qty: l.qty,
        name: product?.name ?? 'Product',
        weightLabel: variant?.weightLabel ?? '',
        imageUrl: primaryMedia(product?.images ?? [])?.url ?? null,
        unitPricePaise: variant?.pricePaise ?? 0,
      };
    });

    const individualTotal = lines.reduce((s, l) => s + l.unitPricePaise * l.qty, 0);

    return {
      id: String(b._id),
      name: b.name,
      slug: b.slug,
      shortDescription: b.shortDescription,
      description: b.description ?? '',
      image: b.image ?? primaryMedia(products.find((p) => String(p._id) === String(b.lines[0]?.productId))?.images ?? []) ?? null,
      lines: lines.map(({ productId, variantId, qty, name, weightLabel, imageUrl }) => ({
        productId,
        variantId,
        qty,
        name,
        weightLabel,
        imageUrl,
      })),
      bundlePricePaise: b.bundlePricePaise,
      savings: computeBundleSavings(individualTotal, b.bundlePricePaise),
      sortOrder: b.sortOrder,
      seoTitle: b.seoTitle || b.name,
      seoDescription: b.seoDescription || b.shortDescription,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Reviews — APPROVED only, ever                                              */
/* -------------------------------------------------------------------------- */

export async function getApprovedReviews(limit = 12): Promise<ReviewVM[]> {
  await connectDb();
  const docs = await Review.find({ status: 'APPROVED', permissionConfirmed: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('productId', 'name slug')
    .lean()
    .exec();

  return docs.map((d) => {
    const p = d.productId as unknown as { name?: string; slug?: string } | null;
    return {
      id: String(d._id),
      productId: String(d.productId),
      productName: p?.name ?? '',
      productSlug: p?.slug ?? '',
      authorName: d.authorName,
      authorLocation: d.authorLocation ?? '',
      rating: d.rating,
      title: d.title ?? '',
      body: d.body,
      isVerifiedPurchase: d.isVerifiedPurchase,
      images: d.images ?? [],
      videoUrl: d.videoUrl ?? null,
      createdAt: new Date(d.createdAt).toISOString(),
    };
  });
}

export async function getApprovedReviewsForProduct(
  productId: string,
  limit = 20,
): Promise<ReviewVM[]> {
  await connectDb();
  const docs = await Review.find({
    productId,
    status: 'APPROVED',
    permissionConfirmed: true,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map((d) => ({
    id: String(d._id),
    productId: String(d.productId),
    productName: '',
    productSlug: '',
    authorName: d.authorName,
    authorLocation: d.authorLocation ?? '',
    rating: d.rating,
    title: d.title ?? '',
    body: d.body,
    isVerifiedPurchase: d.isVerifiedPurchase,
    images: d.images ?? [],
    videoUrl: d.videoUrl ?? null,
    createdAt: new Date(d.createdAt).toISOString(),
  }));
}

/* -------------------------------------------------------------------------- */
/* Content / FAQ / Recipes                                                    */
/* -------------------------------------------------------------------------- */

export async function getFaqs(opts: {
  category?: string;
  featuredOnly?: boolean;
  productId?: string;
  limit?: number;
} = {}): Promise<FaqDoc[]> {
  await connectDb();
  const filter: Record<string, unknown> = { isActive: true };
  if (opts.category) filter.category = opts.category;
  if (opts.featuredOnly) filter.isFeatured = true;
  if (opts.productId) filter.productId = opts.productId;

  return Faq.find(filter)
    .sort({ category: 1, order: 1, createdAt: -1 })
    .limit(opts.limit ?? 100)
    .lean()
    .exec();
}

export async function getFaqCategories(): Promise<string[]> {
  await connectDb();
  const rows = await Faq.distinct('category', { isActive: true });
  return rows.filter(Boolean).sort();
}

export async function getActiveRecipes(limit = 12): Promise<RecipeDoc[]> {
  await connectDb();
  return Recipe.find({ isActive: true })
    .sort({ order: 1, createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();
}

export async function getRecipeBySlug(slug: string): Promise<RecipeDoc | null> {
  await connectDb();
  return Recipe.findOne({ slug, isActive: true }).lean().exec();
}

export type ContentMap = Partial<Record<ContentKey, ContentDoc>>;

export async function getContent(keys?: ContentKey[]): Promise<ContentMap> {
  if (keys?.length) {
    await connectDb();
    const docs = await Content.find({ key: { $in: keys } }).lean().exec();
    const map: ContentMap = {};
    for (const d of docs) map[d.key as ContentKey] = d;
    return map;
  }
  return getContentMap();
}

/**
 * Content lookup that never throws.
 *
 * A missing database must degrade the page into its "not written yet" state
 * rather than a 500, so every long-form page reads content through this.
 * The return type stays `ContentMap` so callers can index it by key.
 */
export async function safeContent(keys?: ContentKey[]): Promise<ContentMap> {
  try {
    return await getContent(keys);
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* Homepage bundle                                                            */
/* -------------------------------------------------------------------------- */

export interface HomepageData {
  products: ProductVM[];
  featured: ProductVM | null;
  bundles: BundleVM[];
  reviews: ReviewVM[];
  recipes: RecipeDoc[];
  faqs: FaqDoc[];
  content: Awaited<ReturnType<typeof getContent>>;
  settings: BusinessSettingsDoc;
  shipping: ShippingConfigurationDoc;
  /** True when the catalogue has not been populated yet. */
  isEmptyCatalogue: boolean;
}

/**
 * One pass for the homepage: 1 product query + 1 variant query + 1 rating
 * aggregate + 1 content query + the small supporting reads. Kept deliberately
 * batched so the homepage does not fan out into a dozen round trips.
 */
export async function getHomepageData(): Promise<HomepageData> {
  await connectDb();

  const [
    { products, settings, shipping },
    bundles,
    reviews,
    recipes,
    faqs,
    content,
  ] = await Promise.all([
    getStorefrontProducts(),
    getActiveBundles(),
    getApprovedReviews(6),
    getActiveRecipes(4),
    getFaqs({ featuredOnly: true, limit: 8 }),
    getContent(),
  ]);

  // "Featured Product" — never "Best Seller" without real sales data.
  const featured =
    products.find((p) => p.isFeatured) ??
    products.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0] ??
    null;

  return {
    products,
    featured,
    bundles,
    reviews,
    recipes,
    faqs,
    content,
    settings,
    shipping,
    isEmptyCatalogue: products.length === 0,
  };
}

export async function getShopData() {
  const [{ products, settings, shipping }, bundles] = await Promise.all([
    getStorefrontProducts(),
    getActiveBundles(),
  ]);
  return { products, bundles, settings, shipping };
}

/** Compact list used by the header search. */
export async function searchProducts(query: string, limit = 6): Promise<ProductVM[]> {
  const { products } = await getStorefrontProducts();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.flavour.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q),
    )
    .slice(0, limit);
}
