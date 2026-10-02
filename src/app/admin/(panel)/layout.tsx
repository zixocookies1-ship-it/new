import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminNav } from '@/components/admin/AdminNav';
import { SignOutButton } from '@/components/admin/SignOutButton';
import { getSession } from '@/lib/auth';
import { integrationState } from '@/lib/env';
import { getIntegrationChecklist } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

/**
 * Authenticated admin shell.
 *
 * The guard is server-side and non-negotiable: every page inside this group is
 * unreachable without a valid session cookie that is re-checked against MongoDB
 * on each request. Client-side hiding is never treated as authorisation — the
 * API routes independently call `guardAdmin()`.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  if (integrationState('auth') !== 'configured') {
    // Nothing to sign in to. Send them to the explanatory login page.
    redirect('/admin/login');
  }

  const session = await getSession().catch(() => null);
  if (!session) redirect('/admin/login');

  const checklist = getIntegrationChecklist();
  const missing = checklist.filter((c) => c.state === 'missing');

  return (
    <div className="admin-focus flex min-h-screen flex-col lg:flex-row">
      {/* --------------------------------------------------------------- */}
      {/* Sidebar                                                          */}
      {/* --------------------------------------------------------------- */}
      <aside className="admin-no-print bg-jaggery-500 text-cream-50 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3.5 lg:block">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-cream-50/15">
              <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M11 11.5h10l-.9 12.2a2 2 0 0 1-2 1.8h-4.2a2 2 0 0 1-2-1.8L11 11.5Z"
                  fill="currentColor"
                  fillOpacity="0.25"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M9.6 11.5h12.8M13 11.5V9.8a3 3 0 0 1 6 0v1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-base">Nature&rsquo;s Choice</span>
              <span className="mt-0.5 text-2xs font-semibold uppercase tracking-widest text-cream-200/70">
                Admin
              </span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-cream-200/80 underline underline-offset-4 lg:hidden"
          >
            Storefront
          </Link>
        </div>

        <AdminNav />

        <div className="border-t border-cream-50/15 px-4 py-3.5">
          <p className="text-sm font-medium">{session.name || session.email}</p>
          <p className="text-2xs uppercase tracking-wide text-cream-200/70">{session.role}</p>
          <div className="mt-2.5 flex items-center gap-3">
            <SignOutButton />
            <Link
              href="/"
              className="hidden text-xs font-medium text-cream-200/80 underline underline-offset-4 hover:text-cream-50 lg:inline"
            >
              View storefront
            </Link>
          </div>
        </div>
      </aside>

      {/* --------------------------------------------------------------- */}
      {/* Content                                                          */}
      {/* --------------------------------------------------------------- */}
      <div className="min-w-0 flex-1">
        {missing.length > 0 ? (
          <div className="border-b border-ginger-200 bg-ginger-50 px-4 py-2.5 sm:px-6">
            <p className="text-xs leading-relaxed text-ginger-800">
              <span className="font-semibold">
                {missing.length} integration{missing.length === 1 ? '' : 's'} not configured:
              </span>{' '}
              {missing.map((m) => m.label.split(' (')[0]).join(', ')}. The storefront does not
              advertise anything that is not actually connected.
            </p>
          </div>
        ) : null}

        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">{children}</div>
      </div>
    </div>
  );
}
