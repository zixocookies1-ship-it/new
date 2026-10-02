'use client';

import { useEffect, useState } from 'react';

import { adminFetch } from './api';
import { ImageField } from './ImageField';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
  Btn,
  DefinitionList,
  EmptyRow,
  InlineAlert,
  Loading,
  MoneyInput,
  PageHeader,
  Panel,
  Pill,
  Table,
  Td,
  Th,
} from './ui';
import type { AdminBundle, AdminMediaRef, AdminProductListItem } from './types';
import { formatINR } from '@/lib/money';

interface BundlesResponse {
  bundles: AdminBundle[];
}

interface LineForm {
  productId: string;
  variantId: string | null;
  qty: number;
}

interface BundleForm {
  id?: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  image: AdminMediaRef | null;
  lines: LineForm[];
  bundlePricePaise: number;
  compareAtPaise: number | null;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
}

function blankForm(): BundleForm {
  return {
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    image: null,
    lines: [{ productId: '', variantId: null, qty: 1 }],
    bundlePricePaise: 0,
    compareAtPaise: null,
    isActive: true,
    sortOrder: 0,
    seoTitle: '',
    seoDescription: '',
  };
}

/**
 * The homepage trio bundle.
 *
 * The saving is computed from real variant prices on the server, so a bundle
 * priced above the sum of its parts simply shows no saving badge rather than a
 * fabricated discount.
 */
export function BundlesClient() {
  const { data, error, loading, reload } = useAdminData<BundlesResponse>('/api/admin/bundles');
  const { data: productData } = useAdminData<{ products: AdminProductListItem[] }>(
    '/api/admin/products',
  );
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const action = useAdminAction();

  async function remove(b: AdminBundle) {
    if (!window.confirm(`Delete the bundle "${b.name}"?`)) return;
    const res = await action.run(() =>
      adminFetch(`/api/admin/bundles?id=${b.id}`, { method: 'DELETE' }),
    );
    if (res) reload();
  }

  return (
    <>
      <PageHeader
        title="Bundles"
        description="Multi-product sets. The price must be a single real number — there is no 'up to' discount."
        action={<Btn variant="primary" onClick={() => setEditing('new')}>+ New bundle</Btn>}
      />

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
                <Th>Bundle</Th>
                <Th>Contents</Th>
                <Th>Price</Th>
                <Th>Saving</Th>
                <Th>State</Th>
                <Th />
              </>
            }
          >
            {!data?.bundles.length ? (
              <EmptyRow colSpan={6} message="No bundles yet. The homepage trio slot stays empty until one exists." />
            ) : (
              data.bundles.map((b) => (
                <tr key={b.id}>
                  <Td>
                    <span className="block font-semibold text-ink">{b.name}</span>
                    <span className="block font-mono text-2xs text-ink-faint">/{b.slug}</span>
                  </Td>
                  <Td>
                    <ul className="space-y-0.5 text-xs">
                      {b.lines.map((l, i) => (
                        <li key={i}>
                          {l.qty} × {l.productName}
                          {l.weightLabel ? ` (${l.weightLabel})` : ''}
                          {l.unitPricePaise !== null ? (
                            <span className="text-ink-faint"> · {formatINR(l.unitPricePaise)}</span>
                          ) : (
                            <span className="text-ink-faint"> · price unavailable</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums font-semibold text-ink">
                    {formatINR(b.bundlePricePaise)}
                  </Td>
                  <Td>
                    {b.savings && b.savings.savingsPaise > 0 ? (
                      <Pill tone="good">Save {formatINR(b.savings.savingsPaise)}</Pill>
                    ) : (
                      <Pill tone="warn">No saving</Pill>
                    )}
                  </Td>
                  <Td>
                    <Pill tone={b.isActive ? 'good' : 'neutral'}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </Pill>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <Btn size="sm" onClick={() => setEditing(b.id)}>
                        Edit
                      </Btn>
                      <Btn size="sm" variant="danger" onClick={() => void remove(b)}>
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
        <BundleEditor
          bundleId={editing === 'new' ? null : editing}
          products={productData?.products ?? []}
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

function BundleEditor({
  bundleId,
  products,
  onClose,
  onSaved,
}: {
  bundleId: string | null;
  products: AdminProductListItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, loading, error } = useAdminData<BundlesResponse>(
    bundleId ? '/api/admin/bundles' : null,
  );
  const [form, setForm] = useState<BundleForm>(blankForm);
  const action = useAdminAction();

  useEffect(() => {
    if (!bundleId || !data) return;
    const b = data.bundles.find((x) => x.id === bundleId);
    if (!b) return;
    setForm({
      id: b.id,
      name: b.name,
      slug: b.slug,
      shortDescription: b.shortDescription,
      description: b.description,
      image: b.image,
      lines: b.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })),
      bundlePricePaise: b.bundlePricePaise,
      compareAtPaise: b.compareAtPaise,
      isActive: b.isActive,
      sortOrder: b.sortOrder,
      seoTitle: b.seoTitle,
      seoDescription: b.seoDescription,
    });
  }, [bundleId, data]);

  const patch = <K extends keyof BundleForm>(key: K, value: BundleForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const individualTotal = form.lines.reduce((sum, line) => {
    const product = products.find((p) => p.id === line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    return sum + (variant?.pricePaise ?? 0) * line.qty;
  }, 0);
  const priced = form.lines.every(
    (line) =>
      products.find((p) => p.id === line.productId)?.variants.some((v) => v.id === line.variantId),
  );

  async function save() {
    const res = await action.run(() =>
      adminFetch<{ savings: { savingsPaise: number } | null }>('/api/admin/bundles', {
        method: 'PUT',
        body: {
          id: form.id,
          name: form.name,
          slug: form.slug,
          shortDescription: form.shortDescription,
          description: form.description,
          image: form.image,
          lines: form.lines.filter((l) => l.productId),
          bundlePricePaise: form.bundlePricePaise,
          compareAtPaise: form.compareAtPaise,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
        },
      }),
    );
    if (res) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 sm:py-6" role="dialog" aria-modal="true">
      <div className="admin-focus mx-auto min-h-full w-full max-w-3xl bg-cream-50 sm:min-h-0 sm:rounded-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-300 bg-cream-50 px-4 py-3">
          <h2 className="font-display text-lg text-jaggery-500">
            {bundleId ? 'Edit bundle' : 'New bundle'}
          </h2>
          <Btn onClick={onClose}>Close</Btn>
        </header>

        <div className="space-y-4 p-4">
          {loading ? <Loading /> : null}
          {error ? <InlineAlert tone="bad">{error}</InlineAlert> : null}
          {action.error ? <InlineAlert tone="bad">{action.error}</InlineAlert> : null}

          <Panel title="Basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput
                label="Name"
                required
                value={form.name}
                onChange={(e) => {
                  patch('name', e.target.value);
                  if (!bundleId) {
                    patch(
                      'slug',
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, ''),
                    );
                  }
                }}
              />
              <AdminInput
                label="URL slug"
                required
                value={form.slug}
                onChange={(e) =>
                  patch(
                    'slug',
                    e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
                  )
                }
              />
            </div>
            <div className="mt-3 space-y-3">
              <AdminTextarea
                label="Short description"
                required
                rows={2}
                value={form.shortDescription}
                onChange={(e) => patch('shortDescription', e.target.value)}
              />
              <AdminTextarea
                label="Long description"
                rows={4}
                value={form.description}
                onChange={(e) => patch('description', e.target.value)}
              />
            </div>
          </Panel>

          <Panel title="Contents" description="Pick the exact pack size for each product.">
            <ul className="space-y-3">
              {form.lines.map((line, i) => {
                const product = products.find((p) => p.id === line.productId);
                return (
                  <li key={i} className="rounded-lg border border-cream-300 bg-cream-50 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <AdminSelect
                        label="Product"
                        value={line.productId}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, idx) =>
                              idx === i ? { ...l, productId: e.target.value, variantId: null } : l,
                            ),
                          }))
                        }
                      >
                        <option value="">Choose…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </AdminSelect>
                      <AdminSelect
                        label="Pack size"
                        value={line.variantId ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, idx) =>
                              idx === i ? { ...l, variantId: e.target.value || null } : l,
                            ),
                          }))
                        }
                      >
                        <option value="">None</option>
                        {(product?.variants ?? []).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.weightLabel} — {formatINR(v.pricePaise)}
                            {v.isActive ? '' : ' (inactive)'}
                          </option>
                        ))}
                      </AdminSelect>
                      <AdminInput
                        label="Quantity"
                        type="number"
                        min={1}
                        max={20}
                        value={line.qty}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, idx) =>
                              idx === i ? { ...l, qty: Math.max(1, Number(e.target.value)) } : l,
                            ),
                          }))
                        }
                      />
                    </div>
                    {form.lines.length > 1 ? (
                      <div className="mt-2">
                        <Btn
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))
                          }
                        >
                          Remove line
                        </Btn>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3">
              <Btn
                size="sm"
                onClick={() =>
                  setForm((f) => ({ ...f, lines: [...f.lines, { productId: '', variantId: null, qty: 1 }] }))
                }
              >
                + Add product
              </Btn>
            </div>
          </Panel>

          <Panel title="Pricing">
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput
                label="Bundle price (₹)"
                paise={form.bundlePricePaise}
                onChange={(v) => patch('bundlePricePaise', v ?? 0)}
              />
              <MoneyInput
                label="Compare-at price (₹)"
                paise={form.compareAtPaise}
                onChange={(v) => patch('compareAtPaise', v)}
                allowBlank
                hint="Optional strike-through price."
              />
            </div>
            <div className="mt-3">
              <DefinitionList
                items={[
                  {
                    label: 'Sum of individual prices',
                    value: priced ? formatINR(individualTotal) : 'Pick a pack size for every line',
                  },
                  { label: 'Bundle price', value: formatINR(form.bundlePricePaise) },
                  {
                    label: 'Customer saves',
                    value:
                      priced && form.bundlePricePaise < individualTotal
                        ? formatINR(individualTotal - form.bundlePricePaise)
                        : 'Nothing — no saving badge will be shown',
                  },
                ]}
              />
            </div>
          </Panel>

          <Panel title="Presentation">
            <div className="space-y-4">
              <ImageField
                label="Bundle image"
                value={form.image}
                onChange={(v) => patch('image', v)}
                roles={['gallery', 'lifestyle']}
                folder="natures-choice/bundles"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInput
                  label="Sort order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => patch('sortOrder', Number(e.target.value))}
                />
                <AdminToggle
                  label="Active"
                  description="Inactive bundles are hidden everywhere."
                  checked={form.isActive}
                  onChange={(v) => patch('isActive', v)}
                />
              </div>
              <AdminInput
                label="Meta title"
                value={form.seoTitle}
                onChange={(e) => patch('seoTitle', e.target.value)}
                maxLength={180}
              />
              <AdminTextarea
                label="Meta description"
                rows={2}
                value={form.seoDescription}
                onChange={(e) => patch('seoDescription', e.target.value)}
                maxLength={320}
              />
            </div>
          </Panel>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-cream-300 bg-cream-50 py-3">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn
              variant="primary"
              onClick={() => void save()}
              disabled={action.busy || !form.name || !form.slug || form.lines.some((l) => !l.productId)}
            >
              {action.busy ? 'Saving…' : 'Save bundle'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}