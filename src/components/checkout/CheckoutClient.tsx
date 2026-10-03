'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useCart, type CartQuote } from '@/components/cart/CartProvider';
import { rememberOrderReceipt } from '@/components/order/OrderPageClient';
import { TextInput, Select, Textarea, RadioCard } from '@/components/ui/Field';
import { Alert, Badge, EmptyState, LoadingState } from '@/components/ui/StateBlocks';
import { PriceCompact } from '@/components/ui/Price';
import { OptimizedImage, ImageFallback } from '@/components/media/OptimizedImage';
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

type Phase = 'idle' | 'creating' | 'paying' | 'verifying';

interface GatewayOrder {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  email?: string;
  contact: string;
}

type QuoteLine = CartQuote['lines'][number];

/* -------------------------------------------------------------------------- */
/* Client validation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors the zod schema in `@/lib/validation` so the customer sees errors
 * without a round trip. The server re-validates everything regardless — this is
 * a courtesy layer, never a security boundary.
 *
 * Every one of these fields is required: nothing reaches payment until the
 * complete delivery address is valid.
 */
function validateAddress(a: Address): FieldErrors {
  const e: FieldErrors = {};
  if (a.name.trim().length < 2) e.name = 'Please enter your full name.';
  if (!a.email.trim()) e.email = 'Please enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email.trim())) {
    e.email = 'Please enter a valid email address.';
  }
  const digits = a.phone.replace(/[\s-]/g, '');
  if (!digits) e.phone = 'Please enter a valid mobile number.';
  else if (!/^(?:\+?91)?[6-9]\d{9}$/.test(digits)) {
    e.phone = 'Please enter a valid 10-digit mobile number.';
  }
  if (a.alternatePhone.trim()) {
    const alt = a.alternatePhone.replace(/[\s-]/g, '');
    if (!/^(?:\+?91)?[6-9]\d{9}$/.test(alt)) {
      e.alternatePhone = 'Please enter a valid alternate mobile number.';
    }
  }
  if (a.line1.trim().length < 4) e.line1 = 'Please enter your delivery address.';
  if (a.city.trim().length < 2) e.city = 'Please enter your city.';
  if (!a.state.trim()) e.state = 'Please select your state.';
  if (!a.pincode.trim()) e.pincode = 'Please enter a valid 6-digit PIN code.';
  else if (!/^\d{6}$/.test(a.pincode.trim())) e.pincode = 'Please enter a valid 6-digit PIN code.';
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
    checkoutItems,
    isBuyNow,
    couponCode,
    applyCoupon,
    removeCoupon,
    quote,
    quoteLoading,
    hydrated,
    paymentMethod,
    setPaymentMethod,
    removeItem,
    completePurchase,
    reconcile,
  } = useCart();

  const scriptStatus = useRazorpayScript();

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  /**
   * A server-created order whose payment has not completed yet.
   *
   * Retrying re-opens Razorpay for this same order rather than creating another
   * one, which is what keeps a failed payment from turning into duplicate orders
   * or duplicate charges. `fingerprint` detects the customer changing the basket
   * after a failure, in which case the stale order is abandoned.
   */
  const [pending, setPending] = useState<{ orderId: string; fingerprint: string } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const addressRestored = useRef(false);
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

  /* --- Re-quote when the payment method changes ---------------------------- */
  useEffect(() => {
    if (!hydrated || checkoutItems.length === 0) return;
    const t = setTimeout(() => void reconcile(), 200);
    return () => clearTimeout(t);
  }, [paymentMethod, hydrated, checkoutItems.length, reconcile]);

  const onlineAvailable = quote?.onlinePaymentAvailable ?? false;
  const codAvailable = quote?.codAvailable ?? false;
  const methodAvailable = onlineAvailable || codAvailable;
  /** The chosen method must still be one the server is willing to accept. */
  const selectedAvailable = paymentMethod === 'COD' ? codAvailable : onlineAvailable;
  const busy = phase !== 'idle';

  /* --- Order summary rows, built from the SERVER quote -------------------- */
  const summaryRows = useMemo(
    () => buildSummaryRows(checkoutItems, quote?.lines ?? []),
    [checkoutItems, quote],
  );

  /**
   * Identifies exactly what is being bought. If the basket changes after a
   * failed payment, the fingerprint no longer matches and the stale pending
   * order is abandoned rather than retried with the wrong contents.
   */
  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        lines: checkoutItems.map((i) => [i.bundleId ?? `${i.productId}:${i.variantId}`, i.qty]),
        coupon: couponCode,
        method: paymentMethod,
      }),
    [checkoutItems, couponCode, paymentMethod],
  );

  const quoteBlocked =
    !quote || !methodAvailable || !selectedAvailable || Boolean(quote.issues.length);

  /* --- Guard states ------------------------------------------------------ */
  if (!hydrated) {
    return (
      <div className="nc-container py-16">
        <LoadingState title="Loading checkout" rows={5} />
      </div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="nc-container py-16">
        <EmptyState
          title="There is nothing to check out"
          message={
            items.length > 0
              ? 'Your cart still has items in it. Open your cart to continue.'
              : 'Your cart is empty. Add a jar of jaggery and come back — we will keep your place.'
          }
          action={
            items.length > 0
              ? { label: 'Open cart', href: ALL_ROUTES.cart }
              : { label: 'Shop all products', href: ALL_ROUTES.shop }
          }
          secondaryAction={{ label: 'Talk to us', href: ALL_ROUTES.contact }}
        />
      </div>
    );
  }

  /**
   * The genuine emergency switch: an admin can pause ordering from
   * Admin → Shipping. It is off only because the store is deliberately paused.
   */
  if (!shippingEnabled) {
    return (
      <div className="nc-container py-16">
        <Alert tone="warning" title="Online ordering is temporarily paused">
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

  const subtotal = quote?.subtotalPaise ?? 0;
  const delivery = quote?.shippingPaise ?? 0;
  const couponDiscount = quote?.couponDiscountPaise ?? 0;
  const total = quote?.totalPaise ?? 0;
  const freeDelivery = delivery === 0;

  /* --- Coupon ------------------------------------------------------------ */
  async function onApplyCoupon(e: FormEvent) {
    e.preventDefault();
    const code = couponInput.trim();
    if (!code) return;

    setCouponBusy(true);
    setCouponMessage(null);
    // Server validates existence, expiry, usage limits, minimum order and the
    // discount amount. The client never computes a discount.
    const res = await applyCoupon(code);
    setCouponBusy(false);
    setCouponMessage({ ok: res.ok, text: res.message });
    if (res.ok) {
      setCouponInput('');
      void reconcile();
    }
  }

  function onRemoveCoupon() {
    removeCoupon();
    setCouponMessage(null);
    setCouponInput('');
    void reconcile();
  }

  /* --- Submit ------------------------------------------------------------ */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || quoteBlocked) return;

    // Nothing reaches payment until every mandatory field is valid.
    const validation = validateAddress(address);
    if (Object.values(validation).some(Boolean)) {
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
      email: address.email.trim(),
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

    // The mobile is always stored on the order, so it is the reliable value for
    // re-verifying on the confirmation page.
    const verifyValue = payloadAddress.phone;

    // A pending order is only reusable if the basket is unchanged.
    if (pending && pending.fingerprint !== fingerprint) {
      setPending(null);
      setPaymentError(null);
      // Rotate the idempotency token so the new basket is not deduplicated
      // against the abandoned order.
      clearToken();
    }

    const requestBody = {
      lines: checkoutItems
        .filter((i) => !i.bundleId)
        .map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
      bundles: bundleLines(checkoutItems),
      couponCode,
      paymentMethod,
      address: payloadAddress,
      customerNote: note.trim() || undefined,
      clientCheckoutToken: readOrCreateToken(),
    };

    // --- 1. Reuse the pending order, or ask the server for a new one --------
    let orderId = pending?.orderId ?? null;
    let totalPaise = 0;

    if (!orderId) {
      setPhase('creating');
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        const json = (await res.json()) as {
          ok: boolean;
          error?: string;
          details?: Array<{ message?: string }>;
          data?: { orderId: string; totalPaise: number; paymentMethod: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          setPhase('idle');
          setFormError(
            json.details?.[0]?.message ?? json.error ?? 'We could not place this order. Please try again.',
          );
          return;
        }

        orderId = json.data.orderId;
        totalPaise = json.data.totalPaise;

        // Cash on delivery is complete the moment the order exists.
        if (json.data.paymentMethod === 'COD') {
          setPending(null);
          finish(orderId, totalPaise, verifyValue);
          return;
        }

        setPending({ orderId, fingerprint });
      } catch {
        setPhase('idle');
        setFormError('Network problem while placing the order. Please try again.');
        return;
      }
    }

    // --- 2. Create/reuse the Razorpay order and open Checkout ---------------
    await startPayment(orderId, verifyValue);
  }

  /** Open (or re-open) Razorpay for an order we already own on the server. */
  async function startPayment(orderId: string, verifyValue: string) {
    setPhase('paying');
    setPaymentError(null);

    let gateway: GatewayOrder;
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; data?: GatewayOrder };
      if (!res.ok || !json.ok || !json.data) {
        setPhase('idle');
        setFormError(json.error ?? 'We could not start the payment. Please try again.');
        return;
      }
      gateway = json.data;
    } catch {
      setPhase('idle');
      setFormError('Network problem while starting the payment. Please try again.');
      return;
    }

    if (typeof window === 'undefined' || !window.Razorpay) {
      setPhase('idle');
      setFormError(
        scriptStatus === 'failed'
          ? 'The payment window could not load. Check your connection and try again.'
          : 'The payment window is still loading. Try again in a moment.',
      );
      return;
    }

    let settled = false;

    const markAbandoned = (code: string, description: string) => {
      if (settled) return;
      settled = true;
      void fetch('/api/payments/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, code, description }),
      }).catch(() => undefined);
    };

    const checkout = new window.Razorpay({
      key: gateway.keyId,
      amount: String(gateway.amount),
      currency: gateway.currency,
      name: 'Nature’s Choice Jaggery',
      description: `Order ${orderId}`,
      order_id: gateway.razorpayOrderId,
      prefill: {
        name: gateway.name,
        email: gateway.email,
        contact: gateway.contact,
      },
      notes: { orderId },
      // Razorpay's own retry UX; a failed attempt leaves our order open.
      retry: { enabled: true, max_attempts: 2 },
      modal: {
        ondismiss: () => {
          markAbandoned('MODAL_DISMISSED', 'The payment window was closed before completing.');
          setPhase('idle');
          setPaymentError(
            'You closed the payment window before completing your payment. Your order is saved and your cart is untouched.',
          );
        },
      },
      handler: async (response: Record<string, string>) => {
        if (settled) return;
        setPhase('verifying');

        // This is a *request to verify*. The server checks the signature and
        // re-fetches the payment from Razorpay; the browser's word is never
        // enough to mark an order paid.
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
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

        if (!res || !json?.ok || !json.data || json.data.paymentStatus !== 'PAID') {
          settled = true;
          setPhase('idle');
          setPaymentError(
            json?.error ??
              'We could not confirm the payment yet. If you were charged, it will appear on your order shortly — do not pay again.',
          );
          return;
        }

        settled = true;
        setPending(null);
        finish(orderId, json.data.totalPaise, verifyValue);
      },
    });

    try {
      checkout.open();
    } catch {
      setPhase('idle');
      setFormError('The payment window could not be opened. Please try again.');
    }
  }

  /** Retry payment for the order we already created. Never creates a new order. */
  function onRetryPayment() {
    if (!pending || busy) return;
    setPaymentError(null);
    void startPayment(pending.orderId, address.phone.replace(/[\s-]/g, ''));
  }

  function finish(orderId: string, totalPaise: number, contactValue: string) {
    clearToken();
    // Only now, after the server has verified the payment, is the purchased
    // basket cleared. A "Buy now" purchase leaves unrelated cart items alone.
    completePurchase();

    // Stash the contact this browser just supplied so the confirmation page can
    // re-verify without asking again. It is a convenience, not an authorisation.
    rememberOrderReceipt(orderId, contactValue);

    router.push(`/order/${orderId}?placed=1&total=${totalPaise}`);
  }

  return (
    <form onSubmit={onSubmit} ref={formRef} noValidate className="nc-container py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-12">
        {/* ---------------------------------------------------------------- */}
        {/* Left column: contact + address                                    */}
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
            {isBuyNow ? (
              <p className="mt-3 text-sm text-ink-muted">
                Checking out a single item. Your cart is untouched and still waiting
                for you.{' '}
                <Link href={ALL_ROUTES.cart} className="nc-link">
                  View cart
                </Link>
              </p>
            ) : null}
          </section>

          {formError ? (
            <Alert tone="error" title="We could not complete that">
              <p>{formError}</p>
            </Alert>
          ) : null}

          {/*
            Payment failure. The order exists but is NOT confirmed, the cart is
            still full, and the customer can safely retry the same order.
          */}
          {paymentError ? (
            <Alert tone="error" title="Payment failed. Your order has not been confirmed.">
              <p>{paymentError}</p>
              {pending ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onRetryPayment}
                    disabled={busy}
                    className="nc-btn-primary"
                  >
                    {phase === 'paying' ? 'Opening payment…' : 'Try Payment Again'}
                  </button>
                  <span className="text-xs text-ink-muted">
                    Order {pending.orderId} is saved — retrying will not create a
                    second order.
                  </span>
                </div>
              ) : null}
            </Alert>
          ) : null}

          {/* --- Contact ---------------------------------------------------- */}
          <fieldset className="nc-card p-5 sm:p-6" disabled={busy}>
            <legend className="sr-only">Contact details</legend>
            <h2 className="font-display text-lg text-jaggery-500">Delivery details</h2>
            <p className="mt-1 text-sm text-ink-muted">
              All fields are required so the parcel reaches you and we can send your
              confirmation.
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
                required
                type="email"
                autoComplete="email"
                maxLength={160}
                className="sm:col-span-2"
                value={address.email}
                onChange={(e) => set('email', e.target.value)}
                error={errors.email}
                hint="Your order confirmation and invoice are sent here."
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
                label="Address (house / flat and street)"
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

            {methodAvailable && !selectedAvailable ? (
              <Alert tone="warning" title="Please choose another payment method" className="mt-4">
                <p>
                  {paymentMethod === 'COD'
                    ? (quote?.codBlockedReason ?? 'Cash on delivery is not available for this order right now.')
                    : 'Online payment is not available for this order right now.'}{' '}
                  Select the available option below to continue.
                </p>
              </Alert>
            ) : null}

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
        {/* Right column: order summary, coupon, pay                          */}
        {/* ---------------------------------------------------------------- */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-card border border-cream-300 bg-white p-5 sm:p-6">
            <h2 className="font-display text-lg text-jaggery-500">Order summary</h2>

            {/* --- Items. Every price below comes from the server quote. --- */}
            <ul className="mt-4 divide-y divide-cream-200 border-y border-cream-200">
              {summaryRows.map((row) => (
                <li key={row.id} className="flex gap-3 py-3">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-cream-300 bg-cream-50">
                    {row.imageUrl ? (
                      <OptimizedImage
                        src={row.imageUrl}
                        alt={row.name}
                        aspect="1/1"
                        fit="contain"
                        sizes="64px"
                        maxWidth={160}
                      />
                    ) : (
                      <ImageFallback alt={row.name} aspect="1/1" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">{row.variant}</p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {formatINR(row.unitPricePaise)} × {row.qty}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                        <PriceCompact paise={row.lineTotalPaise} />
                      </p>
                    </div>
                    {row.detail ? (
                      <p className="mt-1 text-2xs text-ink-faint">{row.detail}</p>
                    ) : null}
                    {row.cartKey ? (
                      <button
                        type="button"
                        onClick={() => removeItem(row.cartKey!)}
                        disabled={busy}
                        className="mt-1.5 text-2xs font-medium text-ink-muted underline decoration-cream-400 underline-offset-4 hover:text-[#8F3333] disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            {/* --- Coupon. Entirely optional. ---------------------------- */}
            <div className="mt-4 rounded-xl border border-cream-300 bg-cream-50 p-4">
              {couponCode && quote?.coupon?.valid ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-leaf-600">
                      Coupon {quote.coupon.code} applied
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      You saved <PriceCompact paise={couponDiscount} />.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveCoupon}
                    disabled={busy}
                    className="shrink-0 text-xs font-medium text-ink-muted underline decoration-cream-400 underline-offset-4 hover:text-[#8F3333] disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={onApplyCoupon} noValidate>
                  <label htmlFor="coupon" className="nc-label">
                    Have a coupon code?
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="coupon"
                      name="coupon"
                      type="text"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={40}
                      placeholder="Enter coupon code"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value);
                        setCouponMessage(null);
                      }}
                      disabled={busy}
                      aria-describedby={couponMessage ? 'coupon-message' : undefined}
                      aria-invalid={couponMessage ? !couponMessage.ok : undefined}
                      className="nc-input min-w-0 flex-1 uppercase"
                    />
                    <button
                      type="submit"
                      disabled={busy || couponBusy || couponInput.trim().length === 0}
                      className="nc-btn-outline shrink-0"
                    >
                      {couponBusy ? 'Checking…' : 'Apply'}
                    </button>
                  </div>
                  <p className="mt-1.5 text-2xs text-ink-faint">
                    Optional. Your discount is calculated on the server.
                  </p>
                  {couponMessage ? (
                    <p
                      id="coupon-message"
                      role="status"
                      className={`mt-2 text-xs font-medium ${couponMessage.ok ? 'text-leaf-600' : 'text-[#8F3333]'}`}
                    >
                      {couponMessage.ok
                        ? couponMessage.text
                        : `Invalid or expired coupon code. ${couponMessage.text}`}
                    </p>
                  ) : null}
                </form>
              )}
            </div>

            {/* --- Totals. All server-computed. ---------------------------- */}
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
                  <dd className="font-semibold tabular-nums">
                    −<PriceCompact paise={quote.productDiscountPaise} />
                  </dd>
                </div>
              ) : null}

              {couponDiscount > 0 ? (
                <div className="flex items-center justify-between text-leaf-500">
                  <dt>Coupon discount{quote?.coupon?.code ? ` (${quote.coupon.code})` : ''}</dt>
                  <dd className="font-semibold tabular-nums">
                    −<PriceCompact paise={couponDiscount} />
                  </dd>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <dt className="text-ink-soft">Delivery</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {!quote ? (
                    <span className="text-ink-faint">Calculating…</span>
                  ) : freeDelivery ? (
                    <span className="text-leaf-600">Free</span>
                  ) : (
                    formatINR(delivery)
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

            {/* Free-shipping progress, only when a threshold is configured. */}
            {quote && quote.freeShippingThresholdPaise && !quote.freeShippingUnlocked ? (
              <p className="mt-3 text-xs text-ink-soft">
                Add{' '}
                <span className="font-semibold text-ginger-600">
                  {formatINR(quote.freeShippingShortfallPaise)}
                </span>{' '}
                more to unlock free delivery
              </p>
            ) : freeDelivery && quote?.freeShippingUnlocked ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-leaf-600">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Free delivery unlocked
              </p>
            ) : null}

            <div className="mt-4 flex items-baseline justify-between border-t border-cream-300 pt-4">
              <span className="text-sm font-semibold text-ink">Total</span>
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
              {phase === 'creating'
                ? 'Placing your order…'
                : phase === 'paying'
                  ? 'Opening payment…'
                  : phase === 'verifying'
                    ? 'Confirming payment…'
                    : pending
                      ? `Retry payment · ${quote ? formatINR(total) : ''}`
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
              We confirm every amount on the server before your order is placed, and
              we verify the payment with Razorpay before we call your order confirmed.
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
/* Summary helpers                                                             */
/* -------------------------------------------------------------------------- */

function bundleLines(
  items: Array<{ bundleId?: string | null; bundleName?: string | null; qty: number }>,
): Array<{ bundleId: string; qty: number }> {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item.bundleId) continue;
    totals.set(item.bundleId, (totals.get(item.bundleId) ?? 0) + item.qty);
  }
  return Array.from(totals, ([bundleId, qty]) => ({ bundleId, qty }));
}

interface SummaryRow {
  id: string;
  name: string;
  variant: string;
  imageUrl: string | null;
  unitPricePaise: number;
  qty: number;
  lineTotalPaise: number;
  /** Cart key this row maps to, so "Remove" can drop it. */
  cartKey: string | null;
  detail?: string;
}

/**
 * Build the checkout summary from the SERVER quote.
 *
 * A quote line is matched back to the cart line that produced it, so the row can
 * be removed. Bundle components are collapsed into one bundle row because the
 * server has already priced the bundle as a whole.
 */
function buildSummaryRows(
  items: Array<{
    key: string;
    productId: string;
    variantId: string;
    name: string;
    weightLabel: string;
    imageUrl: string | null;
    bundleId?: string | null;
    bundleName?: string | null;
  }>,
  quoteLines: QuoteLine[],
): SummaryRow[] {
  const plainItems = items.filter((i) => !i.bundleId);
  const claimed = new Set<string>();
  const rows: SummaryRow[] = [];

  for (const item of plainItems) {
    const match = quoteLines.find(
      (l) => l.productId === item.productId && l.variantId === item.variantId,
    );
    const key = `${item.productId}:${item.variantId}`;
    if (match) claimed.add(key);
    rows.push({
      id: item.key,
      name: match?.name ?? item.name,
      variant: match?.weightLabel ?? item.weightLabel,
      imageUrl: match?.imageUrl ?? item.imageUrl,
      // Server price when we have one; the local snapshot is only a placeholder
      // while the quote is in flight, and is replaced the moment it lands.
      unitPricePaise: match?.unitPricePaise ?? 0,
      qty: match?.qty ?? 0,
      lineTotalPaise: match?.lineTotalPaise ?? 0,
      cartKey: item.key,
    });
  }

  for (const item of items.filter((i) => i.bundleId)) {
    const components = quoteLines.filter((l) => !claimed.has(`${l.productId}:${l.variantId}`));
    for (const c of components) claimed.add(`${c.productId}:${c.variantId}`);
    const total = components.reduce((s, c) => s + c.lineTotalPaise, 0);
    rows.push({
      id: item.key,
      name: item.bundleName ?? item.name,
      variant: `${components.length || item.weightLabel}`,
      imageUrl: item.imageUrl,
      unitPricePaise: components.length ? Math.round(total / components.length) : 0,
      qty: components.reduce((s, c) => s + c.qty, 0),
      lineTotalPaise: total,
      cartKey: item.key,
      detail: components.map((c) => c.name).join(' · '),
    });
  }

  return rows;
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
