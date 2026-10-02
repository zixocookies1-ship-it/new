'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { adminFetch } from './api';
import { AdminInput, Btn, InlineAlert } from './ui';

/** Password login. Credentials go straight to `/api/admin/auth` over TLS. */
export function LoginForm({ redirectTo }: { redirectTo: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      await adminFetch('/api/admin/auth', { method: 'POST', body: { email, password } });
      // Full navigation so the server layout re-reads the session cookie.
      router.replace(redirectTo ?? '/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      {error ? <InlineAlert tone="bad">{error}</InlineAlert> : null}

      <AdminInput
        label="Email"
        type="email"
        name="email"
        required
        autoComplete="username"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <AdminInput
        label="Password"
        type="password"
        name="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Btn type="submit" variant="primary" disabled={busy} className="w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </Btn>

      <p className="text-center text-xs leading-relaxed text-ink-faint">
        Accounts lock for 15 minutes after 8 failed attempts. Sessions expire after 8
        hours.
      </p>
    </form>
  );
}
