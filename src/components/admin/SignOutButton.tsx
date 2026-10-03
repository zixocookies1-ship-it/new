'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } catch {
      // Even if the round-trip fails, sending them to the login page is the safe
      // outcome: the server-side layout guard will re-check the cookie anyway.
    } finally {
      setBusy(false);
      router.replace('/admin/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="inline-flex min-h-[32px] items-center rounded-lg border border-cream-50/30 px-2.5 text-xs font-semibold text-cream-50 transition-colors hover:bg-cream-50/10 disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}