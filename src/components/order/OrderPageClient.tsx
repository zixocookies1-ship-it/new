'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { OrderDetail } from '@/components/order/OrderDetail';
import { TextInput, Textarea } from '@/components/ui/Field';
import { Alert, LoadingState } from '@/components/ui/StateBlocks';
import { ALL_ROUTES } from '@/lib/site';
import type { PublicOrderView } from '@/lib/order-view';

/**
 * Post-purchase / order page.
 *
 * Security note: this URL is guessable (`/order/NC-XXXXXXXXXX`), so nothing about
 * an order is rendered until the requester proves they are the customer by
 * supplying the email or mobile on the order — exactly the same bar as
 * `/track-order`. After checkout we stash the contact the customer *just typed*
 * in `sessionStorage`, so the confirmation page opens without making them type
 * it again. That stash never leaves the browser and is not an authorisation.
 */

const RECEIPTS_KEY = 'nc_order_receipts_v1';
const RECEIPT_TTL_MS = 6 * 60 * 60 * 1000;

interface Receipt {
  orderId: string;
  contact: string;
  at: number;
}

function readReceipts(): Receipt[] {
  try {
    const raw = window.sessionStorage.getItem(RECEIPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Receipt[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) => r && typeof r.orderId === 'string' && typeof r.contact === 'string',
    );
  } catch {
    return [];
  }
}

export function rememberOrderReceipt(orderId: string, contact: string): void {
  try {
    const existing = readReceipts().filter((r) => r.orderId !== orderId);
    existing.push({ orderId, contact, at: Date.now() });
    window.sessionStorage.setItem(RECEIPTS_KEY, JSON.stringify(existing.slice(-5)));
  } catch {
    /* ignore */
  }
}

function readReceipt(orderId: string): Receipt | null {
  const hit = readReceipts().find(
    (r) => r.orderId.toUpperCase() === orderId.toUpperCase() && Date.now() - r.at < RECEIPT_TTL_MS,
  );
  return hit ?? null;
}

type State =
  | { kind: 'loading' }
  | { kind: 'verify' }
  | { kind: 'done'; order: PublicOrderView; liveError: string | null }
  | { kind: 'error'; message: string };

export function OrderPageClient({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [contact, setContact] = useState('');
  const [contactError, setContactError] = useState<string | undefined>();

  /* Cancel ---------------------------------------------------------------- */
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const autoVerified = useRef(false);

  // Stable across renders (depends only on `orderId`) so the auto-verify effect
  // below can safely list it as a dependency.
  const verify = useCallback(
    async (value: string) => {
      setState({ kind: 'loading' });
      try {
        const res = await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, contact: value }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          error?: string;
          data?: { order: PublicOrderView; liveError: string | null };
        };

        if (!res.ok || !json.ok || !json.data) {
          setState({ kind: 'verify' });
          setContactError(json.error ?? 'We could not match that order.');
          return;
        }

        setState({ kind: 'done', order: json.data.order, liveError: json.data.liveError });
      } catch {
        setState({ kind: 'error', message: 'Network error. Please try again in a moment.' });
      }
    },
    [orderId],
  );

  /* Auto-verify once, using the contact this browser supplied at checkout. */
  useEffect(() => {
    if (autoVerified.current) return;
    autoVerified.current = true;
    const receipt = readReceipt(orderId);
    if (receipt) {
      setContact(receipt.contact);
      void verify(receipt.contact);
    } else {
      setState({ kind: 'verify' });
    }
  }, [orderId, verify]);

  async function onCancel(e: React.FormEvent) {
    e.preventDefault();
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setCancelMessage({ ok: false, text: 'Please tell us briefly why.' });
      return;
    }
    setCancelBusy(true);
    setCancelMessage(null);

    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, contact: contact.trim(), reason }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !json.ok) {
        setCancelMessage({
          ok: false,
          text: json.error ?? 'This order could not be cancelled.',
        });
        setCancelBusy(false);
        return;
      }

      setCancelOpen(false);
      setCancelBusy(false);
      setCancelMessage({ ok: true, text: 'Order cancelled. Any payment is being returned.' });
      await verify(contact.trim());
    } catch {
      setCancelMessage({ ok: false, text: 'Network error. Please try again.' });
      setCancelBusy(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Verification gate                                                       */
  /* ---------------------------------------------------------------------- */
  if (state.kind === 'verify' || state.kind === 'loading') {
    if (state.kind === 'loading' && !contact) {
      return (
        <div className="nc-container py-12">
          <LoadingState title="Loading your order" rows={4} />
        </div>
      );
    }

    return (
      <div className="nc-container py-12">
        <div className="mx-auto max-w-md">
          <h1 className="nc-h3 text-jaggery-500">Confirm it is your order</h1>
          <p className="nc-body mt-2 text-ink-muted">
            Enter the email or mobile number used on order{' '}
            <span className="font-semibold text-ink">{orderId}</span>. We ask so that
            nobody else can open this link.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = contact.trim();
              if (value.length < 4) {
                setContactError('Enter the email or mobile used on the order.');
                return;
              }
              void verify(value);
            }}
            className="nc-card mt-5 space-y-4 p-5"
            noValidate
          >
            <TextInput
              label="Email or mobile used on the order"
              name="contact"
              required
              autoComplete="email"
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                setContactError(undefined);
              }}
              error={contactError}
            />
            <button type="submit" className="nc-btn-primary nc-btn-block">
              Show my order
            </button>
          </form>

          <p className="mt-4 text-xs text-ink-faint">
            Have the order ID but not the contact details?{' '}
            <Link href={ALL_ROUTES.contact} className="nc-link">
              Contact us
            </Link>{' '}
            and we will verify you another way.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="nc-container py-12">
        <div className="mx-auto max-w-md">
          <Alert tone="error" title="We could not load that order">
            <p>{state.message}</p>
          </Alert>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="nc-btn-primary"
              onClick={() => setState({ kind: 'verify' })}
            >
              Try again
            </button>
            <Link href={ALL_ROUTES.contact} className="nc-btn-outline">
              Contact us
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Order                                                                  */
  /* ---------------------------------------------------------------------- */
  const order = state.order;
  const canCancel =
    order.status !== 'CANCELLED' &&
    order.status !== 'REFUNDED' &&
    order.status !== 'DELIVERED' &&
    order.status !== 'SHIPPED' &&
    order.status !== 'IN_TRANSIT' &&
    order.status !== 'OUT_FOR_DELIVERY' &&
    order.payment.status !== 'PAID' &&
    !order.shipping.waybill;

  return (
    <div className="nc-container py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        {cancelMessage ? (
          <Alert
            tone={cancelMessage.ok ? 'success' : 'error'}
            title={cancelMessage.ok ? 'Order cancelled' : 'Cancellation not possible'}
            className="mb-5"
          >
            <p>{cancelMessage.text}</p>
          </Alert>
        ) : null}

        <OrderDetail order={order} liveError={state.liveError}>
          {canCancel ? (
            <div className="mt-5 border-t border-cream-200 pt-5">
              {cancelOpen ? (
                <form onSubmit={onCancel} className="space-y-3" noValidate>
                  <Textarea
                    label="Why are you cancelling?"
                    name="cancelReason"
                    rows={3}
                    maxLength={500}
                    required
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    hint="This helps us fix whatever went wrong."
                  />
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={cancelBusy} className="nc-btn-primary">
                      {cancelBusy ? 'Cancelling…' : 'Confirm cancellation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelOpen(false)}
                      className="nc-btn-outline"
                    >
                      Keep my order
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="text-sm font-medium text-ink-muted underline decoration-cream-400 underline-offset-4 hover:text-[#8F3333]"
                >
                  Cancel this order
                </button>
              )}
            </div>
          ) : null}
        </OrderDetail>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={ALL_ROUTES.shop} className="nc-btn-primary">
            Continue shopping
          </Link>
          <Link href={ALL_ROUTES.trackOrder} className="nc-btn-outline">
            Track an order
          </Link>
        </div>

        <div className="mt-6 rounded-card border border-cream-300 bg-cream-50 p-5">
          <h2 className="font-display text-base text-jaggery-500">Told you?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            If this jar made it into your kitchen, a few honest words help other people
            decide. Reviews are read and published by us — we do not publish anything we
            have not seen from a real customer.
          </p>
          <Link href={ALL_ROUTES.shop} className="nc-btn-outline mt-3">
            Find your flavour
          </Link>
        </div>
      </div>
    </div>
  );
}
