import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/seo';
import { getHomepageData } from '@/lib/catalog';
import { getStoreCapabilities } from '@/lib/integrations';
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
  const data = await getHomepageData().catch(() => null);
  const settings = data?.settings ?? null;
  if (!settings) return buildMetadata(null as any, { title: 'Home', path: '/' } as any);
  return buildMetadata(settings as any, { title: 'Home', path: '/' } as any);
}

export default async function HomePage() {
  const data = await getHomepageData().catch(() => null);
  if (!data) return notFound();
  const { products, featured, bundles, reviews, faqs, recipes, content, settings, shipping } = data as any;
  const plainSettings = toPlain(settings) as any;
  const capabilities = await getStoreCapabilities({
    onlinePaymentEnabled: settings.onlinePaymentEnabled ?? false,
    codEnabled: shipping.codEnabled ?? false,
  });

  return (
    <div>
      <Hero content={content?.hero} featured={featured} settings={plainSettings} capabilities={capabilities} />
      <TrustStrip content={content?.trust} capabilities={capabilities} shipping={shipping} />
      <FlavoursSection content={content?.flavours} products={products} />
      <WhySection content={content?.why} />
      <FeaturedProductSection content={content?.featured} product={featured} />
      <ProcessSection content={content?.process} />
      <StorySection content={content?.story} />
      <ReviewsSection content={content?.reviews} reviews={reviews} />
      <UgcSection content={content?.ugc} settings={plainSettings as any} />
      <BundleSection content={content?.bundle} bundles={bundles} products={products} settings={plainSettings as any} />
      <RecipesSection content={content?.recipes} recipes={recipes} />
      <FaqSection content={content?.faq} faqs={faqs} />
      <FinalCtaSection content={content?.cta} settings={plainSettings as any} />
    </div>
  );
}
