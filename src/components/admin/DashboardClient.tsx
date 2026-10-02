'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { adminFetch } from './api';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  Btn,
  EmptyRow,
  InlineAlert,
  Loading,
  ORDER_TONE,
  PageHeader,
  Panel,
  PAYMENT_TONE,
  Pill,
  StatTile,
  StatusPill,
  SYNC_TONE,
  Table,
  Td,
  Th,
  type PillTone,
} from './ui';
import type { OverviewResponse } from './types';
import { formatINR } from '@/lib/money';

const SEVERITY_TONE: Record<'blocking' | 'important' | 'optional', PillTone> = {
  blocking: 'bad',
  important: 'warn',
  optional: 'neutral',
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
    <>
      <PageHeader
        title="Overview"
        description="Live figures from your database. Nothing here is estimated or seeded."
      />

      {/* --- Needs attention ------------------------------------------------ */}
      {setupTasks.length > 0 ? (
        <Panel
          title="Setup checklist"
          description="Work top to bottom. Until these are done the storefront will not advertise anything unverified."
          className="mb-5"
        >
          <ol className="space-y-2">
            {setupTasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-cream-200 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    <Pill tone={SEVERITY_TONE[task.severity]}>{task.severity}</Pill>
                    {task.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{task.detail}</p>
                </div>
                <Link
                  href={task.href}
                  className="shrink-0 rounded-lg border border-cream-400 bg-white px-2.5 py-1 text-xs font-semibold text-jaggery-500 hover:bg-cream-50"
                >
                  Open
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      ) : (
        <div className="mb-5">
          <InlineAlert tone="good" title="Everything is connected">
            All integrations are configured, shipping is on and no content is left unverified.
          </InlineAlert>
        </div>
      )}

      {/* --- Money ---------------------------------------------------------- */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Revenue (paid, all time)"
          value={formatINR(stats.revenuePaise)}
          hint={`${stats.paidOrders} paid order${stats.paidOrders === 1 ? '' : 's'}`}
          href="/admin/orders?paymentStatus=PAID"
        />
        <StatTile
          label="Revenue (last 30 days)"
          value={formatINR(stats.revenueLast30Paise)}
          hint={`Last 7 days: ${formatINR(stats.revenueLast7Paise)}`}
        />
        <StatTile
          label="Average order value"
          value={formatINR(stats.averageOrderValuePaise)}
          hint="Paid orders only"
        />
        <StatTile
          label="Awaiting payment"
          value={stats.pendingPayment}
          tone={stats.pendingPayment > 0 ? 'warn' : 'neutral'}
          hint="Orders created but not paid"
          href="/admin/orders?paymentStatus=PENDING"
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Orders" value={stats.totalOrders} hint={`${stats.deliveredOrders} delivered`} />
        <StatTile
          label="Failed shipments"
          value={stats.failedShippingSync}
          tone={stats.failedShippingSync > 0 ? 'bad' : 'neutral'}
          hint="Paid orders with no waybill"
          href="/admin/orders?syncStatus=FAILED"
        />
        <StatTile
          label="Reviews to moderate"
          value={moderation.reviewsPending}
          tone={moderation.reviewsPending > 0 ? 'warn' : 'neutral'}
          hint={`${moderation.reviewsApproved} published`}
          href="/admin/reviews"
        />
        <StatTile
          label="New messages"
          value={moderation.contactMessagesNew}
          tone={moderation.contactMessagesNew > 0 ? 'warn' : 'neutral'}
          hint="Contact form inbox"
          href="/admin/messages"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* --- Revenue chart ------------------------------------------------ */}
        <Panel
          title="Paid revenue, last 30 days"
          description="Only days with a paid order carry a bar. Flat days are real, not padding."
          className="lg:col-span-2"
        >
          {chart.every((d) => d.revenuePaise === 0) ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              No paid orders in the last 30 days yet.
            </p>
          ) : (
            <>
              <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Daily paid revenue for the last 30 days">
                {chart.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${formatINR(d.revenuePaise)}`}
                    className="min-w-0 flex-1 rounded-t-sm bg-jaggery-500/80"
                    style={{ height: `${Math.max(d.revenuePaise > 0 ? 4 : 1, d.heightPct)}%` }}
                  />
                ))}
              </div>
              <p className="mt-2 flex justify-between text-2xs text-ink-faint">
                <span>{chart[0]?.date}</span>
                <span>{chart[chart.length - 1]?.date}</span>
              </p>
            </>
          )}
        </Panel>

        {/* --- Capabilities -------------------------------------------------- */}
        <Panel title="What the storefront can claim" description="Each line is derived from the live configuration.">
          <ul className="space-y-2 text-sm">
            {[
              { ok: capabilities.onlinePayments, label: 'Online payment (Razorpay)' },
              { ok: capabilities.cod, label: 'Cash on delivery' },
              { ok: capabilities.liveTracking, label: 'Live courier tracking' },
              { ok: capabilities.images, label: 'Cloudinary image delivery' },
              { ok: capabilities.analytics.ga, label: 'Google Analytics' },
              { ok: capabilities.analytics.meta, label: 'Meta Pixel' },
            ].map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3">
                <span className="text-ink-soft">{c.label}</span>
                <Pill tone={c.ok ? 'good' : 'neutral'}>{c.ok ? 'On' : 'Off'}</Pill>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-cream-200 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Integrations
            </p>
            <ul className="space-y-1.5">
              {integrations.map((i) => (
                <li key={i.key} className="text-xs">
                  <span className="text-ink-soft">{i.label}</span>{' '}
                  <Pill tone={i.state === 'configured' ? 'good' : 'bad'}>
                    {i.state === 'configured' ? 'Connected' : 'Missing'}
                  </Pill>
                  {i.state === 'missing' ? (
                    <span className="mt-0.5 block text-2xs leading-relaxed text-ink-faint">{i.hint}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      {/* --- Recent orders -------------------------------------------------- */}
      <Panel
        title="Latest orders"
        description="Newest first."
        className="mt-5"
        action={
          <Btn
            variant="primary"
            size="sm"
            onClick={() => {
              void shippingAction.run(async () => {
                const res = await adminFetch<{ blockers: string[]; delhiveryConfigured: boolean }>(
                  '/api/admin/orders/shipping?action=config-check',
                  { method: 'POST', body: {} },
                );
                window.alert(
                  res.blockers.length
                    ? `Courier is not ready:\n\n- ${res.blockers.join('\n- ')}`
                    : 'Courier is configured and ready to create shipments.',
                );
                return res;
              });
            }}
            disabled={shippingAction.busy}
            title="Check whether Delhivery can create shipments right now"
          >
            Check courier
          </Btn>
        }
      >
        <Table
          minWidth={780}
          headers={
            <>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th>Payment</Th>
              <Th>Shipping</Th>
              <Th>Sync</Th>
              <Th />
            </>
          }
        >
          {data.recentOrders.length === 0 ? (
            <EmptyRow colSpan={8} message="No orders yet. They will appear here the moment a customer checks out." />
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
                <Td className="text-xs">
                  <StatusPill value={o.syncStatus} map={SYNC_TONE} />
                </Td>
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
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* --- Catalogue ---------------------------------------------------- */}
        <Panel title="Catalogue" description="Counts come straight from MongoDB.">
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
                <Link href={row.href} className="font-semibold text-jaggery-500 underline underline-offset-4">
                  {row.value}
                </Link>
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
        </Panel>

        {/* --- Stock -------------------------------------------------------- */}
        <Panel
          title="Low stock"
          description="Variants at or below their low-stock threshold."
          action={
            <Link href="/admin/products" className="text-xs font-semibold text-jaggery-500 underline underline-offset-4">
              Manage
            </Link>
          }
        >
          {catalogue.lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              Nothing is low. Set a threshold on a pack size to be warned here.
            </p>
          ) : (
            <Table
              minWidth={420}
              headers={
                <>
                  <Th>Product</Th>
                  <Th>Pack</Th>
                  <Th>SKU</Th>
                  <Th>In stock</Th>
                </>
              }
            >
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
        </Panel>
      </div>

      {/* --- Top sellers --------------------------------------------------- */}
      {data.topProducts.length > 0 ? (
        <Panel title="Best sellers by paid units" className="mt-5">
          <Table
            minWidth={420}
            headers={
              <>
                <Th>Product</Th>
                <Th>Units</Th>
                <Th>Revenue</Th>
              </>
            }
          >
            {data.topProducts.map((p) => (
              <tr key={p._id}>
                <Td>{p.name}</Td>
                <Td className="tabular-nums">{p.qty}</Td>
                <Td className="tabular-nums">{formatINR(p.revenuePaise)}</Td>
              </tr>
            ))}
          </Table>
        </Panel>
      ) : null}
    </>
  );
}