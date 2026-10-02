import type { Metadata } from 'next';

import { ContentPage } from '@/components/content/ContentPage';
import { safeContent } from '@/lib/catalog';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [content, settings] = await Promise.all([
    safeContent(['policies_privacy']),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
  ]);
  const doc = content.policies_privacy;

  return buildMetadata(settings, {
    title: doc?.seoTitle?.trim() || 'Privacy Policy',
    description:
      doc?.seoDescription?.trim() ||
      'What data we collect when you order, why we need it, how long we keep it and who can see it.',
    path: '/privacy-policy',
  });
}

export default async function PrivacyPolicyPage() {
  const content = await safeContent(['policies_privacy']);
  const doc = content.policies_privacy ?? null;

  return (
    <ContentPage
      content={doc}
      eyebrow="Policy"
      title="Privacy policy"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Privacy Policy' },
      ]}
      ctaTitle="Privacy question?"
      ctaBody="Ask us what we hold about you and we will tell you."
      updatedAt={doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null}
    />
  );
}