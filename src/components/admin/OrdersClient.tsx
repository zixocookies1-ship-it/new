'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { adminFetch, AdminError } from './api';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  Btn,
  DefinitionList,
  EmptyRow,
  InlineAlert,
  Loading,
  MoneyInput,
  ORDER_TONE,
  Panel,
  PageHeader,
  PAYMENT_TONE,
  Pill,
  StatusPill,
  SYNC_TONE,
  Table,
  Td,
  Th,
  Toolbar,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from './ui';
import type { AdminOrderDetail, AdminOrderRow, Pagination } from './types';
import { formatINR } from '@/lib/money';
import { ADMIN_SETTABLE_STATUSES, ORDER_STATUS } from '@/lib/types';

interface OrdersResponse {
  orders: AdminOrderRow[];
  pagination: Pagination;
  stats: { revenuePaise: number; pendingPaymentCount: number; failedShippingSyncCount: number };
}

const FILTERS = [
  { key: 'status', label: 'Order status', options: [...ORDER_STATUS, 'ALL'] },
  { key: 'paymentStatus', label: 'Payment', options: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'ALL'] },
  {
    key: 'shippingStatus',
    label: 'Shipping',
    options: [
      'NOT_APPLICABLE',
      'PENDING',
      'CREATING',
      'CREATED',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'SYNC_FAILED',
      'ALL',
    ],
  },
  { key: 'syncStatus', label: 'Courier sync', options: ['IDLE', 'PENDING', 'SUCCESS', 'FAILED', 'ALL'] },
] as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

/**
 * Orders console.
 *
 * The list is deliberately explicit about the two states that quietly lose
 * money in a D2C store: a payment that is pending, and a paid order that never
 * got a waybill. Both are filterable, and a failed sync keeps its error text
 * visible with a one-click retry.
 */
interface OrdersClientProps {
  initial: {
    q?: string;
    status?: string;
    syncStatus?: string;
    paymentStatus?: string;
    shippingStatus?: string;
  };
}

export function OrdersClient({ initial }: OrdersClientProps) {
  const [q, setQ] = useState(initial.q ?? '');
  const [status, setStatus] = useState(initial.status ?? 'ALL');
  const [paymentStatus, setPaymentStatus] = useState(initial.paymentStatus ?? 'ALL');
  const [shippingStatus, setShippingStatus] = useState(initial.shippingStatus ?? 'ALL');
  const [syncStatus, setSyncStatus] = useState(initial.syncStatus ?? 'ALL');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const path = `/api/admin/orders?limit=25&page=${page}&q=${encodeURIComponent(q)}&status=${status}&paymentStatus=${paymentStatus}&shippingStatus=${shippingStatus}&syncStatus=${syncStatus}`;
  const { data, error, loading, reload } = useAdminData<OrdersResponse>(path);

  const applyFilter = useCallback((patch: Record<string, string>) => {
    setPage(1);
    if ('q' in patch) setQ(patch.q);
    if ('status' in patch) setStatus(patch.status);
    if ('paymentStatus' in patch) setPaymentStatus(patch.paymentStatus);
    if ('shippingStatus' in patch) setShippingStatus(patch.shippingStatus);
    if ('syncStatus' in patch) setSyncStatus(patch.syncStatus);
  }, []);

  return (
    <>
      <PageHeader
        title="Orders"
        description="Search by order ID, reference, mobile or email. Every figure is the stored snapshot, not a live recalculation."
      />

      <Toolbar>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilter({ q });
            reload();
          }}
        >
          <AdminInput
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="NC-XXXXXXXXXX, mobile, email"
            className="w-full sm:w-64"
          />
          <Btn type="submit" variant="primary">
            Search
          </Btn>
        </form>

        {FILTERS.map((f) => {
          const value =
            f.key === 'status'
              ? status
              : f.key === 'paymentStatus'
                ? paymentStatus
                : f.key === 'shippingStatus'
                  ? shippingStatus
                  : syncStatus;
          const set =
            f.key === 'status'
              ? setStatus
              : f.key === 'paymentStatus'
                ? setPaymentStatus
                : f.key === 'shippingStatus'
                  ? setShippingStatus
                  : setSyncStatus;
          return (
            <AdminSelect
              key={f.key}
              label={f.label}
              value={value}
              onChange={(e) => {
                applyFilter({ [f.key]: e.target.value } as Record<string, string>);
              }}
              className="w-full sm:w-48"
            >
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o === 'ALL' ? 'All' : o.replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </AdminSelect>
          );
        })}
      </Toolbar>

      {error ? (
        <div className="mb-4">
          <InlineAlert tone="bad">{error}</InlineAlert>
        </div>
      ) : null}

      {data ? (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Pill tone="jaggery">Matched revenue {formatINR(data.stats.revenuePaise)}</Pill>
          <Pill tone={data.stats.pendingPaymentCount ? 'warn' : 'neutral'}>
            {data.stats.pendingPaymentCount} awaiting payment
          </Pill>
          <Pill tone={data.stats.failedShippingSyncCount ? 'bad' : 'neutral'}>
            {data.stats.failedShippingSyncCount} failed shipment sync
          </Pill>
        </div>
      ) : null}

      <Panel title={`Orders${data ? ` (${data.pagination.total})` : ''}`}>
        {loading && !data ? (
          <Loading />
        ) : (
          <Table
            minWidth={980}
            headers={
              <>
                <Th>Order</Th>
                <Th>Placed</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Shipping</Th>
                <Th />
              </>
            }
          >
            {!data?.orders.length ? (
              <EmptyRow colSpan={9} message="No orders match these filters." />
            ) : (
              data.orders.map((o) => (
                <tr key={o.id} className={clsx(o.syncStatus === 'FAILED' && 'bg-[#FDF6F6]')}>
                  <Td className="font-mono text-xs font-semibold text-ink">{o.orderId}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(o.createdAt)}</Td>
                  <Td>
                    <span className="block max-w-[180px] truncate">{o.customerName || '—'}</span>
                    <span className="block text-2xs text-ink-faint">
                      {o.phone}
                      {o.city ? ` · ${o.city} ${o.pincode}` : ''}
                    </span>
                  </Td>
                  <Td className="max-w-[220px]">
                    <span className="block truncate text-xs" title={o.itemSummary}>
                      {o.itemSummary}
                    </span>
                    <span className="text-2xs text-ink-faint">{o.itemCount} item(s)</span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums font-semibold text-ink">
                    {formatINR(o.totalPaise)}
                    {o.hasRefund ? (
                      <span className="block text-2xs font-normal text-ink-faint">refunded</span>
                    ) : null}
                  </Td>
                  <Td>
                    <StatusPill value={o.status} map={ORDER_TONE} />
                  </Td>
                  <Td>
                    <StatusPill value={o.paymentStatus} map={PAYMENT_TONE} />
                    <span className="mt-0.5 block text-2xs text-ink-faint">
                      {o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Razorpay'}
                    </span>
                  </Td>
                  <Td className="text-xs">
                    <span className="block">{o.shippingStatus.replace(/_/g, ' ').toLowerCase()}</span>
                    {o.waybill ? (
                      <span className="block font-mono text-2xs text-ink-faint">AWB {o.waybill}</span>
                    ) : null}
                    <StatusPill value={o.syncStatus} map={SYNC_TONE} />
                  </Td>
                  <Td>
                    <Btn size="sm" onClick={() => setOpenId(o.orderId)}>
                      Manage
                    </Btn>
                  </Td>
                </tr>
              ))
            )}
          </Table>
        )}

        {data && data.pagination.pages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3 text-xs">
            <span className="text-ink-muted">
              Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} order(s)
            </span>
            <div className="flex gap-2">
              <Btn size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Btn>
              <Btn
                size="sm"
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Btn>
            </div>
          </div>
        ) : null}
      </Panel>

      {openId ? (
        <OrderDrawer orderId={openId} onClose={() => setOpenId(null)} onChanged={reload} />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Drawer                                                                      */
/* -------------------------------------------------------------------------- */

function OrderDrawer({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, error, loading } = useAdminData<{ order: AdminOrderDetail }>(
    `/api/admin/orders?orderId=${encodeURIComponent(orderId)}`,
    [],
  );
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [statusChoice, setStatusChoice] = useState('');
  const [note, setNote] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [refundPaise, setRefundPaise] = useState<number | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const action = useAdminAction();
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (data?.order) {
      setDetail(data.order);
      setAdminNote(data.order.adminNote ?? '');
      setRefundPaise(data.order.totalPaise - (data.order.amountRefundedPaise ?? 0));
    }
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function setStatus() {
    if (!detail || !statusChoice) return;
    const res = await action.run(() =>
      adminFetch<{ status: string }>('/api/admin/orders/actions', {
        method: 'PATCH',
        body: { orderId: detail.orderId, status: statusChoice, note: note || undefined },
      }),
    );
    if (res) {
      setFlash(`Order moved to ${res.status.replace(/_/g, ' ')}.`);
      setStatusChoice('');
      setNote('');
      onChanged();
      const fresh = await adminFetch<{ order: AdminOrderDetail }>(
        `/api/admin/orders?orderId=${encodeURIComponent(detail.orderId)}`,
      );
      setDetail(fresh.order);
    }
  }

  async function saveNote() {
    if (!detail) return;
    const res = await action.run(() =>
      adminFetch<{ adminNote: string }>('/api/admin/orders/actions', {
        method: 'PUT',
        body: { orderId: detail.orderId, adminNote },
      }),
    );
    if (res) setFlash('Internal note saved. Customers never see this.');
  }

  async function issueRefund() {
    if (!detail || !refundPaise) return;
    const rupees = refundPaise / 100;
    if (
      !window.confirm(
        `Issue a refund of ₹${rupees.toFixed(2)} to the customer through Razorpay?\n\nThis moves real money and cannot be undone from this panel.`,
      )
    ) {
      return;
    }
    const res = await action.run(() =>
      adminFetch<{ refundId: string; orderStatus: string }>('/api/admin/orders/actions', {
        method: 'POST',
        body: { orderId: detail.orderId, amountPaise: refundPaise, reason: refundReason },
      }),
    );
    if (res) {
      setFlash(`Refund ${res.refundId} issued. Order is now ${res.orderStatus.replace(/_/g, ' ')}.`);
      onChanged();
      const fresh = await adminFetch<{ order: AdminOrderDetail }>(
        `/api/admin/orders?orderId=${encodeURIComponent(detail.orderId)}`,
      );
      setDetail(fresh.order);
    }
  }

  async function shipping(actionName: 'retry-sync' | 'refresh') {
    if (!detail) return;
    const res = await action.run(async () => {
      const data = await adminFetch<Record<string, unknown>>(
        `/api/admin/orders/shipping?action=${actionName}`,
        { method: 'POST', body: { orderId: detail.orderId } },
      );
      const waybill = data.waybill ? ` AWB ${String(data.waybill)}.` : '';
      setFlash(
        actionName === 'retry-sync'
          ? `Shipment created.${waybill}`
          : `Tracking refreshed.${waybill}`,
      );
      onChanged();
      const fresh = await adminFetch<{ order: AdminOrderDetail }>(
        `/api/admin/orders?orderId=${encodeURIComponent(detail.orderId)}`,
      );
      setDetail(fresh.order);
      return data;
    });
    return res;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" role="dialog" aria-modal="true" aria-label={`Order ${orderId}`}>
      <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="admin-focus flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-cream-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-cream-300 bg-cream-50 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-jaggery-500">{orderId}</h2>
            {detail ? (
              <p className="text-xs text-ink-muted">
                {formatDateTime(detail.createdAt)} · {detail.payment.method === 'COD' ? 'Cash on delivery' : 'Razorpay'}
              </p>
            ) : null}
          </div>
          <Btn onClick={onClose}>Close</Btn>
        </header>

        <div className="space-y-4 p-4">
          {loading && !detail ? <Loading /> : null}
          {error ? <InlineAlert tone="bad">{error}</InlineAlert> : null}
          {flash ? <InlineAlert tone="good">{flash}</InlineAlert> : null}
          {action.error ? <InlineAlert tone="bad">{action.error}</InlineAlert> : null}

          {detail ? (
            <>
              <Panel title="Status">
                <div className="mb-3 flex flex-wrap gap-2">
                  <StatusPill value={detail.status} map={ORDER_TONE} />
                  <StatusPill value={detail.payment.status} map={PAYMENT_TONE} />
                  <StatusPill value={detail.shipping.syncStatus} map={SYNC_TONE} />
                  <Pill tone="neutral">{detail.shipping.status.replace(/_/g, ' ')}</Pill>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminSelect
                    label="Move to"
                    value={statusChoice}
                    onChange={(e) => setStatusChoice(e.target.value)}
                    hint="SHIPPED and DELIVERED require a Delhivery waybill — create the shipment first."
                  >
                    <option value="">Choose a status…</option>
                    {ADMIN_SETTABLE_STATUSES.filter((s) => s !== detail.status).map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </AdminSelect>
                  <AdminInput
                    label="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. handed to courier"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn variant="primary" onClick={() => void setStatus()} disabled={!statusChoice || action.busy}>
                    Apply status change
                  </Btn>
                  {detail.shipping.waybill ? (
                    <Btn
                      onClick={() => void shipping('refresh')}
                      disabled={action.busy}
                      title="Pull the latest courier status onto this order"
                    >
                      Refresh tracking
                    </Btn>
                  ) : (
                    <Btn
                      onClick={() => void shipping('retry-sync')}
                      disabled={action.busy || detail.payment.status !== 'PAID'}
                      title={
                        detail.payment.status === 'PAID'
                          ? 'Create (or re-create) the Delhivery shipment'
                          : 'Only paid orders can be shipped'
                      }
                    >
                      {detail.shipping.syncStatus === 'FAILED' ? 'Retry shipment' : 'Create shipment'}
                    </Btn>
                  )}
                  {detail.shipping.trackingUrl ? (
                    <a
                      href={detail.shipping.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[38px] items-center rounded-lg border border-cream-400 bg-white px-3.5 text-sm font-semibold text-jaggery-500 hover:bg-cream-50"
                    >
                      Track with courier
                    </a>
                  ) : null}
                </div>

                {detail.shipping.syncStatus === 'FAILED' && detail.shipping.syncError ? (
                  <div className="mt-3">
                    <InlineAlert tone="bad" title={`Courier sync failed (attempt ${detail.shipping.syncAttempts})`}>
                      {detail.shipping.syncError}
                    </InlineAlert>
                  </div>
                ) : null}

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-jaggery-500">
                    Full status timeline ({detail.statusHistory.length})
                  </summary>
                  <ol className="mt-2 space-y-1.5 border-l border-cream-300 pl-3">
                    {[...detail.statusHistory].reverse().map((h, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-semibold text-ink">{h.status.replace(/_/g, ' ')}</span>{' '}
                        <span className="text-ink-faint">
                          · {formatDateTime(h.at)} · {h.source}
                        </span>
                        {h.note ? <span className="block text-ink-muted">{h.note}</span> : null}
                      </li>
                    ))}
                  </ol>
                </details>
              </Panel>

              <Panel title="Payment">
                <DefinitionList
                  items={[
                    { label: 'Amount', value: formatINR(detail.payment.amount) },
                    { label: 'Razorpay order', value: <span className="font-mono text-xs">{detail.payment.razorpayOrderId ?? '—'}</span> },
                    { label: 'Razorpay payment', value: <span className="font-mono text-xs">{detail.payment.razorpayPaymentId ?? '—'}</span> },
                    {
                      label: 'Signature verified',
                      value: detail.payment.signatureVerified ? 'Yes' : 'No',
                    },
                    detail.payment.method_ ? { label: 'Method', value: detail.payment.method_ } : null,
                    detail.payment.bank ? { label: 'Bank', value: detail.payment.bank } : null,
                    detail.payment.cardLast4 ? { label: 'Card', value: `•••• ${detail.payment.cardLast4}` } : null,
                    detail.payment.refundId
                      ? {
                          label: 'Refunded',
                          value: `${formatINR(detail.amountRefundedPaise)} · ${detail.payment.refundId}`,
                        }
                      : null,
                    detail.payment.failureDescription
                      ? { label: 'Failure', value: detail.payment.failureDescription }
                      : null,
                  ]}
                />

                {detail.payment.status === 'PAID' && detail.amountRefundedPaise < detail.totalPaise ? (
                  <div className="mt-4 border-t border-cream-200 pt-4">
                    <p className="text-xs font-semibold text-ink">Issue a refund</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Sends real money back through Razorpay. Admin accounts only.
                    </p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <MoneyInput
                        label="Refund amount (₹)"
                        paise={refundPaise}
                        onChange={setRefundPaise}
                        hint={`Refundable: ${formatINR(detail.totalPaise - detail.amountRefundedPaise)}`}
                      />
                      <AdminInput
                        label="Reason (optional)"
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="e.g. customer cancelled"
                      />
                    </div>
                    <div className="mt-3">
                      <Btn variant="danger" onClick={() => void issueRefund()} disabled={action.busy || !refundPaise}>
                        Issue refund
                      </Btn>
                    </div>
                  </div>
                ) : null}
              </Panel>

              <Panel title="Items">
                <ul className="divide-y divide-cream-200">
                  {detail.items.map((i, idx) => (
                    <li key={idx} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <Link
                          href={`/products/${i.slug}`}
                          target="_blank"
                          className="text-sm font-semibold text-jaggery-500 underline underline-offset-4"
                        >
                          {i.name}
                        </Link>
                        <span className="block text-2xs text-ink-faint">
                          {i.weightLabel} · {i.sku} · {formatINR(i.unitPricePaise)} × {i.qty}
                          {i.bundleName ? ` · part of ${i.bundleName}` : ''}
                        </span>
                      </span>
                      <span className="tabular-nums text-sm font-semibold text-ink">
                        {formatINR(i.lineTotalPaise)}
                      </span>
                    </li>
                  ))}
                </ul>
                <DefinitionList
                  className="mt-2"
                  items={[
                    { label: 'Subtotal', value: formatINR(detail.subtotalPaise) },
                    detail.discountPaise > 0
                      ? { label: 'Discount', value: `− ${formatINR(detail.discountPaise)}` }
                      : null,
                    detail.couponCode
                      ? { label: 'Coupon', value: `${detail.couponCode} (− ${formatINR(detail.couponDiscountPaise ?? 0)})` }
                      : null,
                    { label: 'Shipping', value: formatINR(detail.shippingChargedPaise) },
                    detail.taxPaise > 0 ? { label: 'Tax', value: formatINR(detail.taxPaise) } : null,
                    { label: 'Total', value: <strong>{formatINR(detail.totalPaise)}</strong> },
                    detail.amountRefundedPaise > 0
                      ? { label: 'Refunded', value: formatINR(detail.amountRefundedPaise) }
                      : null,
                  ]}
                />
              </Panel>

              <Panel title="Delivery address">
                <DefinitionList
                  items={[
                    { label: 'Name', value: detail.shippingAddress.name },
                    { label: 'Phone', value: detail.shippingAddress.phone },
                    detail.shippingAddress.email
                      ? { label: 'Email', value: detail.shippingAddress.email }
                      : null,
                    {
                      label: 'Address',
                      value: (
                        <>
                          {detail.shippingAddress.line1}
                          {detail.shippingAddress.line2 ? `, ${detail.shippingAddress.line2}` : ''}
                          {detail.shippingAddress.landmark ? `, near ${detail.shippingAddress.landmark}` : ''}
                          <br />
                          {detail.shippingAddress.city}, {detail.shippingAddress.state}{' '}
                          {detail.shippingAddress.pincode}, {detail.shippingAddress.country}
                        </>
                      ),
                    },
                    { label: 'Serviceability', value: detail.shippingAddress.serviceability },
                  ]}
                />
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {detail.shipping.waybill ? (
                    <Pill tone="jaggery">AWB {detail.shipping.waybill}</Pill>
                  ) : (
                    <Pill tone="neutral">No waybill</Pill>
                  )}
                  {detail.shipping.lastStatusText ? (
                    <span className="self-center text-ink-muted">{detail.shipping.lastStatusText}</span>
                  ) : null}
                </div>
              </Panel>

              <Panel title="Notes">
                {detail.customerNote ? (
                  <p className="mb-3 rounded-lg bg-cream-100 px-3 py-2 text-sm text-ink-soft">
                    <span className="block text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                      Customer note
                    </span>
                    {detail.customerNote}
                  </p>
                ) : null}
                <AdminTextarea
                  label="Internal note"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  hint="Staff-only. Never shown to the customer."
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn onClick={() => void saveNote()} disabled={action.busy}>
                    Save note
                  </Btn>
                  {detail.cancelReason ? (
                    <Pill tone="bad">Cancelled: {detail.cancelReason}</Pill>
                  ) : null}
                </div>
              </Panel>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}