'use client';

import { useId, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

/**
 * Accessible form controls.
 * Every field gets a real <label for>, an id wired via useId, optional help
 * text and an error message referenced by aria-describedby / aria-invalid.
 */

interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  /** Visually hides the label but keeps it for screen readers. */
  hideLabel?: boolean;
  optional?: boolean;
}

export function Field({
  label,
  error,
  hint,
  required,
  className,
  hideLabel,
  optional,
  children,
  id,
  describedBy,
}: BaseProps & {
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined; 'aria-required': boolean | undefined }) => ReactNode;
  id: string;
  describedBy: string | undefined;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={clsx(
          'nc-label',
          hideLabel && 'sr-only',
          required && 'text-ink',
        )}
      >
        {label}
        {required ? <span className="ml-0.5 text-ginger-600">*</span> : null}
        {optional ? <span className="ml-1.5 text-xs font-normal text-ink-faint">(optional)</span> : null}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {error ? (
        <p id={`${id}-error`} className="nc-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="nc-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedById(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type TextInputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className' | 'required'> & {
    inputClassName?: string;
    prefix?: string;
  };

export function TextInput({
  label,
  error,
  hint,
  required,
  className,
  hideLabel,
  optional,
  inputClassName,
  prefix,
  ...rest
}: TextInputProps) {
  const id = useId();
  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      hideLabel={hideLabel}
      optional={optional}
      id={id}
      describedBy={describedById(id, error, hint)}
    >
      {(a) => (
        <div className="relative">
          {prefix ? (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
              {prefix}
            </span>
          ) : null}
          <input
            {...rest}
            {...a}
            aria-invalid={a['aria-invalid'] || undefined}
            aria-describedby={a['aria-describedby']}
            className={clsx(
              'nc-input',
              prefix && 'pl-8',
              error && 'border-[#C97B7B] focus:border-[#B04A4A] focus:ring-[#B04A4A]/20',
              inputClassName,
            )}
          />
        </div>
      )}
    </Field>
  );
}

type SelectProps = BaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className' | 'required'> & {
    children: ReactNode;
  };

export function Select({
  label,
  error,
  hint,
  required,
  className,
  hideLabel,
  optional,
  children,
  ...rest
}: SelectProps) {
  const id = useId();
  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      hideLabel={hideLabel}
      optional={optional}
      id={id}
      describedBy={describedById(id, error, hint)}
    >
      {(a) => (
        <div className="relative">
          <select
            {...rest}
            {...a}
            aria-invalid={a['aria-invalid'] || undefined}
            aria-describedby={a['aria-describedby']}
            className={clsx(
              'nc-input appearance-none pr-10',
              error && 'border-[#C97B7B]',
            )}
          >
            {children}
          </select>
          <svg
            viewBox="0 0 20 20"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </Field>
  );
}

type TextareaProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className' | 'required'>;

export function Textarea({
  label,
  error,
  hint,
  required,
  className,
  hideLabel,
  optional,
  rows = 5,
  ...rest
}: TextareaProps) {
  const id = useId();
  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      hideLabel={hideLabel}
      optional={optional}
      id={id}
      describedBy={describedById(id, error, hint)}
    >
      {(a) => (
        <textarea
          {...rest}
          {...a}
          rows={rows}
          aria-invalid={a['aria-invalid'] || undefined}
          aria-describedby={a['aria-describedby']}
          className={clsx('nc-input resize-y', error && 'border-[#C97B7B]')}
        />
      )}
    </Field>
  );
}

type RadioCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description?: string;
  badge?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
};

/** Large, thumb-friendly radio — used for payment method and delivery choice. */
export function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  badge,
  disabled,
  icon,
}: RadioCardProps) {
  return (
    <label
      className={clsx(
        'relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all duration-200',
        checked
          ? 'border-jaggery-500 bg-jaggery-50/60 ring-1 ring-jaggery-500'
          : 'border-cream-400 bg-white hover:border-cream-500',
        disabled && 'cursor-not-allowed opacity-55',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={clsx(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          checked ? 'border-jaggery-500' : 'border-cream-500',
        )}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-jaggery-500" /> : null}
      </span>
      {icon ? <span className="shrink-0 text-ink-soft">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[0.9375rem] font-semibold text-ink">{title}</span>
          {badge}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/** Honeypot: hidden from humans, irresistible to bots. */
export function Honeypot({ fieldName = 'website' }: { fieldName?: string }) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
      <label htmlFor={fieldName}>Leave this field empty</label>
      <input id={fieldName} name={fieldName} type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
