import type { Metadata } from 'next';

import { ContentPage } from '@/components/content/ContentPage';
import { safeContent } from '@/lib/catalog';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [content, settings] = await Promise.all([
    safeContent(['policies_terms']),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
  ]);
  const doc = content.policies_terms;

  return buildMetadata(settings, {
    title: doc?.seoTitle?.trim() || 'Terms & Conditions',
    description:
      doc?.seoDescription?.trim() ||
      'The terms that apply when you buy from Nature’s Choice Jaggery, written to be read.',
    path: '/terms',
  });
}

export default async function TermsPage() {
  const content = await safeContent(['policies_terms']);
  const doc = content.policies_terms ?? null;

  return (
    <ContentPage
      content={doc}
      eyebrow="Policy"
      title="Terms & conditions"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Terms & Conditions' },
      ]}
      ctaTitle="Something unclear?"
      ctaBody="Ask before you order — we would rather answer now than argue later."
      updatedAt={doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null}
    />
  );
}