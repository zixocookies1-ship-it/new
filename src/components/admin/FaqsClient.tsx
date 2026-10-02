'use client';

import { useEffect, useState } from 'react';

import { adminFetch } from './api';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
  Btn,
  EmptyRow,
  InlineAlert,
  Loading,
  PageHeader,
  Panel,
  Pill,
  Table,
  Td,
  Th,
  Toolbar,
} from './ui';
import type { AdminFaq, AdminProductListItem } from './types';

interface FaqsResponse {
  faqs: AdminFaq[];
  categories: string[];
}

/** FAQ entries shown on /faq and in the homepage accordion. */
export function FaqsClient() {
  const { data, error, loading, reload } = useAdminData<FaqsResponse>('/api/admin/faqs?all=1');
  const [category, setCategory] = useState('ALL');
  const action = useAdminAction();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  const rows = (data?.faqs ?? []).filter((f) => category === 'ALL' || f.category === category);

  async function patchFaq(id: string, body: Record<string, unknown>) {
    await action.run(() => adminFetch('/api/admin/faqs', { method: 'PATCH', body: { id, ...body } }));
    reload();
  }

  async function remove(f: AdminFaq) {
    if (!window.confirm('Delete this FAQ?')) return;
    const res = await action.run(() =>
      adminFetch(`/api/admin/faqs?id=${f.id}`, { method: 'DELETE' }),
    );
    if (res) reload();
  }

  return (
    <>
      <PageHeader
        title="FAQ"
        description="Questions and answers. Group them so the homepage accordion can pick one category."
        action={<Btn variant="primary" onClick={() => setEditing('new')}>+ New question</Btn>}
      />

      <Toolbar>
        <AdminSelect
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full sm:w-56"
        >
          <option value="ALL">All categories</option>
          {(data?.categories ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </AdminSelect>
      </Toolbar>

      {error ? (
        <div className="mb-4">
          <InlineAlert tone="bad">{error}</InlineAlert>
        </div>
      ) : null}
      {action.error ? (
        <div className="mb-4">
          <InlineAlert tone="bad">{action.error}</InlineAlert>
        </div>
      ) : null}

      <Panel>
        {loading && !data ? (
          <Loading />
        ) : (
          <Table
            minWidth={760}
            headers={
              <>
                <Th>Question</Th>
                <Th>Category</Th>
                <Th>Order</Th>
                <Th>State</Th>
                <Th />
              </>
            }
          >
            {!rows.length ? (
              <EmptyRow colSpan={5} message="No questions in this category." />
            ) : (
              rows.map((f) => (
                <tr key={f.id}>
                  <Td>
                    <span className="block font-semibold text-ink">{f.question}</span>
                    <span className="mt-0.5 block max-w-xl text-xs text-ink-muted">{f.answer}</span>
                  </Td>
                  <Td>
                    <Pill tone="neutral">{f.category}</Pill>
                  </Td>
                  <Td className="tabular-nums text-xs">{f.order}</Td>
                  <Td className="space-y-1 text-xs">
                    <span className="block">
                      <Pill tone={f.isActive ? 'good' : 'neutral'}>{f.isActive ? 'Live' : 'Hidden'}</Pill>
                    </span>
                    {f.isFeatured ? <Pill tone="jaggery">Featured</Pill> : null}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Btn size="sm" onClick={() => setEditing(f.id)}>
                        Edit
                      </Btn>
                      <Btn
                        size="sm"
                        onClick={() => void patchFaq(f.id, { isActive: !f.isActive })}
                        disabled={action.busy}
                      >
                        {f.isActive ? 'Hide' : 'Show'}
                      </Btn>
                      <Btn size="sm" variant="danger" onClick={() => void remove(f)}>
                        Delete
                      </Btn>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </Table>
        )}
      </Panel>

      {editing ? (
        <FaqEditor
          faqId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function FaqEditor({
  faqId,
  onClose,
  onSaved,
}: {
  faqId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, loading } = useAdminData<FaqsResponse>(faqId ? '/api/admin/faqs?all=1' : null);
  const { data: productData } = useAdminData<{ products: AdminProductListItem[] }>(
    '/api/admin/products',
  );
  const [form, setForm] = useState({
    question: '',
    answer: '',
    category: '',
    order: 0,
    isActive: true,
    isFeatured: false,
    productId: '',
  });
  const action = useAdminAction();

  const existing = faqId ? data?.faqs.find((f) => f.id === faqId) : null;

  useEffect(() => {
    if (!existing) return;
    setForm({
      question: existing.question,
      answer: existing.answer,
      category: existing.category,
      order: existing.order,
      isActive: existing.isActive,
      isFeatured: existing.isFeatured,
      productId: existing.productId ?? '',
    });
  }, [existing]);

  async function save() {
    const res = await action.run(() =>
      adminFetch('/api/admin/faqs', {
        method: 'PUT',
        body: {
          id: faqId ?? undefined,
          question: form.question,
          answer: form.answer,
          category: form.category || 'General',
          order: form.order,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          productId: form.productId || null,
        },
      }),
    );
    if (res) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 sm:py-6" role="dialog" aria-modal="true">
      <div className="admin-focus mx-auto min-h-full w-full max-w-2xl bg-cream-50 sm:min-h-0 sm:rounded-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-300 bg-cream-50 px-4 py-3">
          <h2 className="font-display text-lg text-jaggery-500">
            {faqId ? 'Edit question' : 'New question'}
          </h2>
          <Btn onClick={onClose}>Close</Btn>
        </header>

        <div className="space-y-4 p-4">
          {loading ? <Loading /> : null}
          {action.error ? <InlineAlert tone="bad">{action.error}</InlineAlert> : null}

          <Panel>
            <div className="space-y-3">
              <AdminInput
                label="Question"
                required
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              />
              <AdminTextarea
                label="Answer"
                required
                rows={6}
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                hint="Answer only what you can stand behind. No health claims."
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <AdminInput
                  label="Category"
                value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Ordering"
                />
                <AdminInput
                  label="Order"
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                />
                <AdminSelect
                  label="Attach to product"
                  value={form.productId}
                  onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                  hint="Optional"
                >
                  <option value="">None — general FAQ</option>
                  {(productData?.products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <div className="space-y-2">
                <AdminToggle
                  label="Visible on the site"
                  checked={form.isActive}
                  onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <AdminToggle
                  label="Show in the homepage FAQ section"
                  checked={form.isFeatured}
                  onChange={(v) => setForm((f) => ({ ...f, isFeatured: v }))}
                />
              </div>
            </div>
          </Panel>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-cream-300 bg-cream-50 py-3">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn
              variant="primary"
              onClick={() => void save()}
              disabled={action.busy || form.question.length < 4 || form.answer.length < 10}
            >
              {action.busy ? 'Saving…' : 'Save question'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}