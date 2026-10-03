'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { adminFetch } from '@/lib/admin-fetch';
import { useAdminAction, useAdminData } from '@/components/admin/useAdminData';
import {
  Btn,
  DefinitionList,
  EmptyRow,
  InlineAlert,
  Loading,
  MoneyInput,
  Pill,
  StatusPill,
  Table,
  Td,
  Th,
  Toolbar,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from '@/components/admin/ui';
import type { AdminOrderRow, Pagination } from '@/components/admin/types';
import { formatINR } from '@/lib/money';
import { ORDER_TONE } from '@/components/admin/types';

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
      <h1 className="font-display text-2xl text-jaggery-500 mb-4">Orders</h1>

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

      <div className="rounded-xl border border-cream-300 bg-white p-4 sm:p-6">
        <Table minWidth={980} headers={<> <Th>Order</Th> <Th>Placed</Th> <Th>Customer</Th> <Th>Items</Th> <Th>Total</Th> <Th>Status</Th> <Th>Payment</Th> <Th>Shipping</Th> <Th /></>}>
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
                  <StatusPill value={o.paymentStatus} map={{ PENDING: 'warn', PAID: 'good', FAILED: 'bad', REFUNDED: 'neutral' }} />
                  <span className="mt-0.5 block text-2xs text-ink-faint">
                    {o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Razorpay'}
                  </span>
                </Td>
                <Td className="text-xs">
                  <span className="block">{o.shippingStatus.replace(/_/g, ' ').toLowerCase()}</span>
                  {o.waybill ? (
                    <span className="block font-mono text-2xs text-ink-faint">AWB {o.waybill}</span>
                  ) : null}
                  <StatusPill value={o.syncStatus} map={{ IDLE: 'neutral', PENDING: 'warn', SUCCESS: 'good', FAILED: 'bad' }} />
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
      </div>

      {openId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" role="dialog" aria-label={`Order ${openId}`}>
          <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={() => setOpenId(null)} />
          <div className="admin-focus flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-cream-50 shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-cream-300 bg-cream-50 px-4 py-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg text-jaggery-500">{openId}</h2>
              </div>
              <Btn onClick={() => setOpenId(null)}>Close</Btn>
            </header>
            {/* Order details drawer would go here */}
            <p className="p-4 text-sm text-ink-muted">Order details drawer would appear here</p>
          </div>
        </div>
      ) : null}
    </>
  );
}