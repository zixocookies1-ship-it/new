'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { adminFetch } from '@/lib/admin-fetch';
import { useAdminAction, useAdminData } from '@/components/admin/useAdminData';
import {
  Btn,
  EmptyRow,
  InlineAlert,
  Loading,
  Pill,
  StatusPill,
  Table,
  Td,
  Th,
  Toolbar,
} from '@/components/admin/ui';
import type { OverviewResponse } from '@/components/admin/types';
import { formatINR } from '@/lib/money';

type PillTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

const SEVERITY_TONE: Record<'blocking' | 'important' | 'optional', PillTone> = {
  blocking: 'bad',
  important: 'warn',
  optional: 'neutral',
};

function toneClass(tone: PillTone): string {
  const toneMap: Record<PillTone, string> = {
    neutral: 'text-ink',
    good: 'text-leaf-600',
    warn: 'text-ginger-700',
    bad: 'text-[#8F3333]',
    info: 'text-jaggery-600',
  };
  return toneMap[tone] || 'text-ink';
}

function toneBg(tone: PillTone): string {
  const toneMap: Record<PillTone, string> = {
    neutral: 'bg-cream-200 text-ink-soft',
    good: 'bg-leaf-100 text-leaf-600',
    warn: 'bg-ginger-100 text-ginger-800',
    bad: 'bg-[#F6E2E2] text-[#8F3333]',
    info: 'bg-jaggery-50 text-jaggery-600',
  };
  return toneMap[tone] || 'bg-cream-200 text-ink-soft';
}

/** @todo: Define ORDER_TONE, PAYMENT_TONE if needed from types */
const ORDER_TONE: Record<string, PillTone> = {
  ORDER_PLACED: 'info',
  PAYMENT_PENDING: 'warn',
  PAID: 'good',
  PROCESSING: 'good',
  SHIPPED: 'warn',
  IN_TRANSIT: 'warn',
  OUT_FOR_DELIVERY: 'warn',
  DELIVERED: 'good',
  CANCELLED: 'bad',
  REFUNDED: 'neutral',
};

const PAYMENT_TONE: Record<string, PillTone> = {
  PENDING: 'warn',
  PAID: 'good',
  FAILED: 'bad',
  REFUNDED: 'neutral',
};

/**
 * Store overview.
 *
 * Everything shown is computed from the database on the server at request time.
 * An empty store renders zeros — there is no sample data anywhere in this file.
 */
export function DashboardClient() {
  const { data, error, loading, reload } = useAdminData<OverviewResponse>('/api/admin/overview');
  const shippingAction = useAdminAction();

  const chart = useMemo(() => {
    const rows = data?.chart ?? [];
    const max = Math.max(1, ...rows.map((r) => r.revenuePaise));
    return rows.map((r) => ({
      ...r,
      heightPct: Math.round((r.revenuePaise / max) * 100),
    }));
  }, [data]);

  if (loading && !data) return <Loading label="Loading your store overview…" />;
  if (error && !data) {
    return (
      <InlineAlert tone="bad" title="Could not load the overview">
        {error}{' '}
        <button type="button" onClick={reload} className="underline">
          Retry
        </button>
      </InlineAlert>
    );
  }
  if (!data) return null;

  const { stats, catalogue, moderation, capabilities, integrations, setupTasks } = data;

  return (
    <div>
      {/* --- Page Header --- */}
      <h1 className="font-display text-2xl text-jaggery-500 mb-4">Dashboard</h1>

      {/* --- Needs attention ------------------------------------------------ */}
      {setupTasks.length > 0 ? (
        <div className="rounded-xl border border-cream-300 bg-cream-50 p-4 sm:p-6 mb-6">
          <h2 className="font-display text-base text-jaggery-500 mb-3">Setup checklist</h2>
          <p className="text-sm text-ink-muted mb-3">
            Work top to bottom. Until these are done the storefront will not advertise anything unverified.
          </p>
          <ol className="space-y-2">
            {setupTasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-start justify-between rounded-lg border border-cream-200 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    <Pill tone={getSeverityTone(task.severity)}>{task.severity}</Pill>
                    {task.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{task.detail}</p>
                </div>
                <a
                  href={task.href}
                  className="shrink-0 rounded-lg border border-cream-400 bg-white px-2.5 py-1 text-xs font-semibold text-jaggery-500 hover:bg-cream-50"
                >
                  Open
                </a>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-sm text-ink-muted text-cream-200/80">All integrations are configured</p>
        </div>
      )}

      {/* --- Money ---------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-cream-300 bg-white p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Revenue (paid, all time)</p>
          <p className="mt-1 font-display text-2xl tabular-nums">{formatINR(stats.revenuePaise)}</p>
          <p className="text-xs mt-1 text-ink-muted">{stats.paidOrders} paid order{stats.paidOrders === 1 ? '' : 's'}</p>
          <a
            href="/admin/orders?paymentStatus=PAID"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-jaggery-500 underline underline-offset-4 hover:text-cream-50"
          >
            View orders
          </a>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Revenue (last 30 days)</p>
          <p className="mt-1 font-display text-2xl tabular-nums">{formatINR(stats.revenueLast30Paise)}</p>
          <p className="text-xs mt-1 text-ink-muted">
            Last 7 days: {formatINR(stats.revenueLast7Paise)}
          </p>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Average order value</p>
          <p className="mt-1 font-display text-2xl tabular-nums">{formatINR(stats.averageOrderValuePaise)}</p>
          <p className="text-xs mt-1 text-ink-muted">Paid orders only</p>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Awaiting payment</p>
          <p className="mt-1 font-display text-2xl {toneClass(stats.pendingPayment > 0 ? 'warn' : 'neutral')}">
            {formatINR(stats.pendingPayment)}
          </p>
          <p className="text-xs mt-1 text-ink-muted">Orders created but not paid</p>
          <a
            href="/admin/orders?paymentStatus=PENDING"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-jaggery-500 underline underline-offset-4 hover:text-cream-50"
          >
            View orders
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-cream-300 bg-white p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Orders</p>
          <p className="mt-1 font-display text-2xl">{stats.totalOrders}</p>
          <p className="text-xs mt-1 text-ink-muted">{stats.deliveredOrders} delivered</p>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Failed shipments</p>
          <p className="mt-1 font-display text-2xl {toneClass(stats.failedShippingSync > 0 ? 'bad' : 'neutral')}">
            {stats.failedShippingSync}
          </p>
          <p className="text-xs mt-1 text-ink-muted">Paid orders with no waybill</p>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Reviews to moderate</p>
          <p className="mt-1 font-display text-2xl {toneClass(moderation.reviewsPending > 0 ? 'warn' : 'neutral')}">
            {moderation.reviewsPending}
          </p>
          <p className="text-xs mt-1 text-ink-muted">{moderation.reviewsApproved} published</p>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white p-4">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">New messages</p>
          <p className="mt-1 font-display text-2xl {toneClass(moderation.contactMessagesNew > 0 ? 'warn' : 'neutral')}">
            {moderation.contactMessagesNew}
          </p>
          <p className="text-xs mt-1 text-ink-muted">Contact form inbox</p>
        </div>
      </div>

      {/* --- Revenue chart ------------------------------------------------ */}
      <div className="rounded-xl border border-cream-300 bg-white p-4 sm:p-6 mb-6">
        <h2 className="font-display text-base text-jaggery-500 mb-3">Paid revenue, last 30 days</h2>
        <p className="text-sm text-ink-muted mb-3">
          Only days with a paid order carry a bar. Flat days are real, not padding.
        </p>
        {chart.every((d) => d.revenuePaise === 0) ? (
          <p className="py-8 text-center text-sm text-ink-muted">No paid orders in the last 30 days yet.</p>
        ) : (
          <div className="flex h-32 items-end gap-4" role="img" aria-label="Daily paid revenue for the last 30 days">
            {chart.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${formatINR(d.revenuePaise)}`}
                className="min-w-0 flex-1 rounded-t bg-jaggery-500/80"
                style={{ height: `${Math.max(d.revenuePaise > 0 ? 4 : 1, d.heightPct)}%` }}
              />
            ))}
          </div>
        )}
        {chart.every((d) => d.revenuePaise === 0) || chart.length > 0 ? (
          <p className="mt-2 flex justify-between text-2xs text-ink-faint">
            <span>{chart[0]?.date}</span>
            <span>{chart[chart.length - 1]?.date}</span>
          </p>
        ) : null}
      </div>

      {/* --- Capabilities -------------------------------------------------- */}
      <div className="rounded-xl border border-cream-300 bg-white p-4 sm:p-6 mb-6">
        <h2 className="font-display text-base text-jaggery-500 mb-3">What the storefront can claim</h2>
        <p className="text-sm text-ink-muted">Each line is derived from the live configuration.</p>
        <ul className="space-y-2 text-sm">
          {[
            { ok: capabilities.onlinePayments, label: 'Online payment (Razorpay)' },
            { ok: capabilities.cod, label: 'Cash on delivery' },
            { ok: capabilities.liveTracking, label: 'Live courier tracking' },
            { ok: capabilities.images, label: 'Cloudinary image delivery' },
          ].map((c) => (
            <li key={c.label} className="flex items-center justify-between gap-3">
              <span className="text-ink-soft">{c.label}</span>
              <Pill tone={c.ok ? 'good' : 'neutral'}>
                {c.ok ? 'On' : 'Off'}
              </Pill>
            </li>
          ))}
        </ul>
      </div>

      {/* --- Recent orders -------------------------------------------------- */}
      <div className="rounded-xl border border-cream-300 bg-white p-4 sm:p-6 mb-6">
        <h2 className="font-display text-base text-jaggery-500 mb-3">Latest orders</h2>
        <p className="text-sm text-ink-muted mb-3">Newest first.</p>
        <Table minWidth={780} headers={<> <Th>Order</Th> <Th>Customer</Th> <Th>Total</Th> <Th>Status</Th> <Th>Payment</Th> <Th>Shipping</Th> <Th /></>}>
          {data.recentOrders.length === 0 ? (
            <EmptyRow colSpan={7} message="No orders yet. They will appear here the moment a customer checks out." />
          ) : (
            data.recentOrders.map((o) => (
              <tr key={o.orderId}>
                <Td className="font-mono text-xs">{o.orderId}</Td>
                <Td className="max-w-[180px] truncate">{o.customer || '—'}</Td>
                <Td className="tabular-nums">{formatINR(o.totalPaise)}</Td>
                <Td>
                  <StatusPill value={o.status} map={ORDER_TONE} />
                </Td>
                <Td>
                  <StatusPill value={o.paymentStatus} map={PAYMENT_TONE} />
                </Td>
                <Td className="text-xs">{o.shippingStatus.replace(/_/g, ' ').toLowerCase()}</Td>
                <Td>
                  <Link
                    href={`/admin/orders?q=${encodeURIComponent(o.orderId)}`}
                    className="text-xs font-semibold text-jaggery-500 underline underline-offset-4"
                  >
                    Open
                  </Link>
                </Td>
              </tr>
            ))
          )}
        </Table>
      </div>

      {/* --- Catalogue ---------------------------------------------------- */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-cream-300 bg-white p-4 sm:p-6">
          <h3 className="font-display text-sm text-jaggery-500 mb-2">Catalogue</h3>
          <ul className="space-y-2 text-sm">
            {[
              { label: 'Products (active)', value: `${catalogue.activeProducts} of ${catalogue.products}`, href: '/admin/products' },
              { label: 'Bundles', value: catalogue.bundles, href: '/admin/bundles' },
              { label: 'FAQs', value: catalogue.faqs, href: '/admin/faqs' },
              { label: 'Recipes', value: catalogue.recipes, href: '/admin/recipes' },
              { label: 'Content pages written', value: `${catalogue.contentDocs} of ${catalogue.contentKeysTotal}`, href: '/admin/content' },
              { label: 'Coupons (active)', value: `${catalogue.activeCoupons} of ${catalogue.coupons}`, href: '/admin/coupons' },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3">
                <span className="text-ink-soft">{row.label}</span>
                <a href={row.href} className="font-semibold text-jaggery-500 underline underline-offset-4">
                  {row.value}
                </a>
              </li>
            ))}
          </ul>

          {(catalogue.unverifiedProducts > 0 || catalogue.unverifiedContentKeys.length > 0) && (
            <div className="mt-4">
              <InlineAlert tone="warn" title="Unverified copy is not published as fact">
                {catalogue.unverifiedProducts} product(s) and{' '}
                {catalogue.unverifiedContentKeys.length} content section(s) still need your confirmation.
              </InlineAlert>
            </div>
          )}
        </div>

        {/* --- Stock -------------------------------------------------------- */}
        <div className="rounded-xl border border-cream-300 bg-white p-4 sm:p-6">
          <h3 className="font-display text-sm text-jaggery-500 mb-2">Low stock</h3>
          <p className="text-sm text-ink-muted mb-2">
            Variants at or below their low-stock threshold.
          </p>
          {catalogue.lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">Nothing is low. Set a threshold on a pack size to be warned here.</p>
          ) : (
            <Table minWidth={420} headers={<> <Th>Product</Th> <Th>Pack</Th> <Th>SKU</Th> <Th>In stock</Th> </>}>
              {catalogue.lowStock.map((v) => (
                <tr key={v.id}>
                  <Td className="max-w-[160px] truncate">{v.productName}</Td>
                  <Td>{v.weightLabel}</Td>
                  <Td className="font-mono text-xs">{v.sku}</Td>
                  <Td>
                    <Pill tone={v.inventory === 0 ? 'bad' : 'warn'}>
                      {v.inventory} / {v.lowStockThreshold}
                    </Pill>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>

      {/* --- Top sellers --------------------------------------------------- */}
      {data.topProducts.length > 0 ? (
        <div className="rounded-xl border border-cream-300 bg-white p-4 sm:p-6 mt-6">
          <h2 className="font-display text-base text-jaggery-500 mb-3">Best sellers by paid units</h2>
          <Table minWidth={420} headers={<> <Th>Product</Th> <Th>Units</Th> <Th>Revenue</Th> </>}>
            {data.topProducts.map((p) => (
              <tr key={p._id}>
                <Td>{p.name}</Td>
                <Td className="tabular-nums">{p.qty}</Td>
                <Td className="tabular-nums">{formatINR(p.revenuePaise)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </div>
  );
}

/** Helper to get severity tone */
function getSeverityTone(severity: 'blocking' | 'important' | 'optional'): PillTone {
  const toneMap: Record<'blocking' | 'important' | 'optional', PillTone> = {
    blocking: 'bad',
    important: 'warn',
    optional: 'neutral',
  };
  return toneMap[severity] || 'neutral';
}