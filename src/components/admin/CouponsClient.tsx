'use client';

import { useEffect, useState } from 'react';

import { adminFetch } from './api';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  AdminInput,
  AdminSelect,
  AdminToggle,
  Btn,
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
  type PillTone,
} from './ui';
import type { AdminCoupon, AdminProductListItem } from './types';
import { formatINR } from '@/lib/money';

interface CouponsResponse {
  coupons: AdminCoupon[];
}

interface CouponForm {
  code: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  maxDiscountPercentCap: number | null;
  startsAt: string;
  expiresAt: string;
  usageLimit: number | null;
  perUserLimit: number | null;
  applicableProductIds: string[];
  isActive: boolean;
}

function blankForm(): CouponForm {
  return {
    code: '',
    description: '',
    type: 'PERCENTAGE',
    value: 10,
    maxDiscountPaise: null,
    minOrderPaise: 0,
    maxDiscountPercentCap: null,
    startsAt: '',
    expiresAt: '',
    usageLimit: null,
    perUserLimit: null,
    applicableProductIds: [],
    isActive: true,
  };
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm`; the API wants a full ISO string. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const LIVE_TONE: Record<AdminCoupon['liveState'], PillTone> = {
  LIVE: 'good',
  SCHEDULED: 'info',
  EXPIRED: 'neutral',
  LIMIT_REACHED: 'warn',
  INACTIVE: 'bad',
};

/**
 * Coupons.
 *
 * Nothing here invents an offer: a code exists only once you create it, and the
 * storefront shows it only while it is genuinely live (scheduled start, expiry
 * and usage limits are all enforced server-side at quote time).
 */
export function CouponsClient() {
  const { data, error, loading, reload } = useAdminData<CouponsResponse>('/api/admin/coupons');
  const [editing, setEditing] = useState<string | null>(null);
  const action = useAdminAction();

  async function toggle(c: AdminCoupon) {
    await action.run(() =>
      adminFetch('/api/admin/coupons', { method: 'PATCH', body: { code: c.code, isActive: !c.isActive } }),
    );
    reload();
  }

  async function remove(c: AdminCoupon) {
    if (!window.confirm(`Delete coupon ${c.code}? Orders that already used it keep their record.`)) return;
    const res = await action.run(() =>
      adminFetch(`/api/admin/coupons?code=${encodeURIComponent(c.code)}`, { method: 'DELETE' }),
    );
    if (res) reload();
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes. The store never shows an offer that is expired, scheduled for later, or used up."
        action={<Btn variant="primary" onClick={() => setEditing('new')}>+ New coupon</Btn>}
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
            minWidth={800}
            headers={
              <>
                <Th>Code</Th>
                <Th>Discount</Th>
                <Th>Conditions</Th>
                <Th>Usage</Th>
                <Th>State</Th>
                <Th />
              </>
            }
          >
            {!data?.coupons.length ? (
              <EmptyRow colSpan={6} message="No coupons. That is fine — the shop works without them." />
            ) : (
              data.coupons.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <span className="font-mono font-semibold text-ink">{c.code}</span>
                    {c.description ? (
                      <span className="block text-2xs text-ink-faint">{c.description}</span>
                    ) : null}
                  </Td>
                  <Td>
                    {c.type === 'PERCENTAGE' ? (
                      `${c.value}%`
                    ) : (
                      formatINR(Math.round(c.value * 100))
                    )}
                    {c.maxDiscountPaise ? (
                      <span className="block text-2xs text-ink-faint">
                        max {formatINR(c.maxDiscountPaise)}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-xs">
                    {c.minOrderPaise > 0 ? (
                      <span className="block">Min {formatINR(c.minOrderPaise)}</span>
                    ) : null}
                    {c.expiresAt ? (
                      <span className="block text-ink-faint">
                        ends {new Date(c.expiresAt).toLocaleDateString('en-IN')}
                      </span>
                    ) : null}
                    {c.applicableProductIds.length ? (
                      <span className="block text-ink-faint">
                        {c.applicableProductIds.length} product(s) only
                      </span>
                    ) : (
                      <span className="block text-ink-faint">all products</span>
                    )}
                  </Td>
                  <Td className="text-xs tabular-nums">
                    {c.usageCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                    {c.perUserLimit ? (
                      <span className="block text-2xs text-ink-faint">max {c.perUserLimit} each</span>
                    ) : null}
                  </Td>
                  <Td>
                    <Pill tone={LIVE_TONE[c.liveState]}>{c.liveState.replace(/_/g, ' ')}</Pill>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <Btn size="sm" onClick={() => setEditing(c.code)}>
                        Edit
                      </Btn>
                      <Btn size="sm" onClick={() => void toggle(c)} disabled={action.busy}>
                        {c.isActive ? 'Disable' : 'Enable'}
                      </Btn>
                      <Btn size="sm" variant="danger" onClick={() => void remove(c)}>
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
        <CouponEditor
          code={editing === 'new' ? null : editing}
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

function CouponEditor({
  code,
  onClose,
  onSaved,
}: {
  code: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, loading } = useAdminData<CouponsResponse>(code ? '/api/admin/coupons' : null);
  const { data: productData } = useAdminData<{ products: AdminProductListItem[] }>(
    '/api/admin/products',
  );
  const [form, setForm] = useState<CouponForm>(blankForm);
  const action = useAdminAction();

  useEffect(() => {
    if (!code || !data) return;
    const c = data.coupons.find((x) => x.code === code);
    if (!c) return;
    setForm({
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value,
      maxDiscountPaise: c.maxDiscountPaise,
      minOrderPaise: c.minOrderPaise,
      maxDiscountPercentCap: c.maxDiscountPercentCap,
      startsAt: toLocalInput(c.startsAt),
      expiresAt: toLocalInput(c.expiresAt),
      usageLimit: c.usageLimit,
      perUserLimit: c.perUserLimit,
      applicableProductIds: c.applicableProductIds,
      isActive: c.isActive,
    });
  }, [code, data]);

  const patch = <K extends keyof CouponForm>(key: K, value: CouponForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const res = await action.run(() =>
      adminFetch('/api/admin/coupons', {
        method: 'PUT',
        body: {
          code: form.code,
          description: form.description,
          type: form.type,
          value: form.value,
          maxDiscountPaise: form.maxDiscountPaise,
          minOrderPaise: form.minOrderPaise,
          maxDiscountPercentCap: form.maxDiscountPercentCap,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          usageLimit: form.usageLimit,
          perUserLimit: form.perUserLimit,
          applicableProductIds: form.applicableProductIds,
          isActive: form.isActive,
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
            {code ? `Edit ${code}` : 'New coupon'}
          </h2>
          <Btn onClick={onClose}>Close</Btn>
        </header>

        <div className="space-y-4 p-4">
          {loading ? <Loading /> : null}
          {action.error ? <InlineAlert tone="bad">{action.error}</InlineAlert> : null}

          <Panel title="Code">
            <div className="space-y-3">
              <AdminInput
                label="Code"
                required
                value={form.code}
                onChange={(e) => patch('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                hint="Letters, numbers, - and _ only. Customers type this at checkout."
              />
              <AdminInput
                label="Internal description"
                value={form.description}
                onChange={(e) => patch('description', e.target.value)}
                hint="For your team only — never shown to customers."
              />
            </div>
          </Panel>

          <Panel title="Discount">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminSelect
                label="Type"
                value={form.type}
                onChange={(e) => patch('type', e.target.value as CouponForm['type'])}
              >
                <option value="PERCENTAGE">Percentage off</option>
                <option value="FIXED">Fixed amount off</option>
              </AdminSelect>
              {form.type === 'PERCENTAGE' ? (
                <AdminInput
                  label="Percent"
                  type="number"
                  min={1}
                  max={100}
                  value={form.value}
                  onChange={(e) => patch('value', Number(e.target.value))}
                />
              ) : (
                <MoneyInput
                  label="Amount off (₹)"
                  paise={Math.round(form.value * 100)}
                  onChange={(v) => patch('value', (v ?? 0) / 100)}
                />
              )}
              <MoneyInput
                label="Maximum discount (₹)"
                paise={form.maxDiscountPaise}
                onChange={(v) => patch('maxDiscountPaise', v)}
                allowBlank
                hint="Caps a percentage coupon. Leave blank for no cap."
              />
              <MoneyInput
                label="Minimum order (₹)"
                paise={form.minOrderPaise}
                onChange={(v) => patch('minOrderPaise', v ?? 0)}
              />
            </div>
          </Panel>

          <Panel title="Limits and schedule">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput
                label="Starts"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => patch('startsAt', e.target.value)}
                hint="Before this moment the code is rejected."
              />
              <AdminInput
                label="Expires"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => patch('expiresAt', e.target.value)}
                hint="Leave blank to never expire."
              />
              <AdminInput
                label="Total uses"
                type="number"
                min={1}
                value={form.usageLimit ?? ''}
                onChange={(e) => patch('usageLimit', e.target.value ? Number(e.target.value) : null)}
                hint="Blank = unlimited."
              />
              <AdminInput
                label="Uses per customer"
                type="number"
                min={1}
                value={form.perUserLimit ?? ''}
                onChange={(e) =>
                  patch('perUserLimit', e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-ink">
                Restrict to specific products <span className="font-normal text-ink-faint">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(productData?.products ?? []).map((p) => {
                  const on = form.applicableProductIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        patch(
                          'applicableProductIds',
                          on
                            ? form.applicableProductIds.filter((x) => x !== p.id)
                            : [...form.applicableProductIds, p.id],
                        )
                      }
                      className={
                        on
                          ? 'rounded-full border border-jaggery-500 bg-jaggery-50 px-3 py-1 text-xs font-semibold text-jaggery-600'
                          : 'rounded-full border border-cream-400 bg-white px-3 py-1 text-xs text-ink-muted hover:bg-cream-50'
                      }
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              {!form.applicableProductIds.length ? (
                <p className="mt-2 text-xs text-ink-muted">None selected — applies to every product.</p>
              ) : null}
            </div>

            <div className="mt-4">
              <AdminToggle
                label="Active"
                description="Inactive codes are never accepted, even if the customer knows them."
                checked={form.isActive}
                onChange={(v) => patch('isActive', v)}
              />
            </div>
          </Panel>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-cream-300 bg-cream-50 py-3">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={() => void save()} disabled={action.busy || form.code.length < 3}>
              {action.busy ? 'Saving…' : 'Save coupon'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}