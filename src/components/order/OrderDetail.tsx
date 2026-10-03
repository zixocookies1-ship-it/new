import Link from 'next/link';
import type { ReactNode } from 'react';

import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Alert, Badge } from '@/components/ui/StateBlocks';
import { formatINR } from '@/lib/money';
import { ALL_ROUTES } from '@/lib/site';
import {
  formatOrderDate,
  humanStatus,
  ORDER_STATUS_TONE,
  orderHeadline,
  type PublicOrderView,
} from '@/lib/order-view';

/**
 * The customer-facing order card.
 *
 * Shared by the post-purchase page so a customer sees the
 * exact same information in both places. It renders whatever the database says
 * — including "we do not know yet" and courier failures — and never fills a gap
 * with an estimate.
 */
export function OrderDetail({
  order,
  liveError,
  children,
}: {
  order: PublicOrderView;
  liveError?: string | null;
  children?: ReactNode;
}) {
  const headline = orderHeadline(order);

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* Headline + status                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="nc-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-eyebrow text-ink-muted">
              Order
            </p>
            <p className="mt-1 font-display text-2xl text-jaggery-500 sm:text-3xl">
              {order.orderId}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Placed {formatOrderDate(order.placedAt)}
            </p>
          </div>
          <div className="text-right">
            <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>{headline.title}</Badge>
            <p className="mt-2 text-xs text-ink-muted">
              Payment: {humanStatus(order.payment.status)} ·{' '}
              {humanStatus(order.payment.method)}
            </p>
            <p className="text-base font-semibold tabular-nums text-jaggery-500">
              {formatINR(order.payment.amountPaise)}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-soft">{headline.body}</p>

        {order.payment.status === 'PENDING' && order.payment.method === 'RAZORPAY' ? (
          <Alert tone="warning" title="Payment not completed" className="mt-4">
            <p>
              This order exists but the payment has not been confirmed. If you were
              charged and it has not appeared,{' '}
              <Link href={ALL_ROUTES.contact} className="nc-link">
                tell us
              </Link>{' '}
              with the order ID above — do not place a second order.
            </p>
          </Alert>
        ) : null}

        {order.payment.refundId ? (
          <Alert tone="info" title="Refund recorded" className="mt-4">
            <p>
              The payment gateway has issued a refund (reference{' '}
              <span className="font-mono text-xs">{order.payment.refundId}</span>). Your
              bank usually credits it within a few working days.
            </p>
          </Alert>
        ) : null}

        {children}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Courier                                                            */}
      {/* ------------------------------------------------------------------ */}
      {order.shipping.waybill ? (
        <div className="rounded-card border border-cream-300 bg-cream-50 p-4">
          <p className="text-sm font-semibold text-ink">
            {order.shipping.carrier || 'Courier'} ·{' '}
            <span className="font-mono">{order.shipping.waybill}</span>
          </p>
          {order.shipping.lastStatusText ? (
            <p className="mt-1 text-sm text-ink-muted">{order.shipping.lastStatusText}</p>
          ) : null}
          {order.shipping.lastSyncedAt ? (
            <p className="mt-1 text-xs text-ink-faint">
              Last updated {formatOrderDate(order.shipping.lastSyncedAt)}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {order.shipping.trackingUrl ? (
              <a
                href={order.shipping.trackingUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="nc-btn-outline nc-btn-sm"
              >
                Track with the courier
              </a>
            ) : null}
            <Link href={ALL_ROUTES.contact} className="nc-link text-sm">
              Something looks wrong?
            </Link>
          </div>
        </div>
      ) : order.status === 'CANCELLED' || order.status === 'REFUNDED' ? null : (
        <p className="px-1 text-sm text-ink-muted">
          A tracking number appears here once the parcel has been handed to the courier.
        </p>
      )}

      {/* A failed courier sync is disclosed, never silently hidden. */}
      {order.shipping.syncStatus === 'FAILED' ? (
        <Alert tone="warning" title="Live tracking unavailable">
          <p>
            We could not reach the courier for the latest update
            {order.shipping.syncError ? `: ${order.shipping.syncError}` : '.'} Our team
            can give you the status directly.
          </p>
        </Alert>
      ) : liveError ? (
        <Alert tone="info" title="Courier tracking is not responding">
          <p>The last known status is shown above and on the timeline below.</p>
        </Alert>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Items                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="nc-card p-5 sm:p-6">
        <h2 className="font-display text-lg text-jaggery-500">Items in this order</h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item, i) => (
            <li key={`${item.name}-${i}`} className="flex items-center gap-3">
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-cream-300 bg-cream-50">
                <OptimizedImage
                  src={item.imageUrl}
                  alt={item.name}
                  aspect="1/1"
                  fit="contain"
                  sizes="56px"
                  maxWidth={160}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{item.name}</span>
                <span className="block text-xs text-ink-faint">
                  {item.weightLabel}
                  {item.qty > 1 ? ` · ×${item.qty}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-1.5 border-t border-cream-200 pt-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <dt className="text-ink-muted">Delivering to</dt>
            <dd className="text-right text-ink">
              {order.shipTo.name}
              <span className="block text-xs text-ink-muted">
                {[order.shipTo.city, order.shipTo.state, order.shipTo.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Timeline                                                           */}
      {/* ------------------------------------------------------------------ */}
      {order.timeline.length > 0 ? (
        <div className="nc-card p-5 sm:p-6">
          <h2 className="font-display text-lg text-jaggery-500">Order history</h2>
          <ol className="mt-4 space-y-4">
            {order.timeline.map((event, i) => (
              <li key={`${event.status}-${i}`} className="flex gap-3">
                <span className="relative flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      i === 0 ? 'bg-ginger-500' : 'bg-cream-400'
                    }`}
                  />
                  {i < order.timeline.length - 1 ? (
                    <span aria-hidden="true" className="mt-1 w-px flex-1 bg-cream-300" />
                  ) : null}
                </span>
                <span className="min-w-0 pb-1">
                  <span className="block text-sm font-semibold text-ink">
                    {humanStatus(event.status)}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {formatOrderDate(event.at)}
                  </span>
                  {event.note ? (
                    <span className="mt-0.5 block text-xs text-ink-muted">{event.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
