import type { Metadata } from 'next';

import { ContentPage } from '@/components/content/ContentPage';
import { safeContent } from '@/lib/catalog';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [content, settings] = await Promise.all([
    safeContent(['cookie_policy']),
    getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never),
  ]);
  const doc = content.cookie_policy;

  return buildMetadata(settings, {
    title: doc?.seoTitle?.trim() || 'Cookie Policy',
    description:
      doc?.seoDescription?.trim() ||
      'Which cookies this site uses, what each one does, and how to opt out of analytics.',
    path: '/cookie-policy',
  });
}

export default async function CookiePolicyPage() {
  const content = await safeContent(['cookie_policy']);
  const doc = content.cookie_policy ?? null;

  return (
    <ContentPage
      content={doc}
      eyebrow="Policy"
      title="Cookie policy"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Cookie Policy' },
      ]}
      ctaTitle="Want to change your mind later?"
      ctaBody="You can clear cookies from your browser at any time. Your cart will be lost, but nothing else breaks."
      updatedAt={doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null}
    />
  );
}