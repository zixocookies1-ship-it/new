'use client';

import Link from 'next/link';
import { useState } from 'react';

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
  PageHeader,
  Panel,
  Pill,
  Table,
  Td,
  Th,
  Toolbar,
} from './ui';
import type { AdminCustomer, AdminStaffUser, Pagination } from './types';
import { formatINR } from '@/lib/money';

interface CustomersResponse {
  customers: AdminCustomer[];
  pagination: Pagination;
  staff: AdminStaffUser[];
}

interface SessionResponse {
  authenticated: boolean;
  user: { id: string; email: string; role: 'ADMIN' | 'EDITOR' | 'SUPPORT'; name: string } | null;
}

const ROLE_HELP: Record<AdminStaffUser['role'], string> = {
  ADMIN: 'Full access, including staff accounts, refunds and shipping.',
  EDITOR: 'Catalogue and content. Cannot refund, ship or manage staff.',
  SUPPORT: 'Orders and customer messages only. Catalogue is read-only.',
};

const PASSWORD_RULE =
  'At least 10 characters, including an uppercase letter, a lowercase letter and a number.';

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(d);
}

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `tel:+91${digits}` : '#';
}

/**
 * Customers and staff.
 *
 * Shoppers are *derived from orders* rather than stored in their own table —
 * checkout never forces an account, so there is nothing else to read. Staff live
 * in the `users` collection and are listed separately so nobody confuses a shop
 * admin with a buyer. Mutating staff is ADMIN-only on the server; the gate here
 * is only a courtesy so an EDITOR is not shown buttons that will be refused.
 */
interface CustomersClientProps {
  initial: { q?: string };
}

export function CustomersClient({ initial }: CustomersClientProps) {
  const [q, setQ] = useState(initial.q ?? '');
  const [term, setTerm] = useState(initial.q ?? '');
  const [page, setPage] = useState(1);

  const path = `/api/admin/customers?limit=25&page=${page}&q=${encodeURIComponent(term)}`;
  const { data, error, loading, reload } = useAdminData<CustomersResponse>(path);
  const session = useAdminData<SessionResponse>('/api/admin/auth');

  const role = session.data?.user?.role ?? null;
  const canManage = role === 'ADMIN';

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone who has placed an order, grouped by mobile number. No account is needed to buy."
      />

      <Toolbar>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setTerm(q.trim());
          }}
        >
          <AdminInput
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, mobile or email"
            className="w-full sm:w-72"
          />
          <Btn type="submit">Search</Btn>
          {term ? (
            <Btn
              variant="ghost"
              onClick={() => {
                setQ('');
                setTerm('');
                setPage(1);
              }}
            >
              Clear
            </Btn>
          ) : null}
        </form>
      </Toolbar>

      {error ? (
        <div className="mb-4">
          <InlineAlert tone="bad" title="Could not load customers">
            {error}
          </InlineAlert>
        </div>
      ) : null}

      <div className="space-y-4">
        <Panel
          title="Shoppers"
          description="Derived from orders. A row disappears only when its orders are removed — never from here."
        >
          {loading && !data ? (
            <Loading label="Loading customers…" />
          ) : (
            <>
              <Table
                minWidth={780}
                headers={
                  <>
                    <Th>Customer</Th>
                    <Th>Mobile</Th>
                    <Th>Email</Th>
                    <Th className="text-right">Orders</Th>
                    <Th className="text-right">Paid</Th>
                    <Th>Last order</Th>
                    <Th />
                  </>
                }
              >
                {data?.customers.length ? (
                  data.customers.map((c) => (
                    <tr key={c.key}>
                      <Td className="font-semibold text-ink">{c.name || '—'}</Td>
                      <Td>
                        <a
                          href={telHref(c.phone)}
                          className="font-mono text-xs underline underline-offset-4"
                        >
                          {c.phone}
                        </a>
                        {c.cities.length ? (
                          <span className="ml-1.5 text-2xs text-ink-faint">{c.cities.join(', ')}</span>
                        ) : null}
                      </Td>
                      <Td className="text-xs">{c.email ?? '—'}</Td>
                      <Td className="text-right tabular-nums">{c.orderCount}</Td>
                      <Td className="text-right tabular-nums">{formatINR(c.paidPaise)}</Td>
                      <Td className="whitespace-nowrap text-xs">{formatDate(c.lastOrderAt)}</Td>
                      <Td className="text-right">
                        <Link
                          href={`/admin/orders?q=${encodeURIComponent(c.phone)}`}
                          className="whitespace-nowrap text-xs font-semibold text-jaggery-500 underline underline-offset-4"
                        >
                          View orders
                        </Link>
                      </Td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow
                    colSpan={7}
                    message={
                      term
                        ? `No customer matches “${term}”.`
                        : 'No orders yet. Customers appear here as soon as the first order lands.'
                    }
                  />
                )}
              </Table>

              {data && data.pagination.pages > 1 ? (
                <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-3 text-xs text-ink-muted">
                  <span>
                    Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total}{' '}
                    {data.pagination.total === 1 ? 'customer' : 'customers'}
                  </span>
                  <div className="flex gap-2">
                    <Btn
                      size="sm"
                      disabled={data.pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Btn>
                    <Btn
                      size="sm"
                      disabled={data.pagination.page >= data.pagination.pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Btn>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </Panel>

        <StaffPanel staff={data?.staff ?? []} role={role} onChanged={reload} />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Staff accounts                                                              */
/* -------------------------------------------------------------------------- */

interface StaffDraft {
  id: string | null;
  name: string;
  email: string;
  role: AdminStaffUser['role'];
  isActive: boolean;
  password: string;
}

const EMPTY_DRAFT: StaffDraft = {
  id: null,
  name: '',
  email: '',
  role: 'EDITOR',
  isActive: true,
  password: '',
};

function StaffPanel({
  staff,
  role,
  onChanged,
}: {
  staff: AdminStaffUser[];
  role: AdminStaffUser['role'] | null;
  onChanged: () => void;
}) {
  const canManage = role === 'ADMIN';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StaffDraft>(EMPTY_DRAFT);
  const [resetFor, setResetFor] = useState<AdminStaffUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmFor, setConfirmFor] = useState<AdminStaffUser | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const action = useAdminAction();

  function patch<K extends keyof StaffDraft>(key: K, value: StaffDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function close() {
    setOpen(false);
    setDraft(EMPTY_DRAFT);
    setResetFor(null);
    setResetPassword('');
    setConfirmFor(null);
  }

  async function save() {
    const saved = await action.run(() =>
      adminFetch<{ id: string }>('/api/admin/customers', {
        method: 'PUT',
        body: {
          id: draft.id ?? undefined,
          name: draft.name,
          email: draft.email,
          role: draft.role,
          isActive: draft.isActive,
          // Blank on edit means "keep the current password".
          password: draft.password ? draft.password : undefined,
        },
      }),
    );
    if (saved) {
      setNote(draft.id ? 'Account updated.' : 'Account created.');
      close();
      onChanged();
    }
  }

  async function doReset() {
    if (!resetFor) return;
    const done = await action.run(() =>
      adminFetch<{ passwordUpdated: boolean }>('/api/admin/customers', {
        method: 'PATCH',
        body: { id: resetFor.id, password: resetPassword },
      }),
    );
    if (done) {
      setNote(`Password reset for ${resetFor.email}.`);
      close();
    }
  }

  async function doDeactivate() {
    if (!confirmFor) return;
    const done = await action.run(() =>
      adminFetch<{ isActive: boolean }>(
        `/api/admin/customers?id=${encodeURIComponent(confirmFor.id)}`,
        { method: 'DELETE' },
      ),
    );
    if (done) {
      setNote(`${confirmFor.email} can no longer sign in.`);
      setConfirmFor(null);
      onChanged();
    }
  }

  return (
    <Panel
      title="Staff accounts"
      description="Only these accounts can sign in to this panel. Shoppers never need an account."
      action={
        canManage ? (
          <Btn variant={open ? 'ghost' : 'primary'} size="sm" onClick={() => (open ? close() : setOpen(true))}>
            {open ? 'Close' : '+ Add staff'}
          </Btn>
        ) : (
          <Pill tone="neutral">Read only</Pill>
        )
      }
    >
      {canManage ? null : (
        <div className="mb-4">
          <InlineAlert tone="info">
            Only an ADMIN can create or change staff accounts
            {role ? ` — you are signed in as ${role}` : ''}. Ask an admin if someone needs access.
          </InlineAlert>
        </div>
      )}

      {action.error ? (
        <div className="mb-4">
          <InlineAlert tone="bad">{action.error}</InlineAlert>
        </div>
      ) : null}
      {note && !action.error ? (
        <div className="mb-4">
          <InlineAlert tone="good">{note}</InlineAlert>
        </div>
      ) : null}

      {open ? (
        <div className="mb-5 rounded-lg border border-jaggery-500/25 bg-jaggery-50/40 p-4">
          <h3 className="font-display text-sm text-jaggery-500">
            {resetFor
              ? `Reset password for ${resetFor.email}`
              : draft.id
                ? 'Edit staff account'
                : 'New staff account'}
          </h3>

          {resetFor ? (
            <div className="mt-3 max-w-sm space-y-3">
              <InlineAlert tone="warn">
                This signs the account out everywhere and requires the new password on their next
                sign-in. Share it over a channel you trust — this panel will not show it again.
              </InlineAlert>
              <AdminInput
                label="New password"
                type="password"
                autoComplete="new-password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                hint={PASSWORD_RULE}
              />
              <div className="flex gap-2">
                <Btn
                  variant="primary"
                  onClick={() => void doReset()}
                  disabled={action.busy || resetPassword.length < 10}
                >
                  {action.busy ? 'Saving…' : 'Set password'}
                </Btn>
                <Btn onClick={close}>Cancel</Btn>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <AdminInput
                label="Full name"
                value={draft.name}
                onChange={(e) => patch('name', e.target.value)}
                required
              />
              <AdminInput
                label="Email"
                type="email"
                autoComplete="off"
                value={draft.email}
                onChange={(e) => patch('email', e.target.value)}
                required
              />
              <AdminSelect
                label="Role"
                value={draft.role}
                onChange={(e) => patch('role', e.target.value as StaffDraft['role'])}
                hint={ROLE_HELP[draft.role]}
              >
                <option value="ADMIN">ADMIN</option>
                <option value="EDITOR">EDITOR</option>
                <option value="SUPPORT">SUPPORT</option>
              </AdminSelect>
              <AdminInput
                label={draft.id ? 'New password (optional)' : 'Password'}
                type="password"
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) => patch('password', e.target.value)}
                required={!draft.id}
                hint={draft.id ? 'Leave blank to keep the current password.' : PASSWORD_RULE}
              />
              <div className="sm:col-span-2">
                <AdminToggle
                  label="Account is active"
                  description="An inactive account cannot sign in, but its history is kept."
                  checked={draft.isActive}
                  onChange={(v) => patch('isActive', v)}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Btn
                  variant="primary"
                  onClick={() => void save()}
                  disabled={
                    action.busy ||
                    draft.name.trim().length < 2 ||
                    draft.email.trim().length < 5 ||
                    (!draft.id && draft.password.length < 10)
                  }
                >
                  {action.busy ? 'Saving…' : draft.id ? 'Save changes' : 'Create account'}
                </Btn>
                <Btn onClick={close}>Cancel</Btn>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {confirmFor ? (
        <div className="mb-5 rounded-lg border border-[#E6C9C9] bg-[#FDF6F6] p-4">
          <p className="text-sm text-[#8F3333]">
            Deactivate <strong>{confirmFor.email}</strong>? They will be blocked from signing in
            again. Their order history and the content they edited are kept.
          </p>
          <div className="mt-3 flex gap-2">
            <Btn variant="danger" onClick={() => void doDeactivate()} disabled={action.busy}>
              {action.busy ? 'Working…' : 'Deactivate account'}
            </Btn>
            <Btn onClick={() => setConfirmFor(null)}>Keep active</Btn>
          </div>
        </div>
      ) : null}

      <Table
        minWidth={680}
        headers={
          <>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>State</Th>
            <Th>Last sign-in</Th>
            <Th />
          </>
        }
      >
        {staff.length ? (
          staff.map((u) => (
            <tr key={u.id}>
              <Td className="font-semibold text-ink">{u.name}</Td>
              <Td className="text-xs">{u.email}</Td>
              <Td>
                <Pill tone={u.role === 'ADMIN' ? 'jaggery' : 'neutral'}>{u.role}</Pill>
              </Td>
              <Td>
                <Pill tone={u.isActive ? 'good' : 'bad'}>{u.isActive ? 'ACTIVE' : 'INACTIVE'}</Pill>
              </Td>
              <Td className="whitespace-nowrap text-xs">{formatDate(u.lastLoginAt)}</Td>
              <Td className="text-right">
                {canManage ? (
                  <div className="flex justify-end gap-1.5">
                    <Btn
                      size="sm"
                      onClick={() => {
                        setDraft({
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          role: u.role,
                          isActive: u.isActive,
                          password: '',
                        });
                        setResetFor(null);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Btn>
                    <Btn
                      size="sm"
                      onClick={() => {
                        setResetFor(u);
                        setResetPassword('');
                        setOpen(true);
                      }}
                    >
                      Reset password
                    </Btn>
                    {u.isActive ? (
                      <Btn size="sm" variant="danger" onClick={() => setConfirmFor(u)}>
                        Deactivate
                      </Btn>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-2xs text-ink-faint">—</span>
                )}
              </Td>
            </tr>
          ))
        ) : (
          <EmptyRow colSpan={6} message="No staff accounts yet. Create the first with: npm run seed:admin" />
        )}
      </Table>
    </Panel>
  );
}