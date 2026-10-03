'use client';

import { useState } from 'react';
import Link from 'next/link';

import { OrderDetail } from '@/components/order/OrderDetail';
import { TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/StateBlocks';
import type { PublicOrderView } from '@/lib/order-view';

/**
 * Order tracking.
 *
 * Requires the order ID *and* the email or mobile used on the order. The API
 * returns an identical error for an unknown order and a wrong contact value, so
 * this screen cannot be used to discover whether someone else's order exists.
 */
export function TrackOrderClient() {
  const [orderId, setOrderId] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'done'; order: PublicOrderView; liveError: string | null }
  >({ kind: 'idle' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: 'loading' });

    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId.trim(), contact: contact.trim() }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { order: PublicOrderView; liveError: string | null };
      };

      if (!res.ok || !json.ok || !json.data) {
        setStatus({ kind: 'error', message: json.error ?? 'We could not find that order.' });
        return;
      }

      setStatus({ kind: 'done', order: json.data.order, liveError: json.data.liveError });
    } catch {
      setStatus({
        kind: 'error',
        message: 'Network error. Please check your connection and try again.',
      });
    }
  }

  if (status.kind === 'done') {
    return (
      <div className="space-y-5">
        <OrderDetail
          order={status.order}
          liveError={status.liveError}
          contact={contact.trim() || undefined}
        />
        <button
          type="button"
          onClick={() => setStatus({ kind: 'idle' })}
          className="nc-btn-outline nc-btn-sm"
        >
          Track another order
        </button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={submit} className="nc-card space-y-4 p-5 sm:p-6" noValidate>
        <TextInput
          label="Order ID"
          name="orderId"
          required
          placeholder="NC-XXXXXXXXXX"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value.toUpperCase())}
          hint="You will find this in your order confirmation."
        />
        <TextInput
          label="Email or mobile used on the order"
          name="contact"
          required
          autoComplete="email"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          hint="We ask for this so nobody else can see your order."
        />

        {status.kind === 'error' ? <Alert tone="error">{status.message}</Alert> : null}

        <button
          type="submit"
          className="nc-btn-primary nc-btn-block"
          disabled={status.kind === 'loading'}
        >
          {status.kind === 'loading' ? 'Looking up…' : 'Track my order'}
        </button>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-ink-faint">
        Lost the order ID or the email you used?{' '}
        <Link href="/contact" className="nc-link">
          Contact us
        </Link>{' '}
        and we will find it — we will need to verify you are the customer first.
      </p>
    </div>
  );
}
