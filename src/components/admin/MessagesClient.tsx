'use client';

import { useState } from 'react';

import { adminFetch } from './api';
import { useAdminData } from './useAdminData';
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
  type PillTone,
} from './ui';
import type { AdminMessage, Pagination } from './types';

interface MessagesResponse {
  messages: AdminMessage[];
  pagination: Pagination;
  newCount: number;
}

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM', 'ALL'] as const;

const TONE: Record<AdminMessage['status'], PillTone> = {
  NEW: 'warn',
  IN_PROGRESS: 'info',
  RESOLVED: 'good',
  SPAM: 'bad',
};

/** Contact-form inbox. Replies are recorded here, not emailed — the store has no mail provider yet. */
export function MessagesClient() {
  const [status, setStatus] = useState<string>('NEW');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const path = `/api/admin/contact?limit=25&page=${page}&status=${status}&q=${encodeURIComponent(q)}`;
  const { data, error, loading, reload } = useAdminData<MessagesResponse>(path);

  return (
    <>
      <PageHeader
        title="Messages"
        description="Enquiries from the contact form. Reply from here and record it — no email is sent automatically."
        action={
          <Pill tone={data?.newCount ? 'warn' : 'neutral'}>{data?.newCount ?? 0} unread</Pill>
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
          placeholder="Name, email, phone or text"
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
              {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
            </option>
          ))}
        </AdminSelect>
      </Toolbar>

      {error ? (
        <div className="mb-4">
          <InlineAlert tone="bad">{error}</InlineAlert>
        </div>
      ) : null}

      {loading && !data ? (
        <Loading />
      ) : !data?.messages.length ? (
        <Panel>
          <p className="py-10 text-center text-sm text-ink-muted">Nothing here.</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {data.messages.map((m) => (
            <MessageCard key={m.id} message={m} reload={reload} />
          ))}
        </div>
      )}

      {data && data.pagination.pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-ink-muted">
            Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total}
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
    </>
  );
}

function MessageCard({ message, reload }: { message: AdminMessage; reload: () => void }) {
  const [status, setStatus] = useState<AdminMessage['status']>(message.status);
  const [reply, setReply] = useState(message.adminReply ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contact?id=${message.id}`, {
        method: 'PATCH',
        body: { status, adminReply: reply },
      });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this message.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this message permanently?')) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contact?id=${message.id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {message.name}
            <Pill tone={TONE[message.status]}>{message.status.replace(/_/g, ' ')}</Pill>
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            <a href={`mailto:${message.email}`} className="underline underline-offset-4">
              {message.email}
            </a>{' '}
            · <a href={`tel:${message.phone}`} className="underline underline-offset-4">{message.phone}</a> ·{' '}
            {new Date(message.createdAt).toLocaleString('en-IN')}
            {message.source ? ` · via ${message.source}` : ''}
          </p>
        </div>
        <p className="text-sm font-semibold text-jaggery-500">{message.subject}</p>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{message.message}</p>

      {error ? (
        <div className="mt-3">
          <InlineAlert tone="bad">{error}</InlineAlert>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 border-t border-cream-200 pt-4 sm:grid-cols-[180px_1fr_auto] sm:items-start">
        <AdminSelect
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as AdminMessage['status'])}
        >
          {(['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM'] as const).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </AdminSelect>
        <AdminTextarea
          label="Your reply (recorded here)"
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          hint="Store this so the next person knows what was already answered. Send it from your own email client too."
        />
        <div className="flex gap-2 sm:pt-6">
          <Btn variant="primary" size="sm" onClick={() => void save()} disabled={busy}>
            Save
          </Btn>
          <Btn size="sm" variant="danger" onClick={() => void remove()} disabled={busy}>
            Delete
          </Btn>
        </div>
      </div>
    </Panel>
  );
}