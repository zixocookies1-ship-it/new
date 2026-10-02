'use client';

import { useState } from 'react';

import { TextInput, Textarea, Honeypot } from '@/components/ui/Field';
import { Alert } from '@/components/ui/StateBlocks';
import { trackEvent } from '@/lib/analytics';

const SUBJECTS = [
  'General question',
  'Order related',
  'Product question',
  'Bulk / corporate enquiry',
  'Something else',
];

/**
 * Contact form.
 *
 * The copy is careful about one thing in particular: there is no email provider
 * wired up, so the form never promises a reply time. It says exactly what
 * happens — the message lands in our inbox and a person reads it.
 */
export function ContactForm() {
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; message: string }
  >({ kind: 'idle' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      subject: String(data.get('subject') ?? ''),
      message: String(data.get('message') ?? ''),
      website: String(data.get('website') ?? ''),
    };

    setFieldErrors({});
    setStatus({ kind: 'loading' });

    try {
      const res = await fetch('/api/contact', {
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
        for (const d of json.details ?? []) errors[d.path] = d.message;
        setFieldErrors(errors);
        setStatus({
          kind: 'error',
          message: json.error ?? 'We could not send that. Please check the form and try again.',
        });
        return;
      }

      trackEvent({ name: 'sign_up', method: 'contact_form' });
      form.reset();
      setStatus({
        kind: 'done',
        message: json.data?.message ?? 'Thanks — your message has been received.',
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
      <div className="nc-card p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-50 text-leaf-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4.5 10.5 8 14l7.5-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h2 className="font-display text-lg text-jaggery-500">Message received</h2>
            <p className="nc-body mt-1.5 text-ink-soft">{status.message}</p>
            <button
              type="button"
              className="nc-btn-outline nc-btn-sm mt-4"
              onClick={() => setStatus({ kind: 'idle' })}
            >
              Send another message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="nc-card space-y-4 p-5 sm:p-6" noValidate>
      <div>
        <h2 className="font-display text-lg text-jaggery-500">Send us a message</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Tell us what you need. The more context you give, the faster we can help.
        </p>
      </div>

      {status.kind === 'error' ? <Alert tone="error">{status.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Your name"
          name="name"
          required
          autoComplete="name"
          error={fieldErrors.name}
        />
        <TextInput
          label="Mobile number"
          name="phone"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          error={fieldErrors.phone}
        />
      </div>

      <TextInput
        label="Email address"
        name="email"
        type="email"
        required
        autoComplete="email"
        error={fieldErrors.email}
      />

      <div>
        <label htmlFor="contact-subject" className="nc-label">
          Subject<span className="ml-0.5 text-ginger-600">*</span>
        </label>
        <select
          id="contact-subject"
          name="subject"
          className="nc-input"
          defaultValue={SUBJECTS[0]}
          aria-invalid={fieldErrors.subject ? true : undefined}
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {fieldErrors.subject ? (
          <p className="nc-error" role="alert">
            {fieldErrors.subject}
          </p>
        ) : null}
      </div>

      <Textarea
        label="Message"
        name="message"
        required
        rows={6}
        placeholder="Include your order ID if your question is about an order."
        error={fieldErrors.message}
        hint="At least 10 characters."
      />

      <Honeypot />

      <button type="submit" className="nc-btn-accent nc-btn-block" disabled={status.kind === 'loading'}>
        {status.kind === 'loading' ? 'Sending…' : 'Send message'}
      </button>

      <p className="text-xs leading-relaxed text-ink-faint">
        We use your details only to answer this message. Read our{' '}
        <a href="/privacy-policy" className="nc-link">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}