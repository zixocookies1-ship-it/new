'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { adminFetch } from './api';
import { ImageListField } from './ImageField';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  AdminInput,
  AdminTextarea,
  AdminToggle,
  Btn,
  InlineAlert,
  Loading,
  PageHeader,
  Panel,
  Pill,
} from './ui';
import type { AdminContentDoc, AdminMediaRef } from './types';

interface ContentResponse {
  content: AdminContentDoc[];
  unverifiedCount: number;
}

interface SectionForm {
  heading: string;
  body: string;
  bullet: string;
  verified: boolean;
}

/** Where each content key is published, so the editor knows what it is writing. */
const KEY_ROUTES: Record<string, string> = {
  home_hero: '/',
  home_trust: '/',
  home_three_flavours: '/',
  home_why: '/',
  home_featured: '/',
  home_process: '/',
  home_story: '/',
  home_reviews: '/',
  home_ugc: '/',
  home_bundle: '/',
  home_recipes: '/',
  home_faq: '/',
  home_final_cta: '/',
  our_story: '/our-story',
  why_natures_choice: '/our-story',
  policies_shipping: '/contact',
  policies_cancellation_refund_return: '/contact',
  policies_privacy: '/contact',
  policies_terms: '/contact',
  cookie_policy: '/contact',
  contact: '/contact',
};

const KEY_LABELS: Record<string, string> = {
  home_hero: 'Homepage — hero',
  home_trust: 'Homepage — trust strip',
  home_three_flavours: 'Homepage — three flavours',
  home_why: 'Homepage — why us',
  home_featured: 'Homepage — featured product',
  home_process: 'Homepage — farm to jar',
  home_story: 'Homepage — our story / co-founder',
  home_reviews: 'Homepage — reviews',
  home_ugc: 'Homepage — customer photos',
  home_bundle: 'Homepage — trio bundle',
  home_recipes: 'Homepage — recipes',
  home_faq: 'Homepage — FAQ',
  home_final_cta: 'Homepage — final call to action',
  our_story: 'Our story page',
  why_natures_choice: 'Why Nature’s Choice page',
  policies_shipping: 'Shipping policy',
  policies_cancellation_refund_return: 'Cancellation, refund & returns',
  policies_privacy: 'Privacy policy',
  policies_terms: 'Terms & conditions',
  cookie_policy: 'Cookie policy',
  contact: 'Contact page',
};

/**
 * Page content editor.
 *
 * Every key is listed even when nothing has been written yet, so the operator
 * can see exactly what the storefront is missing. The `isVerified` flag is the
 * anti-invention gate: unverified copy is rendered as an editable placeholder,
 * never as a business fact.
 */
export function ContentClient() {
  const { data, error, loading, reload } = useAdminData<ContentResponse>('/api/admin/content');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const action = useAdminAction();

  async function verify(key: string, isVerified: boolean) {
    await action.run(() =>
      adminFetch('/api/admin/content', { method: 'PATCH', body: { key, isVerified } }),
    );
    reload();
  }

  const missing = (data?.content ?? []).filter((c) => !c.exists);

  return (
    <>
      <PageHeader
        title="Content"
        description="Every word on the storefront lives here. Nothing is hardcoded in the components."
        action={
          <Pill tone={data?.unverifiedCount ? 'warn' : 'good'}>
            {data?.unverifiedCount ?? 0} unverified
          </Pill>
        }
      />

      {error ? (
        <div className="mb-4">
          <InlineAlert tone="bad">{error}</InlineAlert>
        </div>
      ) : null}

      {missing.length ? (
        <div className="mb-4">
          <InlineAlert tone="warn" title={`${missing.length} section(s) have no content yet`}>
            {missing
              .slice(0, 8)
              .map((m) => KEY_LABELS[m.key] ?? m.key)
              .join(', ')}
            {missing.length > 8 ? '…' : ''}. Until these are written the storefront shows a clearly
            marked placeholder instead of invented copy.
          </InlineAlert>
        </div>
      ) : null}

      {loading && !data ? (
        <Loading />
      ) : (
        <div className="space-y-2">
          {(data?.content ?? []).map((doc) => {
            const isOpen = openKey === doc.key;
            return (
              <section
                key={doc.key}
                className={clsx(
                  'overflow-hidden rounded-xl border bg-white shadow-sm',
                  doc.exists ? 'border-cream-300' : 'border-dashed border-cream-400',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base text-jaggery-500">
                        {KEY_LABELS[doc.key] ?? doc.key}
                      </span>
                      <Pill tone={doc.exists ? 'info' : 'neutral'}>{doc.key}</Pill>
                      {doc.isVerified ? (
                        <Pill tone="good">Verified</Pill>
                      ) : (
                        <Pill tone="warn">Placeholder</Pill>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {doc.exists ? (
                        <>
                          {doc.title || 'Untitled'}
                          {doc.updatedAt
                            ? ` · updated ${new Date(doc.updatedAt).toLocaleDateString('en-IN')}`
                            : ''}
                        </>
                      ) : (
                        <>Nothing written yet.</>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={KEY_ROUTES[doc.key] ?? '/'}
                      target="_blank"
                      className="text-xs font-semibold text-jaggery-500 underline underline-offset-4"
                    >
                      View on site
                    </Link>
                    {doc.exists ? (
                      <Btn
                        size="sm"
                        onClick={() => void verify(doc.key, !doc.isVerified)}
                        disabled={action.busy}
                        title="Only tick this when every value below is true"
                      >
                        {doc.isVerified ? 'Mark unverified' : 'Mark verified'}
                      </Btn>
                    ) : null}
                    <Btn size="sm" variant="primary" onClick={() => setOpenKey(isOpen ? null : doc.key)}>
                      {isOpen ? 'Close' : 'Edit'}
                    </Btn>
                  </div>
                </div>

                {isOpen ? <ContentEditor doc={doc} onClose={() => setOpenKey(null)} onSaved={reload} /> : null}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function ContentEditor({
  doc,
  onClose,
  onSaved,
}: {
  doc: AdminContentDoc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: doc.title,
    eyebrow: doc.eyebrow,
    body: doc.body,
    sections: doc.sections.map((s) => ({
      heading: s.heading ?? '',
      body: s.body ?? '',
      bullet: s.bullet ?? '',
      verified: Boolean(s.verified),
    })) as SectionForm[],
    images: (doc.images ?? []) as AdminMediaRef[],
    faqCategory: doc.faqCategory,
    seoTitle: doc.seoTitle,
    seoDescription: doc.seoDescription,
    isVerified: doc.isVerified,
  });
  const action = useAdminAction();

  useEffect(() => {
    setForm({
      title: doc.title,
      eyebrow: doc.eyebrow,
      body: doc.body,
      sections: doc.sections.map((s) => ({
        heading: s.heading ?? '',
        body: s.body ?? '',
        bullet: s.bullet ?? '',
        verified: Boolean(s.verified),
      })),
      images: (doc.images ?? []) as AdminMediaRef[],
      faqCategory: doc.faqCategory,
      seoTitle: doc.seoTitle,
      seoDescription: doc.seoDescription,
      isVerified: doc.isVerified,
    });
  }, [doc]);

  const patch = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const res = await action.run(() =>
      adminFetch('/api/admin/content', {
        method: 'PUT',
        body: {
          key: doc.key,
          title: form.title,
          eyebrow: form.eyebrow,
          body: form.body,
          sections: form.sections,
          images: form.images,
          faqCategory: form.faqCategory,
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          isVerified: form.isVerified,
        },
      }),
    );
    if (res) {
      onSaved();
      onClose();
    }
  }

  return (
    <div className="border-t border-cream-200 bg-cream-50 p-4">
      {action.error ? (
        <div className="mb-3">
          <InlineAlert tone="bad">{action.error}</InlineAlert>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <AdminInput label="Eyebrow" value={form.eyebrow} onChange={(e) => patch('eyebrow', e.target.value)} />
        <AdminInput label="Heading" value={form.title} onChange={(e) => patch('title', e.target.value)} />
      </div>

      <div className="mt-3">
        <AdminTextarea
          label="Body"
          rows={5}
          value={form.body}
          onChange={(e) => patch('body', e.target.value)}
          hint="Plain text. Separate paragraphs with a blank line."
        />
      </div>

      {doc.key === 'home_faq' ? (
        <div className="mt-3">
          <AdminInput
            label="FAQ category to show"
            value={form.faqCategory}
            onChange={(e) => patch('faqCategory', e.target.value)}
            hint="Must match a category name in Admin → FAQ."
          />
        </div>
      ) : null}

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-ink">Sub-sections</p>
        {form.sections.length ? (
          <ul className="space-y-3">
            {form.sections.map((s, i) => (
              <li key={i} className="rounded-lg border border-cream-300 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Section {i + 1}
                  </p>
                  <Btn
                    size="sm"
                    variant="danger"
                    onClick={() => patch('sections', form.sections.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </Btn>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminInput
                    label="Heading"
                    value={s.heading}
                    onChange={(e) =>
                      patch(
                        'sections',
                        form.sections.map((x, idx) => (idx === i ? { ...x, heading: e.target.value } : x)),
                      )
                    }
                  />
                  <AdminInput
                    label="Short bullet (optional)"
                    value={s.bullet}
                    onChange={(e) =>
                      patch(
                        'sections',
                        form.sections.map((x, idx) => (idx === i ? { ...x, bullet: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="mt-2">
                  <AdminTextarea
                    label="Body"
                    rows={3}
                    value={s.body}
                    onChange={(e) =>
                      patch(
                        'sections',
                        form.sections.map((x, idx) => (idx === i ? { ...x, body: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="mt-2">
                  <AdminToggle
                    label="Verified"
                    description="Tick only if this statement is factually true today."
                    checked={s.verified}
                    onChange={(v) =>
                      patch(
                        'sections',
                        form.sections.map((x, idx) => (idx === i ? { ...x, verified: v } : x)),
                      )
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-cream-400 px-3 py-3 text-xs text-ink-muted">
            No sub-sections. This section renders its heading and body only.
          </p>
        )}
        <div className="mt-2">
          <Btn
            size="sm"
            onClick={() =>
              patch('sections', [...form.sections, { heading: '', body: '', bullet: '', verified: false }])
            }
          >
            + Add sub-section
          </Btn>
        </div>
      </div>

      <div className="mt-4">
        <ImageListField
          label="Images"
          hint="Optional. Sections fall back to a neutral placeholder when empty."
          value={form.images}
          onChange={(v) => patch('images', v)}
          roles={['gallery', 'lifestyle', 'process', 'founder', 'ingredients', 'ugc']}
          folder={`natures-choice/content/${doc.key}`}
          max={10}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <AdminInput label="Meta title" value={form.seoTitle} onChange={(e) => patch('seoTitle', e.target.value)} maxLength={180} />
        <AdminTextarea
          label="Meta description"
          rows={2}
          value={form.seoDescription}
          onChange={(e) => patch('seoDescription', e.target.value)}
          maxLength={320}
        />
      </div>

      <div className="mt-4">
        <AdminToggle
          tone="warning"
          label="I have checked every claim on this page"
          description="No invented history, awards, certifications, testimonials, delivery dates or health claims. Leave this off while anything is a guess."
          checked={form.isVerified}
          onChange={(v) => patch('isVerified', v)}
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => void save()} disabled={action.busy}>
          {action.busy ? 'Saving…' : 'Save content'}
        </Btn>
      </div>
    </div>
  );
}