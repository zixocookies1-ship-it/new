'use client';

import { useState } from 'react';

import { TextInput, Textarea, Honeypot } from '@/components/ui/Field';
import { Alert } from '@/components/ui/StateBlocks';

/**
 * Review form.
 *
 * The endpoint decides whether a review is a verified purchase — the client
 * cannot claim it. Copy is explicit that a review is read by a human before it
 * appears, so nobody is surprised by a moderation step we never hide.
 */
export function ReviewForm({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; message: string }
  >({ kind: 'idle' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      productId,
      authorName: String(data.get('authorName') ?? ''),
      authorLocation: String(data.get('authorLocation') ?? ''),
      orderId: String(data.get('orderId') ?? '').trim(),
      contact: String(data.get('contact') ?? '').trim(),
      rating,
      title: String(data.get('title') ?? ''),
      body: String(data.get('body') ?? ''),
      website: String(data.get('website') ?? ''),
    };

    setFieldErrors({});
    setStatus({ kind: 'loading' });

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        details?: Array<{ path: string; message: string }>;
        data?: { message?: string };
      };

      if (!res.ok || !json.ok) {
        const errors: Record<string, string> = {};
        for (const d of json.details ?? []) {
          errors[d.path] = d.message;
        }
        setFieldErrors(errors);
        setStatus({ kind: 'error', message: json.error ?? 'We could not submit that. Please try again.' });
        return;
      }

      form.reset();
      setStatus({
        kind: 'done',
        message: json.data?.message ?? 'Thanks! Your review will appear once our team has read it.',
      });
    } catch {
      setStatus({
        kind: 'error',
        message: 'Network error. Please check your connection and try again.',
      });
    }
  }

  if (status.kind === 'done') {
    return (
      <div className="rounded-card border border-leaf-200 bg-leaf-50 p-5">
        <h3 className="font-display text-lg text-leaf-600">Thank you</h3>
        <p className="nc-body mt-1.5 text-ink-soft">{status.message}</p>
        <button
          type="button"
          onClick={() => {
            setStatus({ kind: 'idle' });
            setOpen(false);
          }}
          className="nc-btn-ghost nc-btn-sm mt-3 !px-0"
        >
          Close
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nc-btn-outline nc-btn-sm"
      >
        Write a review
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="nc-card space-y-4 p-5" noValidate>
      <div>
        <h3 className="font-display text-lg text-jaggery-500">Review {productName}</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Every review is read by a person before it goes live. Writing in your own words is all we
          ask — we do not edit or rewrite reviews.
        </p>
      </div>

      <div>
        <span className="nc-label" id="rating-label">
          Your rating
        </span>
        <div
          className="mt-1 flex items-center gap-1"
          role="radiogroup"
          aria-labelledby="rating-label"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              className="p-1"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-7 w-7 transition-colors ${
                  (hover || rating) >= n ? 'text-ginger-500' : 'text-cream-400'
                }`}
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="m12 2.6 2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5l1.11-6.47-4.7-4.58 6.5-.95L12 2.6Z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {status.kind === 'error' ? <Alert tone="error">{status.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Your name"
          name="authorName"
          required
          autoComplete="name"
          error={fieldErrors.authorName}
        />
        <TextInput
          label="City (optional)"
          name="authorLocation"
          optional
          autoComplete="address-level2"
          error={fieldErrors.authorLocation}
        />
      </div>

      <TextInput
        label="Order ID (optional)"
        name="orderId"
        optional
        placeholder="NC-XXXXXXXXXX"
        hint="Add your order ID so we can mark the review as a verified purchase."
        error={fieldErrors.orderId}
      />

      <TextInput
        label="Email or mobile used on the order (optional)"
        name="contact"
        optional
        autoComplete="email"
        hint="Only needed together with the order ID."
        error={fieldErrors.contact}
      />

      <TextInput label="Title (optional)" name="title" optional error={fieldErrors.title} />

      <Textarea
        label="Your review"
        name="body"
        required
        rows={5}
        placeholder="What did it taste like? How did you use it?"
        error={fieldErrors.body}
        hint="At least 10 characters."
      />

      <Honeypot />

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="nc-btn-primary" disabled={status.kind === 'loading'}>
          {status.kind === 'loading' ? 'Submitting…' : 'Submit review'}
        </button>
        <button
          type="button"
          className="nc-btn-ghost"
          onClick={() => {
            setOpen(false);
            setStatus({ kind: 'idle' });
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}