import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/seo';
import { getHomepageData } from '@/lib/catalog';
import { getStoreCapabilities } from '@/lib/integrations';
import { toPlain } from '@/lib/plain';

import { Hero } from '@/components/home/Hero';
import { TrustStrip } from '@/components/home/TrustStrip';
import { BestSellersSection } from '@/components/home/BestSellersSection';
import { WhySection } from '@/components/home/WhySection';
import { ProcessSection } from '@/components/home/ProcessSection';
import { StorySection } from '@/components/home/StorySection';
import { ReviewsSection } from '@/components/home/ReviewsSection';
import { UgcSection } from '@/components/home/UgcSection';
import { BundleSection } from '@/components/home/BundleSection';
import { RecipesSection } from '@/components/home/RecipesSection';
import { FinalCtaSection } from '@/components/home/FinalCtaSection';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const data = await getHomepageData().catch(() => null);
  const settings = (data?.settings ?? null) as any;
  return buildMetadata(settings, { title: 'Home', path: '/' } as any);
}

export default async function HomePage() {
  const data = await getHomepageData().catch(() => null);
  if (!data) return notFound();

  const { products, featured, bundles, reviews, recipes, content, settings, shipping } =
    data as any;
  const plainSettings = toPlain(settings) as any;
  const capabilities = await getStoreCapabilities({
    onlinePaymentEnabled: settings?.onlinePaymentEnabled ?? false,
    codEnabled: shipping?.codEnabled ?? false,
  });

  return (
    <div>
      <Hero
        content={content?.hero}
        featured={featured}
        settings={plainSettings}
        capabilities={capabilities}
      />
      <TrustStrip content={content?.trust} capabilities={capabilities} shipping={shipping} />
      <BestSellersSection content={content?.flavours} products={products} />
      <WhySection content={content?.why} />
      <ProcessSection content={content?.process} />
      <StorySection content={content?.story} />
      <ReviewsSection content={content?.reviews} reviews={reviews} />
      <UgcSection content={content?.ugc} settings={plainSettings} />
      <BundleSection content={content?.bundle} bundles={bundles} products={products} />
      <RecipesSection content={content?.recipes} recipes={recipes} />
      <FinalCtaSection content={content?.cta} settings={plainSettings} />
    </div>
  );
}
