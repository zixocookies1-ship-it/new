import 'server-only';

import type { Metadata } from 'next';
import { BRAND } from './site';
import { publicEnv } from './env';
import { cloudinaryUrl, optimiseStoredUrl } from './cloudinary-url';
import type { MediaRef } from './types';
import type { BusinessSettingsDoc } from './models/BusinessSettings';
import type { ProductVM } from './catalog';

/* -------------------------------------------------------------------------- */
/* URL helpers                                                                */
/* -------------------------------------------------------------------------- */

export function absoluteUrl(path = '/'): string {
  const base = publicEnv.siteUrl.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/* -------------------------------------------------------------------------- */
/* Metadata builder                                                           */
/* -------------------------------------------------------------------------- */

export interface SeoInput {
  title: string;
  description: string;
  path: string;
  image?: MediaRef | string | null;
  type?: 'website' | 'article' | 'product';
  publishedTime?: string;
  noIndex?: boolean;
  keywords?: string[];
}

export function buildMetadata(settings: BusinessSettingsDoc, input: SeoInput): Metadata {
  const url = absoluteUrl(input.path);
  const title = composeTitle(input.title);

  const description = (input.description || BRAND.defaultDescription).slice(0, 320);

  const imageUrl = resolveImage(input.image, settings);

  return {
    // `absolute` stops the root layout's `title.template` from appending the
    // brand a second time — `composeTitle` has already produced the full string.
    title: { absolute: title },
    description,
    keywords: input.keywords?.length ? input.keywords : [...BRAND.defaultKeywords],
    alternates: { canonical: url },
    robots: input.noIndex
      ? { index: false, follow: false, nocache: true }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    openGraph: {
      type: input.type === 'product' ? 'website' : (input.type ?? 'website'),
      title,
      description,
      url,
      siteName: BRAND.name,
      locale: BRAND.locale,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: input.title.trim() || BRAND.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: settings?.twitterHandle || BRAND.twitter,
      images: imageUrl ? [imageUrl] : undefined,
    },
    other: {
      'geo.region': 'IN',
      'geo.placename': 'India',
    },
  };
}

/**
 * Build the final `<title>` string.
 *
 * The homepage and a few content pages supply an `seoTitle` that already names
 * the brand; running those through the template would print the brand name twice
 * ("… | Nature's Choice Jaggery | Nature's Choice Jaggery").
 */
function composeTitle(rawTitle: string): string {
  const raw = rawTitle.trim();
  if (!raw) return `${BRAND.name} — ${BRAND.idea}`;
  if (raw.toLowerCase().includes(BRAND.name.toLowerCase())) return raw;
  return BRAND.titleTemplate.replace('%s', raw);
}

function resolveImage(
  image: MediaRef | string | null | undefined,
  settings: BusinessSettingsDoc,
): string | null {
  if (typeof image === 'string' && image) {
    return optimiseStoredUrl(image, { width: 1200, height: 630, crop: 'cover' });
  }
  if (image && typeof image === 'object' && image.publicId) {
    return cloudinaryUrl(image.publicId, { width: 1200, height: 630, crop: 'cover' });
  }
  if (settings?.defaultOgImageUrl) {
    return optimiseStoredUrl(settings.defaultOgImageUrl, {
      width: 1200,
      height: 630,
      crop: 'cover',
    });
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* JSON-LD structured data                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Organization / brand node.
 * Fields are emitted ONLY when the merchant has actually configured them, so
 * we never publish an invented address, phone number or registration id.
 */
export function organizationJsonLd(settings: BusinessSettingsDoc) {
  const sameAs = [
    settings.social?.instagram,
    settings.social?.facebook,
    settings.social?.youtube,
    settings.social?.x,
    settings.social?.linkedin,
  ].filter(Boolean) as string[];

  const addressParts = [
    settings.businessAddressLine1,
    settings.businessAddressLine2,
    settings.businessCity,
    settings.businessState,
    settings.businessPincode,
    settings.businessCountry,
  ].filter(Boolean);

  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.brandName || BRAND.name,
    url: absoluteUrl('/'),
    description: settings.description || BRAND.defaultDescription,
  };

  if (addressParts.length) {
    node.address = {
      '@type': 'PostalAddress',
      streetAddress: [settings.businessAddressLine1, settings.businessAddressLine2]
        .filter(Boolean)
        .join(', '),
      addressLocality: settings.businessCity,
      addressRegion: settings.businessState,
      postalCode: settings.businessPincode,
      addressCountry: settings.businessCountry || 'IN',
    };
  }
  if (settings.supportPhone) {
    node.contactPoint = [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        telephone: settings.supportPhone,
        email: settings.supportEmail || undefined,
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi'],
      },
    ];
  }
  if (sameAs.length) node.sameAs = sameAs;
  if (settings.fssaiNumber) {
    // Exposed as an additional property rather than a fake "certification".
    node.identifier = { '@type': 'PropertyValue', name: 'FSSAI', value: settings.fssaiNumber };
  }
  if (settings.gstNumber) {
    node.taxID = settings.gstNumber;
  }
  if (settings.logo) {
    node.logo = cloudinaryUrl(settings.logo.publicId, { width: 512, height: 512, crop: 'contain' });
  }

  return node;
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND.name,
    url: absoluteUrl('/'),
    inLanguage: 'en-IN',
    publisher: { '@type': 'Organization', name: BRAND.name },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl('/shop')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Product structured data.
 *
 * Emitted only for a genuinely purchasable product (a live price in the
 * database). `aggregateRating` is attached ONLY when real approved reviews
 * exist — never a synthesised value, and never a rating on a price-less item.
 */
export function productJsonLd(
  product: ProductVM,
  settings: BusinessSettingsDoc,
  opts: { inStock?: boolean } = {},
) {
  const purchasable = product.pricePaise > 0 && product.variants.length > 0;
  if (!purchasable) return null;

  const images = product.images
    .map((img) => cloudinaryUrl(img.publicId, { width: 1200, height: 1200, crop: 'contain' }))
    .filter(Boolean);

  const availability = (opts.inStock ?? product.inStock)
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';

  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    sku: product.variants[0]?.sku,
    url: absoluteUrl(`/products/${product.slug}`),
    brand: { '@type': 'Brand', name: settings.brandName || BRAND.name },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: (product.pricePaise / 100).toFixed(2),
      highPrice: (Math.max(...product.variants.map((v) => v.pricePaise)) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability,
      url: absoluteUrl(`/products/${product.slug}`),
      seller: { '@type': 'Organization', name: settings.brandName || BRAND.name },
    },
  };

  if (images.length) node.image = images;

  // Real reviews only.
  if (product.rating.count > 0 && product.rating.average > 0) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating.average.toFixed(1),
      reviewCount: product.rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return node;
}

export function breadcrumbJsonLd(trail: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}

export function faqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function recipeJsonLd(recipe: {
  title: string;
  excerpt: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: string[];
  steps: string[];
  imageUrl?: string | null;
}) {
  if (!recipe.steps.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.excerpt,
    recipeYield: `${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}`,
    prepTime: `PT${Math.max(0, recipe.prepMinutes)}M`,
    cookTime: `PT${Math.max(0, recipe.cookMinutes)}M`,
    totalTime: `PT${Math.max(0, recipe.prepMinutes + recipe.cookMinutes)}M`,
    recipeCategory: 'Ways to enjoy',
    image: recipe.imageUrl ? [recipe.imageUrl] : undefined,
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.steps.map((s) => ({
      '@type': 'HowToStep',
      text: s,
    })),
  };
}

/** Safely serialise JSON-LD (escapes `<` to prevent script-breakout). */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data, null, 0).replace(/</g, '\\u003c');
}
