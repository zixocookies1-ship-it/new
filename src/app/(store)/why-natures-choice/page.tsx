import type { Metadata } from 'next';

import { ContentPage } from '@/components/content/ContentPage';
import { safeContent } from '@/lib/catalog';
import { buildMetadata } from '@/lib/seo';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [content, settings] = await Promise.all([
    safeContent(['why_natures_choice']),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
  ]);
  const doc = content.why_natures_choice;

  return buildMetadata(settings, {
    title: doc?.seoTitle?.trim() || 'Why Nature’s Choice',
    description:
      doc?.seoDescription?.trim() ||
      'What we actually mean by “the new age of Indian jaggery” — flavour, consistency and an honest label.',
    path: '/why-natures-choice',
    image: doc?.images?.[0] ?? null,
  });
}

export default async function WhyPage() {
  const content = await safeContent(['why_natures_choice']);
  const doc = content.why_natures_choice ?? null;

  return (
    <ContentPage
      content={doc}
      eyebrow="Why Nature’s Choice"
      title="What we mean by the new age of jaggery"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Why Nature’s Choice' },
      ]}
      ctaTitle="Taste it and decide"
      ctaBody="Pick a flavour, and judge for yourself. That is the whole point."
      updatedAt={doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null}
    />
  );
}