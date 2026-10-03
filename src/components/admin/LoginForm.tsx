'use client';

import { useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { useRouter } from 'next/navigation';

export function LoginForm({ redirectTo }: { redirectTo: string | undefined }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await adminFetch<{ ok: boolean; session?: any }>('/api/admin/auth', {
        method: 'POST',
        body: { email, password },
      });
      setBusy(false);
      if (res.ok && res.session) {
        // Store session manually via cookie
        const jwt = btoa(JSON.stringify(res.session));
        // @ts-ignore - next/cookies types may not be fully available
        const { setCookie } = await import('next/headers');
        setCookie('nc_admin_session', jwt, {
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
        });
        router.replace(redirectTo ?? '/admin');
      } else if (!res.ok) {
        const errorMsg = (res as any).error || 'Invalid credentials. Please try again.';
        window.alert(errorMsg);
      } else {
        window.alert('Login failed. Please try again.');
      }
    } catch (err) {
      setBusy(false);
      window.alert('Login failed. Please try again.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      noValidate
      aria-label="Admin login form"
    >
      <div className="rounded-xl border border-cream-300 bg-white p-6 shadow-card-hover">
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
          <h2 className="mt-4 font-display text-2xl text-jaggery-500">Admin sign in</h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            Nature's Choice Jaggery — catalogue, orders and content.
          </p>
        </div>

        <div className="mt-5">
          <div className="rounded-xl border border-cream-400 bg-white p-4 flex items-center gap-3">
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5 text-cream-400"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="9" />
              <path
                d="M9 9l6 6L15 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="flex-1 bg-transparent outline-none"
              required
            />
          </div>

          <div className="rounded-xl border border-cream-400 bg-white p-4 flex items-center gap-3">
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5 text-cream-400"
              fill="none"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="14" height="14" rx="2" ry="2" />
              <path
                d="M9 9l6 6L15 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="flex-1 bg-transparent outline-none"
              required
            />
          </div>

          <div className="mt-4">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl border border-jaggery-500 bg-jaggery-500 text-cream-50 py-2.5 font-semibold transition-colors hover:bg-jaggery-600 disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>

          <p className="mt-3 text-xs text-cream-200/80">
            <a href="/admin/login" className="underline decoration-cream-400 decoration-offset-4">
              Admin not configured?
            </a>
          </p>
        </div>
      </div>
    </form>
  );
}