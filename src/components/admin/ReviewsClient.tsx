'use client';

import Link from 'next/link';
import { useState } from 'react';

import { adminFetch } from './api';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  Btn,
  InlineAlert,
  Loading,
  PageHeader,
  Panel,
  Pill,
  Toolbar,
} from './ui';
import { Rating } from '@/components/ui/Rating';
import type { AdminReview, Pagination } from './types';

interface ReviewsResponse {
  reviews: AdminReview[];
  pagination: Pagination;
  pendingCount: number;
}

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const;

/**
 * Review moderation.
 *
 * A review only appears on the storefront when it is APPROVED **and**
 * permission to publish is confirmed, so the approve button deliberately asks
 * for both. Verified-purchase status is derived server-side from real orders
 * and can only be downgraded here, never asserted.
 */
export function ReviewsClient() {
  const [status, setStatus] = useState<string>('PENDING');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const path = `/api/admin/reviews?limit=25&page=${page}&status=${status}&q=${encodeURIComponent(q)}`;
  const { data, error, loading, reload } = useAdminData<ReviewsResponse>(path);
  const action = useAdminAction();

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Customer reviews stay hidden until a human approves them and confirms permission to publish."
        action={
          <Pill tone={data?.pendingCount ? 'warn' : 'neutral'}>
            {data?.pendingCount ?? 0} awaiting review
          </Pill>
        }
      />

      <Toolbar>
        <AdminInput
          label="Search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Name, title or text"
          className="w-full sm:w-64"
        />
        <AdminSelect
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-48"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All' : s}
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

      {loading && !data ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          {!data?.reviews.length ? (
            <Panel>
              <p className="py-10 text-center text-sm text-ink-muted">
                No reviews with this filter.
              </p>
            </Panel>
          ) : (
            data.reviews.map((r) => (
              <ReviewRow key={r.id} review={r} reload={reload} />
            ))
          )}

          {data && data.pagination.pages > 1 ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-muted">
                Page {data.pagination.page} of {data.pagination.pages}
              </span>
              <div className="flex gap-2">
                <Btn size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Btn>
                <Btn size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Btn>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

/** Tiny inline search box so the toolbar does not need a full form. */
function ReviewRow({ review, reload }: { review: AdminReview; reload: () => void }) {
  const [note, setNote] = useState(review.moderationNote ?? '');
  const [permission, setPermission] = useState(review.permissionConfirmed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function moderate(next: 'APPROVED' | 'REJECTED' | 'PENDING') {
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      await adminFetch(`/api/admin/reviews?id=${review.id}`, {
        method: 'PATCH',
        body: { status: next, moderationNote: note, permissionConfirmed: permission },
      });
      setFlash(`Saved as ${next}.`);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this review.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this review permanently? It cannot be recovered.')) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/reviews?id=${review.id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this review.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{review.authorName}</span>
            {review.authorLocation ? (
              <span className="text-xs text-ink-faint">{review.authorLocation}</span>
            ) : null}
            {/* One review is on screen, so the "average of N" framing is N=1. */}
            <Rating value={review.rating} count={1} size="sm" />
            <Pill
              tone={
                review.status === 'APPROVED' ? 'good' : review.status === 'REJECTED' ? 'bad' : 'warn'
              }
            >
              {review.status}
            </Pill>
            {review.isVerifiedPurchase ? <Pill tone="jaggery">Verified purchase</Pill> : null}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            on{' '}
            <Link href={`/products/${review.productSlug}`} className="underline underline-offset-4">
              {review.productName}
            </Link>
            {review.orderId ? <span className="font-mono"> · {review.orderId}</span> : null} ·{' '}
            {new Date(review.createdAt).toLocaleDateString('en-IN')}
          </p>
        </div>
      </div>

      {review.title ? <p className="mt-3 text-sm font-semibold text-ink">{review.title}</p> : null}
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{review.body}</p>

      {!review.permissionConfirmed ? (
        <div className="mt-3">
          <InlineAlert tone="warn">
            Permission to publish is not confirmed. This review will stay off the storefront even if
            you set the status to Approved.
          </InlineAlert>
        </div>
      ) : null}

      {flash ? (
        <div className="mt-3">
          <InlineAlert tone="good">{flash}</InlineAlert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <InlineAlert tone="bad">{error}</InlineAlert>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 border-t border-cream-200 pt-4 sm:grid-cols-2">
        <AdminTextarea
          label="Internal moderation note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          hint="Kept for your team; never shown publicly."
        />
        <div>
          <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-ink">
            <input
              type="checkbox"
              checked={permission}
              onChange={(e) => setPermission(e.target.checked)}
              className="h-4 w-4 accent-[#5A321F]"
            />
            The customer gave permission to publish this
          </label>
          <p className="text-xs text-ink-muted">
            Required before the review can appear on the product page.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void moderate('APPROVED')}
              title={permission ? undefined : 'Tick the permission box first'}
            >
              Approve
            </Btn>
            <Btn size="sm" disabled={busy} onClick={() => void moderate('PENDING')}>
              Hold
            </Btn>
            <Btn size="sm" disabled={busy} onClick={() => void moderate('REJECTED')}>
              Reject
            </Btn>
            <Btn size="sm" variant="danger" disabled={busy} onClick={() => void remove()}>
              Delete
            </Btn>
          </div>
        </div>
      </div>
    </Panel>
  );
}