import type { Metadata } from 'next';

import { ContentPage } from '@/components/content/ContentPage';
import { safeContent } from '@/lib/catalog';
import { buildMetadata } from '@/lib/seo';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [content, settings] = await Promise.all([
    safeContent(['our_story']),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
  ]);
  const doc = content.our_story;

  return buildMetadata(settings, {
    title: doc?.seoTitle?.trim() || 'Our Story',
    description:
      doc?.seoDescription?.trim() ||
      'Why Nature’s Choice exists, who is behind it, and how the three flavours came about.',
    path: '/our-story',
    image: doc?.images?.[0] ?? null,
  });
}

export default async function OurStoryPage() {
  const content = await safeContent(['our_story']);
  const doc = content.our_story ?? null;

  return (
    <ContentPage
      content={doc}
      eyebrow="Our story"
      title="How Nature’s Choice started"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Our Story' },
      ]}
      ctaTitle="Want the short version?"
      ctaBody="Read why people keep coming back for a second jar."
      updatedAt={doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null}
    />
  );
}