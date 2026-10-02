import type { Metadata } from 'next';
import Link from 'next/link';

import { Hero } from '@/components/home/Hero';
import { TrustStrip } from '@/components/home/TrustStrip';
import { FlavoursSection } from '@/components/home/FlavoursSection';
import { WhySection } from '@/components/home/WhySection';
import { FeaturedProductSection } from '@/components/home/FeaturedProductSection';
import { ProcessSection } from '@/components/home/ProcessSection';
import { StorySection } from '@/components/home/StorySection';
import { ReviewsSection } from '@/components/home/ReviewsSection';
import { UgcSection } from '@/components/home/UgcSection';
import { BundleSection } from '@/components/home/BundleSection';
import { RecipesSection } from '@/components/home/RecipesSection';
import { FaqSection } from '@/components/home/FaqSection';
import { FinalCtaSection } from '@/components/home/FinalCtaSection';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';

import { getHomepageData } from '@/lib/catalog';
import { getStoreCapabilities } from '@/lib/integrations';
import { buildMetadata } from '@/lib/seo';
import { BRAND } from '@/lib/site';

/**
 * Homepage.
 *
 * Section order is fixed by brand and never re-ordered dynamically:
 *   1 Hero · 2 Trust strip · 3 Three flavours · 4 Why · 5 Featured product
 *   6 Farm to jar · 7 Our story · 8 Reviews · 9 UGC · 10 Trio bundle
 *   11 Recipes · 12 FAQ · 13 Final CTA · 14 Footer (site shell)
 *
 * Every string is database-backed. If the catalogue has not been populated we
 * render one honest setup notice instead of thirteen hollow sections.
 */
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const data = await getHomepageData().catch(() => null);
  const hero = data?.content?.home_hero;

  return buildMetadata(data?.settings ?? fallbackSettings(), {
    title: hero?.seoTitle?.trim() || BRAND.name,
    description: hero?.seoDescription?.trim() || data?.settings?.description || BRAND.defaultDescription,
    path: '/',
    image: hero?.images?.[0] ?? null,
    keywords: [...BRAND.defaultKeywords],
  });
}

/** Minimal settings-shaped object for the metadata path when Mongo is down. */
function fallbackSettings() {
  return {
    brandName: BRAND.name,
    description: BRAND.defaultDescription,
    twitterHandle: BRAND.twitter,
    defaultOgImageUrl: '',
    social: {},
    logo: null,
    supportPhone: '',
    supportEmail: '',
    fssaiNumber: '',
    gstNumber: '',
  } as never;
}

export default async function HomePage() {
  const data = await getHomepageData().catch(() => null);

  if (!data) {
    return (
      <div className="nc-container flex min-h-[60vh] flex-col items-center justify-center gap-5 py-20 text-center">
        <h1 className="nc-h2">We’re almost ready</h1>
        <p className="nc-lede max-w-prose">
          The store catalogue could not be loaded just now. Please refresh in a moment — if it keeps
          happening, use the contact page and we will look into it.
        </p>
        <PlaceholderNote label="Storefront data is unavailable at this moment." />
        <Link href="/contact" className="nc-btn-outline">
          Contact us
        </Link>
      </div>
    );
  }

  const {
    products,
    featured,
    bundles,
    reviews,
    recipes,
    faqs,
    content,
    settings,
    shipping,
    isEmptyCatalogue,
  } = data;

  const capabilities = await getStoreCapabilities({
    onlinePaymentEnabled: settings.onlinePaymentEnabled,
    codEnabled: shipping.codEnabled,
  });

  if (isEmptyCatalogue) {
    return (
      <div className="nc-container flex min-h-[60vh] flex-col items-center justify-center gap-5 py-20 text-center">
        <h1 className="nc-h2">The shelves are being stocked</h1>
        <p className="nc-lede max-w-prose">
          We are putting the finishing touches on the store. Products, prices and photographs will
          appear here as soon as they are live — we would rather show nothing than show something
          untrue.
        </p>
        <PlaceholderNote label="Products have not been published yet." />
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/contact" className="nc-btn-primary">
            Contact us
          </Link>
          <Link href="/our-story" className="nc-btn-outline">
            Read our story
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Hero
        content={content.home_hero ?? null}
        settings={settings}
        capabilities={capabilities}
        featured={featured}
      />
      <TrustStrip content={content.home_trust ?? null} capabilities={capabilities} shipping={shipping} />
      <FlavoursSection content={content.home_three_flavours ?? null} products={products} />
      <WhySection content={content.home_why ?? null} />
      <FeaturedProductSection content={content.home_featured ?? null} product={featured} />
      <ProcessSection content={content.home_process ?? null} />
      <StorySection content={content.home_story ?? null} />
      <ReviewsSection content={content.home_reviews ?? null} reviews={reviews} />
      <UgcSection content={content.home_ugc ?? null} settings={settings} />
      <BundleSection content={content.home_bundle ?? null} bundles={bundles} products={products} />
      <RecipesSection content={content.home_recipes ?? null} recipes={recipes} />
      <FaqSection content={content.home_faq ?? null} faqs={faqs} />
      <FinalCtaSection content={content.home_final_cta ?? null} settings={settings} />
    </>
  );
}