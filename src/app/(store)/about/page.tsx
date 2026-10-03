import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import {
  getStorefrontProducts,
  safeContent,
} from '@/lib/catalog';
import {
  getBusinessSettings,
  SETTINGS_DEFAULTS,
} from '@/lib/models/BusinessSettings';
import type { ProductVM } from '@/lib/catalog';

import { StorySection } from '@/components/about/StorySection';
import { WhySection } from '@/components/about/WhySection';
import { FarmToJarSection } from '@/components/about/FarmToJarSection';
import { FounderSection } from '@/components/about/FounderSection';
import { FinalCtaSection } from '@/components/about/FinalCtaSection';

/**
 * About — the complete brand story, on one page.
 *
 * Our Story, Why Nature's Choice, From Farm to Jar, the
 * co-founder and the closing CTA are all sections of this page. There are no
 * separate routes for them.
 */

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [content, settings] = await Promise.all([
    safeContent(['home_hero']),
    getBusinessSettings().catch(
      () => ({ ...SETTINGS_DEFAULTS }) as never,
    ),
  ]);

  return buildMetadata(settings as never, {
    title: 'About',
    description:
      'The Nature’s Choice story — a modern take on a familiar Indian favourite. from farm to jar, with ways to enjoy every jar.',
    path: '/about',
    image: content.home_hero?.images?.[0] ?? '/media/hero-banner.png',
  });
}

export default async function AboutPage() {
  const [content, productsResult, settings] = await Promise.all([
    safeContent(['our_story', 'why_natures_choice', 'home_process']),
    getStorefrontProducts().catch(() => null),
    getBusinessSettings().catch(
      () => ({ ...SETTINGS_DEFAULTS }) as never,
    ),
  ]);

  const products = productsResult?.products ?? [];

  return (
    <div>
      <StorySection
        content={content.our_story ?? null}
        products={products}
      />

      <WhySection content={content.why_natures_choice ?? null} />

      <FarmToJarSection
        content={content.home_process ?? null}
        products={products}
      />

      <FounderSection content={content.our_story ?? null} />

      <FinalCtaSection />
    </div>
  );
}