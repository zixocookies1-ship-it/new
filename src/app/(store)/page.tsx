import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/seo';
import { getShopData, getStoreCapabilities } from '@/lib/catalog';
import { toPlain } from '@/lib/plain';

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

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const data = await getShopData().catch(() => null);
  const settings = data?.settings ?? null;

  return buildMetadata(settings, { title: 'Home', path: '/' });
}

export default async function HomePage() {
  const data = await getShopData().catch(() => null);

  if (!data) return notFound();

  const { products, featured, bundles, reviews, faqs, recipes, content, settings, shipping } = data;
  const plainSettings = toPlain(settings);
  const capabilities = await getStoreCapabilities();

  return (
    <div>
      <Hero content={content.hero} featured={featured} />
      <TrustStrip content={content.trust} />
      <FlavoursSection content={content.flavours} products={products} />
      <WhySection content={content.why} />
      <FeaturedProductSection content={content.featured} product={featured} capabilities={capabilities} />
      <ProcessSection content={content.process} />
      <StorySection content={content.story} />
      <ReviewsSection content={content.reviews} reviews={reviews} />
      <UgcSection content={content.ugc} />
      <BundleSection content={content.bundle} bundles={bundles} capabilities={capabilities} />
      <RecipesSection content={content.recipes} recipes={recipes} />
      <FaqSection content={content.faq} faqs={faqs} />
      <FinalCtaSection content={content.cta} capabilities={capabilities} settings={plainSettings} />
    </div>
  );
}
