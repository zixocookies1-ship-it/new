'use client';

import clsx from 'clsx';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/**
 * Admin UI kit.
 *
 * A small, dense, keyboard-friendly set of primitives. Every field is a real
 * `<label for>` so the whole panel is usable without a mouse, which is how a
 * merchant actually works — fast, on a laptop, all day.
 */

export const inputClass =
  'block w-full rounded-lg border border-cream-400 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint/70 focus:border-jaggery-500 focus:outline-none focus:ring-2 focus:ring-jaggery-500/20 disabled:bg-cream-100 disabled:text-ink-faint';

export const labelClass = 'mb-1 block text-xs font-semibold text-ink';

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx('rounded-xl border border-cream-300 bg-white shadow-sm', className)}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="font-display text-base text-jaggery-500">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl text-jaggery-500">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  href?: string;
}) {
  const toneClass = {
    neutral: 'text-ink',
    good: 'text-leaf-600',
    warn: 'text-ginger-700',
    bad: 'text-[#8F3333]',
  }[tone];

  const body = (
    <>
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={clsx('mt-1.5 font-display text-2xl tabular-nums', toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-cream-300 bg-white p-4 transition-shadow hover:shadow-card-hover"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-xl border border-cream-300 bg-white p-4">{body}</div>;
}

/* -------------------------------------------------------------------------- */
/* Form primitives                                                             */
/* -------------------------------------------------------------------------- */

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}

function FieldShell({ label, hint, error, required, className, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required ? <span className="ml-0.5 text-ginger-600">*</span> : null}
      </label>
      {children({ id, describedBy: error ? errorId : hint ? hintId : undefined })}
      {error ? (
        <p id={errorId} className="mt-1 text-xs font-medium text-[#9B2C2C]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> & {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function AdminInput({ label, hint, error, className, ...rest }: TextProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy }) => (
        <input
          {...rest}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={clsx(inputClass, error && 'border-[#C97B7B]')}
        />
      )}
    </FieldShell>
  );
}

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> & {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function AdminTextarea({ label, hint, error, className, rows = 4, ...rest }: AreaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy }) => (
        <textarea
          {...rest}
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={clsx(inputClass, 'resize-y leading-relaxed', error && 'border-[#C97B7B]')}
        />
      )}
    </FieldShell>
  );
}

type DropdownProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> & {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function AdminSelect({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: DropdownProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy }) => (
        <select
          {...rest}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={clsx(inputClass, error && 'border-[#C97B7B]')}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function AdminToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  tone = 'default',
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  tone?: 'default' | 'warning';
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={clsx(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
        checked
          ? tone === 'warning'
            ? 'border-ginger-500 bg-ginger-50'
            : 'border-jaggery-500/40 bg-jaggery-50/50'
          : 'border-cream-300 bg-cream-50 hover:border-cream-400',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#5A321F]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/**
 * Money input that speaks rupees to the human and paise to the server.
 *
 * This is the single most important conversion in the admin panel — an off-by-100
 * price would be a real-money bug, so it lives in one component.
 */
export function MoneyInput({
  label,
  paise,
  onChange,
  hint,
  placeholder = '0',
  disabled,
  allowBlank = false,
}: {
  label: string;
  paise: number | null;
  onChange: (paise: number | null) => void;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  /** When false, a cleared input falls back to 0 rather than null. */
  allowBlank?: boolean;
}) {
  const [text, setText] = useState(() => (paise === null || paise === undefined ? '' : String(paise / 100)));
  const lastProp = useRef(paise);

  // Re-sync when the parent changes the value (e.g. loading an existing product)
  // but never while the operator is mid-keystroke.
  useEffect(() => {
    if (paise === lastProp.current) return;
    lastProp.current = paise;
    setText(paise === null || paise === undefined ? '' : String(paise / 100));
  }, [paise]);

  return (
    <AdminInput
      label={label}
      hint={hint}
      inputMode="decimal"
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== '' && !/^\d*\.?\d{0,2}$/.test(raw)) return;
        setText(raw);
        if (raw.trim() === '') {
          lastProp.current = null;
          onChange(allowBlank ? null : 0);
          return;
        }
        const rupees = Number(raw);
        if (!Number.isFinite(rupees)) return;
        const next = Math.round(rupees * 100);
        lastProp.current = next;
        onChange(next);
      }}
    />
  );
}

/** Repeatable plain-string list (ingredients, allergens, steps, PIN codes). */
export function StringListInput({
  label,
  values,
  onChange,
  hint,
  placeholder = 'Add an item',
  addLabel = 'Add',
  multiline = false,
  max = 40,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  placeholder?: string;
  addLabel?: string;
  /** When true each row is a textarea (long-form, e.g. recipe steps). */
  multiline?: boolean;
  max?: number;
}) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <ul className="space-y-2">
        {values.map((value, i) => (
          <li key={i} className="flex items-start gap-2">
            {multiline ? (
              <textarea
                aria-label={`${label} ${i + 1}`}
                rows={3}
                value={value}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                className={clsx(inputClass, 'resize-y')}
              />
            ) : (
              <input
                aria-label={`${label} ${i + 1}`}
                value={value}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                className={inputClass}
              />
            )}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cream-300 text-ink-muted transition-colors hover:border-[#D9B4B4] hover:text-[#8F3333]"
              aria-label={`Remove ${label} ${i + 1}`}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={values.length >= max}
        onClick={() => onChange([...values, ''])}
        className="mt-2 text-xs font-semibold text-jaggery-500 underline decoration-cream-400 underline-offset-4 hover:decoration-ginger-500 disabled:opacity-40"
      >
        + {addLabel}
      </button>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** Chip-style multi-value input, used for PIN code lists. */
export function ChipListInput({
  label,
  values,
  onChange,
  hint,
  placeholder = '6-digit PIN code',
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const value = draft.trim();
    if (!value) return;
    if (values.includes(value)) {
      setDraft('');
      return;
    }
    onChange([...values, value]);
    setDraft('');
  }

  return (
    <div>
      <label htmlFor={`${label}-chip`} className={labelClass}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={`${label}-chip`}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-lg border border-jaggery-500/30 px-3 text-xs font-semibold text-jaggery-500 hover:bg-jaggery-500/[0.06]"
        >
          Add
        </button>
      </div>

      {values.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2.5 py-0.5 font-mono text-xs text-ink-soft"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-ink-faint hover:text-[#8F3333]"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                                */
/* -------------------------------------------------------------------------- */

export type PillTone =
  | 'neutral'
  | 'good'
  | 'warn'
  | 'bad'
  | 'info'
  | 'jaggery';

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: PillTone }) {
  const tones: Record<PillTone, string> = {
    neutral: 'bg-cream-200 text-ink-soft',
    good: 'bg-leaf-100 text-leaf-600',
    warn: 'bg-ginger-100 text-ginger-800',
    bad: 'bg-[#F6E2E2] text-[#8F3333]',
    info: 'bg-jaggery-50 text-jaggery-600',
    jaggery: 'bg-jaggery-100 text-jaggery-700',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export const ORDER_TONE: Record<string, PillTone> = {
  ORDER_PLACED: 'info',
  PAYMENT_PENDING: 'warn',
  PAID: 'jaggery',
  PROCESSING: 'jaggery',
  SHIPPED: 'warn',
  IN_TRANSIT: 'warn',
  OUT_FOR_DELIVERY: 'warn',
  DELIVERED: 'good',
  CANCELLED: 'bad',
  REFUNDED: 'neutral',
};

export const PAYMENT_TONE: Record<string, PillTone> = {
  PENDING: 'warn',
  PAID: 'good',
  FAILED: 'bad',
  REFUNDED: 'neutral',
};

export const SYNC_TONE: Record<string, PillTone> = {
  IDLE: 'neutral',
  PENDING: 'warn',
  SUCCESS: 'good',
  FAILED: 'bad',
};

export function StatusPill({ value, map }: { value: string; map?: Record<string, PillTone> }) {
  const tone: PillTone = map?.[value] ?? 'neutral';
  return <Pill tone={tone}>{value.replace(/_/g, ' ')}</Pill>;
}

export function Table({
  headers,
  children,
  minWidth = 720,
}: {
  headers: ReactNode;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-cream-300 text-left">{headers}</tr>
        </thead>
        <tbody className="divide-y divide-cream-200">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={clsx('whitespace-nowrap px-2 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted', className)}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx('px-2 py-2.5 align-middle text-ink-soft', className)}>{children}</td>;
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-2 py-10 text-center text-sm text-ink-muted">
        {message}
      </td>
    </tr>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3">{children}</div>;
}

export function Btn({
  children,
  onClick,
  type = 'button',
  variant = 'secondary',
  size = 'md',
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const variants = {
    primary: 'border-jaggery-500 bg-jaggery-500 text-cream-50 hover:bg-jaggery-600',
    secondary: 'border-cream-400 bg-white text-jaggery-500 hover:bg-cream-50',
    danger: 'border-[#D9B4B4] bg-white text-[#8F3333] hover:bg-[#FDF6F6]',
    ghost: 'border-transparent bg-transparent text-jaggery-500 hover:bg-jaggery-500/[0.06]',
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'min-h-[32px] px-2.5 text-xs' : 'min-h-[38px] px-3.5 text-sm',
        variants,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function InlineAlert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'good' | 'warn' | 'bad';
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: 'border-cream-400 bg-cream-50 text-ink-soft',
    good: 'border-leaf-200 bg-leaf-50 text-leaf-600',
    warn: 'border-ginger-200 bg-ginger-50 text-ginger-800',
    bad: 'border-[#E6C9C9] bg-[#FDF6F6] text-[#8F3333]',
  }[tone];

  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={clsx('rounded-lg border px-3 py-2.5 text-xs leading-relaxed', tones)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {title ? <div className="mt-0.5">{children}</div> : children}
    </div>
  );
}

/** Two-column key/value grid for read-only detail panels. */
export function DefinitionList({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode } | null>;
  className?: string;
}) {
  const rows = items.filter(Boolean) as Array<{ label: string; value: ReactNode }>;
  if (!rows.length) return null;
  return (
    <dl className={clsx('divide-y divide-cream-200', className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {row.label}
          </dt>
          <dd className="min-w-0 text-sm text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="nc-skeleton h-9 rounded-lg" style={{ width: `${95 - i * 14}%` }} />
      ))}
    </div>
  );
}
