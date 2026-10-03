'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useCart } from '@/components/cart/CartProvider';
import { rememberOrderReceipt } from '@/components/order/OrderPageClient';
import { TextInput, Select, Textarea, RadioCard } from '@/components/ui/Field';
import { Alert, Badge, EmptyState, LoadingState } from '@/components/ui/StateBlocks';
import { PriceCompact } from '@/components/ui/Price';
import { INDIAN_STATES } from '@/lib/states';
import { formatINR } from '@/lib/money';
import { useRazorpayScript } from '@/lib/razorpay-client';
import { ALL_ROUTES } from '@/lib/site';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface Address {
  name: string;
  email: string;
  phone: string;
  alternatePhone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

type FieldErrors = Partial<Record<keyof Address | 'form', string>>;

const EMPTY_ADDRESS: Address = {
  name: '',
  email: '',
  phone: '',
  alternatePhone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
};

const ADDRESS_KEY = 'nc_address_v1';
const TOKEN_KEY = 'nc_checkout_token_v1';

type Phase =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'paying' }
  | { kind: 'verifying' };

/* -------------------------------------------------------------------------- */
/* Client validation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors the zod schema in `@/lib/validation` so the customer sees errors
 * without a round trip. The server re-validates everything regardless — this is
 * a courtesy layer, never a security boundary.
 */
function validateAddress(a: Address): FieldErrors {
  const e: FieldErrors = {};
  if (a.name.trim().length < 2) e.name = 'Enter the full name for delivery.';
  if (a.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email.trim())) {
    e.email = 'Enter a valid email address.';
  }
  const digits = a.phone.replace(/[\s-]/g, '');
  if (!/^(?:\+?91)?[6-9]\d{9}$/.test(digits)) {
    e.phone = 'Enter a valid 10-digit Indian mobile number.';
  }
  if (a.alternatePhone.trim()) {
    const alt = a.alternatePhone.replace(/[\s-]/g, '');
    if (!/^(?:\+?91)?[6-9]\d{9}$/.test(alt)) {
      e.alternatePhone = 'Enter a valid alternate mobile number.';
    }
  }
  if (a.line1.trim().length < 4) e.line1 = 'Enter the house number and street.';
  if (a.city.trim().length < 2) e.city = 'Enter the city.';
  if (a.state.trim().length < 2) e.state = 'Choose the state.';
  if (!/^\d{6}$/.test(a.pincode.trim())) e.pincode = 'Enter a valid 6-digit PIN code.';
  return e;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function CheckoutClient({
  shippingEnabled,
  shippingDisabledMessage,
  supportEmail,
  supportPhone,
}: {
  shippingEnabled: boolean;
  shippingDisabledMessage: string;
  supportEmail?: string;
  supportPhone?: string;
}) {
  const router = useRouter();
  const {
    items,
    couponCode,
    quote,
    quoteLoading,
    hydrated,
    paymentMethod,
    setPaymentMethod,
    clearCart,
    reconcile,
  } = useCart();

  const scriptStatus = useRazorpayScript();

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const addressRestored = useRef(false);
  const beginCheckoutFired = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  /* --- Address memory: a returning customer should not retype everything --- */
  useEffect(() => {
    if (addressRestored.current) return;
    addressRestored.current = true;
    try {
      const raw = window.localStorage.getItem(ADDRESS_KEY);
      if (raw) setAddress({ ...EMPTY_ADDRESS, ...(JSON.parse(raw) as Partial<Address>) });
    } catch {
      /* storage blocked — just start blank */
    }
  }, []);

  const set = useCallback(<K extends keyof Address>(key: K, value: Address[K]) => {
    setAddress((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  useEffect(() => {
    if (!hydrated || items.length === 0) return;
  }, [hydrated, items.length]);

  /* --- Re-quote when the payment method changes ---------------------------- */
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const t = setTimeout(() => void reconcile(), 200);
    return () => clearTimeout(t);
  }, [paymentMethod, hydrated, items.length, reconcile]);

  /* --- Guard states ------------------------------------------------------ */
  if (!hydrated) {
    return (
      <div className="nc-container py-16">
        <LoadingState title="Loading checkout" rows={5} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="nc-container py-16">
        <EmptyState
          title="There is nothing to check out"
          message="Your cart is empty. Add a jar of jaggery and come back — we will keep your place."
          action={{ label: 'Shop all products', href: ALL_ROUTES.shop }}
          secondaryAction={{ label: 'Talk to us', href: ALL_ROUTES.contact }}
        />
      </div>
    );
  }

  if (!shippingEnabled) {
    return (
      <div className="nc-container py-16">
        <Alert tone="warning" title="Online ordering is not switched on yet">
          <p>{shippingDisabledMessage}</p>
        </Alert>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={ALL_ROUTES.contact} className="nc-btn-primary">
            Contact us
          </Link>
          <Link href={ALL_ROUTES.cart} className="nc-btn-outline">
            Back to cart
          </Link>
        </div>
      </div>
    );
  }

  const onlineAvailable = quote?.onlinePaymentAvailable ?? false;
  const codAvailable = quote?.codAvailable ?? false;
  const methodAvailable = onlineAvailable || codAvailable;
  const quoteBlocked = Boolean(quote?.issues?.length) || !methodAvailable;
  const busy = phase.kind !== 'idle';

  /* --- Submit ------------------------------------------------------------ */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || quoteBlocked) return;

    const validation = validateAddress(address);
    if (Object.keys(validation).some((k) => validation[k as keyof FieldErrors])) {
      setErrors(validation);
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setErrors({});
    setFormError(null);

    const payloadAddress = {
      name: address.name.trim(),
      phone: address.phone.replace(/[\s-]/g, ''),
      alternatePhone: address.alternatePhone.trim() || undefined,
      email: address.email.trim() || undefined,
      line1: address.line1.trim(),
      line2: address.line2.trim() || undefined,
      landmark: address.landmark.trim() || undefined,
      city: address.city.trim(),
      state: address.state.trim(),
      pincode: address.pincode.trim(),
      country: 'India',
    };

    try {
      window.localStorage.setItem(
        ADDRESS_KEY,
        JSON.stringify({ ...payloadAddress, alternatePhone: address.alternatePhone.trim() }),
      );
    } catch {
      /* ignore */
    }

    // Idempotency token: stable across retries of *this* checkout attempt, so a
    // double tap or a network retry can never create two orders.
    const token = readOrCreateToken();

    // The mobile is always stored on the order, so it is the reliable value for
    // re-verifying on the confirmation page.
    const verifyValue = payloadAddress.phone;

    const bundles = items
      .filter((i) => i.bundleId)
      .reduce<Record<string, number>>((acc, i) => {
        if (i.bundleId) acc[i.bundleId] = (acc[i.bundleId] ?? 0) + i.qty;
        return acc;
      }, {});

    const body = {
      lines: items
        .filter((i) => !i.bundleId)
        .map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
      bundles: Object.entries(bundles).map(([bundleId, qty]) => ({ bundleId, qty })),
      couponCode,
      paymentMethod,
      address: payloadAddress,
      customerNote: note.trim() || undefined,
      clientCheckoutToken: token,
    };

    setPhase({ kind: 'creating' });

    let created: {
      orderId: string;
      totalPaise: number;
      paymentMethod: string;
      razorpayKeyId: string | null;
      reused: boolean;
    };

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        details?: Array<{ message?: string }>;
        data?: typeof created;
      };
      if (!res.ok || !json.ok || !json.data) {
        setPhase({ kind: 'idle' });
        setFormError(
          json.details?.[0]?.message ?? json.error ?? 'We could not place this order. Please try again.',
        );
        return;
      }
      created = json.data;
    } catch {
      setPhase({ kind: 'idle' });
      setFormError('Network problem while placing the order. Please try again.');
      return;
    }

    // Cash on delivery is complete the moment the order exists.
    if (created.paymentMethod === 'COD') {
      finish(created.orderId, created.totalPaise, quote?.subtotalPaise ?? created.totalPaise, verifyValue);
      return;
    }

    /* --- Razorpay -------------------------------------------------------- */
    setPhase({ kind: 'paying' });

    let gateway: {
      razorpayOrderId: string;
      amount: number;
      currency: string;
      keyId: string;
      name: string;
      email?: string;
      contact: string;
    };

    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: created.orderId }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; data?: typeof gateway };
      if (!res.ok || !json.ok || !json.data) {
        setPhase({ kind: 'idle' });
        setFormError(json.error ?? 'We could not start the payment. Please try again.');
        return;
      }
      gateway = json.data;
    } catch {
      setPhase({ kind: 'idle' });
      setFormError('Network problem while starting the payment. Please try again.');
      return;
    }

    if (typeof window === 'undefined' || !window.Razorpay) {
      setPhase({ kind: 'idle' });
      setFormError(
        scriptStatus === 'failed'
          ? 'The payment window could not load. Check your connection and try again.'
          : 'The payment window is still loading. Try again in a moment.',
      );
      return;
    }

    let settled = false;

    const markAbandoned = (reason: string, description: string) => {
      if (settled) return;
      settled = true;
      void fetch('/api/payments/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: created.orderId,
          code: reason,
          description,
        }),
      }).catch(() => undefined);
    };

    const checkout = new window.Razorpay({
      key: gateway.keyId || created.razorpayKeyId || '',
      amount: String(gateway.amount),
      currency: gateway.currency,
      name: 'Nature’s Choice Jaggery',
      description: `Order ${created.orderId}`,
      order_id: gateway.razorpayOrderId,
      prefill: {
        name: payloadAddress.name,
        email: payloadAddress.email,
        contact: gateway.contact,
      },
      notes: { orderId: created.orderId },
      // Razorpay's own retry UX; a failed attempt leaves the order open.
      retry: { enabled: true, max_attempts: 2 },
      modal: {
        ondismiss: () => {
          markAbandoned('MODAL_DISMISSED', 'The payment window was closed before completing.');
          setPhase({ kind: 'idle' });
          setFormError(
            'The payment window was closed. Your order is saved — you can pay for it now or from the confirmation page.',
          );
        },
      },
      handler: async (response: Record<string, string>) => {
        if (settled) return;
        setPhase({ kind: 'verifying' });

        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: created.orderId,
            razorpayOrderId: response.razorpay_order_id ?? gateway.razorpayOrderId,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        }).catch(() => null);

        const json = res
          ? ((await res.json().catch(() => ({}))) as {
              ok: boolean;
              error?: string;
              data?: { paymentStatus: string; totalPaise: number };
            })
          : null;

        // The server is the only authority on whether the money arrived.
        if (!res || !json?.ok || !json.data || json.data.paymentStatus !== 'PAID') {
          settled = true;
          setPhase({ kind: 'idle' });
          setFormError(
            json?.error ??
              'We could not confirm the payment yet. If you were charged, it will be reflected on your order shortly — do not pay again.',
          );
          return;
        }

        settled = true;
        finish(created.orderId, json.data.totalPaise, gateway.amount, verifyValue);
      },
    });

    try {
      checkout.open();
    } catch {
      setPhase({ kind: 'idle' });
      setFormError('The payment window could not be opened. Please try again.');
    }
  }

  function finish(orderId: string, totalPaise: number, valuePaise: number, contactValue: string) {
    clearToken();
    clearCart();

    // Stash the contact this browser just supplied so the confirmation page can
    // re-verify without asking again. It is a convenience, not an authorisation.
    rememberOrderReceipt(orderId, contactValue);

    router.push(`/order/${orderId}?placed=1&total=${totalPaise}`);
  }

  const subtotal = quote?.subtotalPaise ?? 0;
  const total = quote?.totalPaise ?? 0;

  return (
    <form onSubmit={onSubmit} ref={formRef} noValidate className="nc-container py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        {/* ---------------------------------------------------------------- */}
        {/* Left column: address + payment                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="checkout-heading">
            <h1 id="checkout-heading" className="nc-h2">
              Checkout
            </h1>
            <p className="nc-lede mt-3">
              One page, no account needed. You will get an order ID you can use to
              track the parcel.
            </p>
          </section>

          {formError ? (
            <Alert tone="error" title="We could not complete that">
              <p>{formError}</p>
            </Alert>
          ) : null}

          {/* --- Contact ---------------------------------------------------- */}
          <fieldset className="nc-card p-5 sm:p-6" disabled={busy}>
            <legend className="sr-only">Contact details</legend>
            <h2 className="font-display text-lg text-jaggery-500">Contact details</h2>
            <p className="mt-1 text-sm text-ink-muted">
              We use these only for this order — delivery updates and support.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Full name"
                name="name"
                required
                autoComplete="name"
                maxLength={120}
                value={address.name}
                onChange={(e) => set('name', e.target.value)}
                error={errors.name}
              />
              <TextInput
                label="Mobile number"
                name="phone"
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={15}
                placeholder="10-digit mobile"
                value={address.phone}
                onChange={(e) => set('phone', e.target.value)}
                error={errors.phone}
                hint="The courier may call this number before delivery."
              />
              <TextInput
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={160}
                className="sm:col-span-2"
                optional
                value={address.email}
                onChange={(e) => set('email', e.target.value)}
                error={errors.email}
                hint="Optional, but it is the fastest way for us to send your order confirmation."
              />
            </div>
          </fieldset>

          {/* --- Address ---------------------------------------------------- */}
          <fieldset className="nc-card p-5 sm:p-6" disabled={busy}>
            <legend className="sr-only">Delivery address</legend>
            <h2 className="font-display text-lg text-jaggery-500">Delivery address</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Please make sure somebody is available to receive the parcel.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              <TextInput
                label="House / flat and street"
                name="line1"
                required
                autoComplete="address-line1"
                maxLength={240}
                className="sm:col-span-6"
                value={address.line1}
                onChange={(e) => set('line1', e.target.value)}
                error={errors.line1}
              />
              <TextInput
                label="Area, landmark or colony"
                name="landmark"
                autoComplete="address-line2"
                maxLength={160}
                className="sm:col-span-6"
                optional
                value={address.landmark}
                onChange={(e) => set('landmark', e.target.value)}
                error={errors.landmark}
              />
              <TextInput
                label="City"
                name="city"
                required
                autoComplete="address-level2"
                maxLength={80}
                className="sm:col-span-3"
                value={address.city}
                onChange={(e) => set('city', e.target.value)}
                error={errors.city}
              />
              <Select
                label="State"
                name="state"
                required
                autoComplete="address-level1"
                className="sm:col-span-3"
                value={address.state}
                onChange={(e) => set('state', e.target.value)}
                error={errors.state}
              >
                <option value="">Select a state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <TextInput
                label="PIN code"
                name="pincode"
                required
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                placeholder="6 digits"
                className="sm:col-span-2"
                value={address.pincode}
                onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                error={errors.pincode}
              />
              <TextInput
                label="Alternate mobile"
                name="alternatePhone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={15}
                className="sm:col-span-4"
                optional
                value={address.alternatePhone}
                onChange={(e) => set('alternatePhone', e.target.value)}
                error={errors.alternatePhone}
                hint="Useful if the first number is unreachable."
              />
            </div>

            <div className="mt-4">
              <Textarea
                label="Anything the courier should know?"
                name="customerNote"
                rows={3}
                maxLength={1000}
                optional
                value={note}
                onChange={(e) => setNote(e.target.value)}
                hint="Delivery instructions, gate codes, or a preferred time window."
              />
            </div>
          </fieldset>

          {/* --- Payment ---------------------------------------------------- */}
          <fieldset className="nc-card p-5 sm:p-6" disabled={busy}>
            <legend className="sr-only">Payment method</legend>
            <h2 className="font-display text-lg text-jaggery-500">Payment method</h2>

            {!methodAvailable ? (
              <Alert tone="warning" title="No payment method is available yet" className="mt-4">
                <p>
                  Online payments and cash on delivery are both switched off at the
                  moment. Please{' '}
                  <Link href={ALL_ROUTES.contact} className="nc-link">
                    contact us
                  </Link>{' '}
                  and we will help you order.
                </p>
              </Alert>
            ) : (
              <div className="mt-5 space-y-3">
                {onlineAvailable ? (
                  <RadioCard
                    name="paymentMethod"
                    value="RAZORPAY"
                    checked={paymentMethod === 'RAZORPAY'}
                    onChange={() => setPaymentMethod('RAZORPAY')}
                    title="Pay online"
                    description="UPI, cards, net banking and wallets through Razorpay. We never see or store your card or UPI details."
                    icon={
                      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
                        <path d="M2.5 8.5h15" />
                      </svg>
                    }
                  />
                ) : null}

                {codAvailable ? (
                  <RadioCard
                    name="paymentMethod"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                    title="Cash on delivery"
                    description={quote?.codBlockedReason ?? 'Pay the courier when the parcel arrives.'}
                    icon={
                      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <rect x="2.5" y="5.5" width="15" height="9" rx="1.6" />
                        <circle cx="10" cy="10" r="2.4" />
                      </svg>
                    }
                  />
                ) : null}
              </div>
            )}

            {quote && quote.issues.length > 0 ? (
              <Alert tone="warning" title="Some items need attention" className="mt-4">
                <ul className="mt-1 space-y-0.5">
                  {quote.issues.map((issue, i) => (
                    <li key={`${issue.code}-${i}`}>{issue.message}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  <Link href={ALL_ROUTES.cart} className="nc-link">
                    Review your cart
                  </Link>
                </p>
              </Alert>
            ) : null}
          </fieldset>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right column: order summary + place order                        */}
        {/* ---------------------------------------------------------------- */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-card border border-cream-300 bg-white p-5 sm:p-6">
            <h2 className="font-display text-lg text-jaggery-500">Your order</h2>

            <ul className="mt-4 divide-y divide-cream-200 border-y border-cream-200">
              {items.map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {item.name}
                      <span className="ml-1.5 text-ink-muted">× {item.qty}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {item.bundleName ? 'Bundle' : item.weightLabel}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                    <PriceCompact paise={item.unitPricePaise * item.qty} />
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {quoteLoading && !quote ? (
                    <span className="nc-skeleton inline-block h-4 w-16 rounded" />
                  ) : (
                    <PriceCompact paise={subtotal} />
                  )}
                </dd>
              </div>

              {quote && quote.productDiscountPaise > 0 ? (
                <div className="flex items-center justify-between text-leaf-500">
                  <dt>Product savings</dt>
                  <dd className="font-semibold tabular-nums">−<PriceCompact paise={quote.productDiscountPaise} /></dd>
                </div>
              ) : null}

              {quote && quote.couponDiscountPaise > 0 ? (
                <div className="flex items-center justify-between text-leaf-500">
                  <dt>Coupon ({quote.coupon?.code})</dt>
                  <dd className="font-semibold tabular-nums">−<PriceCompact paise={quote.couponDiscountPaise} /></dd>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Shipping</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {!quote ? (
                    <span className="text-ink-faint">Calculating…</span>
                  ) : quote.shippingPaise === 0 ? (
                    'Free'
                  ) : (
                    formatINR(quote.shippingPaise)
                  )}
                </dd>
              </div>

              {quote && quote.taxPaise > 0 ? (
                <div className="flex items-center justify-between">
                  <dt className="text-ink-soft">Taxes</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    <PriceCompact paise={quote.taxPaise} />
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-cream-300 pt-4">
              <span className="text-sm font-semibold text-ink">Total payable</span>
              <span className="text-2xl font-semibold tabular-nums text-jaggery-500">
                {quote ? (
                  <PriceCompact paise={total} />
                ) : (
                  <span className="nc-skeleton inline-block h-6 w-24 rounded" />
                )}
              </span>
            </div>

            <button
              type="submit"
              disabled={busy || quoteBlocked}
              className="nc-btn-accent nc-btn-block mt-6"
            >
              {phase.kind === 'creating'
                ? 'Placing your order…'
                : phase.kind === 'paying'
                  ? 'Opening payment…'
                  : phase.kind === 'verifying'
                    ? 'Confirming payment…'
                    : paymentMethod === 'COD'
                      ? 'Place order'
                      : `Pay ${quote ? formatINR(total) : ''}`}
            </button>

            {busy ? (
              <p className="mt-2.5 text-center text-xs text-ink-muted" role="status">
                Please keep this page open — do not refresh or press back.
              </p>
            ) : null}

            <p className="mt-4 text-center text-2xs leading-relaxed text-ink-faint">
              We confirm every amount on the server before your order is placed. If
              anything changes between now and then, you will see the corrected total
              before paying.
            </p>
          </div>

          {supportEmail || supportPhone ? (
            <div className="mt-4 rounded-card border border-cream-300 bg-cream-50 p-5">
              <h3 className="font-display text-base text-jaggery-500">Questions before you pay?</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {supportEmail ? (
                  <li>
                    <a href={`mailto:${supportEmail}`} className="nc-link">
                      {supportEmail}
                    </a>
                  </li>
                ) : null}
                {supportPhone ? (
                  <li>
                    <a href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`} className="nc-link">
                      {supportPhone}
                    </a>
                  </li>
                ) : null}
              </ul>
              <Link href={ALL_ROUTES.contact} className="nc-btn-outline mt-3">
                Contact us
              </Link>
            </div>
          ) : (
            <div className="mt-4 rounded-card border border-cream-300 bg-cream-50 p-5">
              <h3 className="font-display text-base text-jaggery-500">Need help?</h3>
              <p className="mt-1.5 text-sm text-ink-muted">
                Support contact details have not been published yet, but the contact
                form still reaches us.
              </p>
              <Link href={ALL_ROUTES.contact} className="nc-btn-outline mt-3">
                Contact us
              </Link>
            </div>
          )}

          {quoteBlocked && methodAvailable ? (
            <Badge tone="warning" className="mt-4 w-full justify-center">
              Fix the items above to continue
            </Badge>
          ) : null}
        </aside>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Idempotency token helpers                                                   */
/* -------------------------------------------------------------------------- */

function readOrCreateToken(): string {
  try {
    const existing = window.sessionStorage.getItem(TOKEN_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing;
    const fresh = `nc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    window.sessionStorage.setItem(TOKEN_KEY, fresh);
    return fresh;
  } catch {
    return `nc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function clearToken(): void {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
