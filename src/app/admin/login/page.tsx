import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { LoginForm } from '@/components/admin/LoginForm';
import { getSession } from '@/lib/auth';
import { integrationState } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Already signed in? Skip the form entirely.
  const session = await getSession().catch(() => null);
  if (session) redirect(safeNext(next) ?? '/admin');

  // A valid `next` must be a same-origin path, never an absolute URL — this
  // prevents the login form being used as an open redirect.
  const redirectTo = safeNext(next);

  const authConfigured = integrationState('auth') === 'configured';

  return (
    <main className="flex min-h-screen items-center justify-center bg-jaggery-500 px-5 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-cream-300 bg-white p-6 shadow-card-hover sm:p-8">
          <div className="text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-cream-500 text-cream-50">
              <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" aria-hidden="true">
                <path
                  d="M11 11.5h10l-.9 12.2a2 2 0 0 1-2 1.8h-4.2a2 2 0 0 1-2-1.8L11 11.5Z"
                  fill="currentColor"
                  fillOpacity="0.22"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M9.6 11.5h12.8M13 11.5V9.8a3 3 0 0 1 6 0v1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <h1 className="mt-4 font-display text-2xl text-jaggery-500">Admin sign in</h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Nature&apos;s Choice Jaggery — catalogue, orders and content.
            </p>
          </div>

          {authConfigured ? (
            <LoginForm redirectTo={redirectTo ?? undefined} />
          ) : (
            <div className="mt-6 rounded-lg border border-ginger-200 bg-ginger-50 p-4 text-xs leading-relaxed text-ginger-800">
              <p className="font-semibold">Admin access is not configured yet.</p>
              <p className="mt-1">
                Set <code className="font-mono">AUTH_SECRET</code> in{' '}
                <code className="font-mono">.env.local</code> to a long random string, then
                create the first account with{' '}
                <code className="font-mono">npm run seed:admin</code>.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-cream-200/80">
          <Link href="/" className="underline underline-offset-4 hover:text-cream-50">
            Back to the storefront
          </Link>
        </p>
      </div>
    </main>
  );
}

/** Only allow relative, single-slash paths as a post-login destination. */
function safeNext(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.startsWith('/admin/login')) return null;
  return value;
}