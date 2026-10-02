import Link from 'next/link';
import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Every list surface on the site uses one of these states instead of rendering
 * a blank region. No page is ever allowed to fail silently.
 */

export function LoadingState({
  title = 'Loading…',
  message,
  className = '',
  rows = 3,
}: {
  title?: string;
  message?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx('space-y-4', className)}
    >
      <span className="sr-only">{title}</span>
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="nc-skeleton h-4 rounded" style={{ width: `${92 - i * 12}%` }} />
        ))}
      </div>
      {message ? <p className="nc-body text-ink-muted">{message}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  secondaryAction,
  className = '',
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-cream-400 bg-white/60 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-4 text-ginger-400">{icon}</div> : null}
      <h3 className="nc-h3 text-jaggery-500">{title}</h3>
      {message ? <p className="nc-body mt-2 max-w-prose text-ink-muted">{message}</p> : null}
      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action ? <StateButton {...action} variant="primary" /> : null}
          {secondaryAction ? <StateButton {...secondaryAction} variant="outline" /> : null}
        </div>
      ) : null}
    </div>
  );
}

function StateButton({
  label,
  href,
  onClick,
  variant,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  variant: 'primary' | 'outline';
}) {
  const cls = variant === 'primary' ? 'nc-btn-primary' : 'nc-btn-outline';
  if (href) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {label}
    </button>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  action,
  className = '',
  onRetry,
}: {
  title?: string;
  message?: string;
  action?: { label: string; href?: string };
  className?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className={clsx(
        'flex flex-col items-center justify-center rounded-card border border-[#E6C9C9] bg-[#FDF6F6] px-6 py-12 text-center',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="mb-4 h-9 w-9 text-[#B04A4A]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.2v.3" strokeLinecap="round" />
      </svg>
      <h3 className="nc-h3 text-jaggery-500">{title}</h3>
      {message ? <p className="nc-body mt-2 max-w-prose text-ink-soft">{message}</p> : null}
      {onRetry || action ? (
        <div className="mt-6">
          {onRetry ? (
            <button type="button" onClick={onRetry} className="nc-btn-primary">
              Try again
            </button>
          ) : action?.href ? (
            <Link href={action.href} className="nc-btn-primary">
              {action!.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Inline, dismissible alert used for form-level errors and warnings. */
export function Alert({
  tone = 'info',
  title,
  children,
  className = '',
  action,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const tones = {
    info: 'border-cream-400 bg-cream-50 text-ink-soft',
    success: 'border-leaf-200 bg-leaf-50 text-leaf-600',
    warning: 'border-ginger-200 bg-ginger-50 text-ginger-700',
    error: 'border-[#E6C9C9] bg-[#FDF6F6] text-[#8F3333]',
  }[tone];

  const iconColor = {
    info: 'text-ink-muted',
    success: 'text-leaf-500',
    warning: 'text-ginger-600',
    error: 'text-[#B04A4A]',
  }[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx('flex gap-3 rounded-xl border px-4 py-3', tones, className)}
    >
      <svg
        viewBox="0 0 20 20"
        className={clsx('mt-0.5 h-4 w-4 shrink-0', iconColor)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        {tone === 'success' ? (
          <path d="M4 10.5 8 14.5 16 6" strokeLinecap="round" strokeLinejoin="round" />
        ) : tone === 'error' || tone === 'warning' ? (
          <>
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 6.5v4M10 13.4v.2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 9v4.5M10 6.6v.2" strokeLinecap="round" />
          </>
        )}
      </svg>
      <div className="min-w-0 flex-1 text-[0.875rem] leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={clsx(title && 'mt-0.5')}>{children}</div> : null}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ginger' | 'leaf' | 'jaggery' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-cream-200 text-ink-soft',
    ginger: 'bg-ginger-100 text-ginger-700',
    leaf: 'bg-leaf-100 text-leaf-600',
    jaggery: 'bg-jaggery-100 text-jaggery-600',
    warning: 'bg-ginger-100 text-ginger-800',
    danger: 'bg-[#F6E2E2] text-[#8F3333]',
    info: 'bg-jaggery-50 text-jaggery-500',
  }[tone];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
        tones,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className = '',
  as: Tag = 'h2',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div
      className={clsx(
        'max-w-3xl',
        align === 'center' ? 'mx-auto text-center' : 'text-left',
        className,
      )}
    >
      {eyebrow ? (
        <p className="nc-eyebrow mb-3" data-reveal>
          {eyebrow}
        </p>
      ) : null}
      <Tag className={clsx(Tag === 'h1' ? 'nc-h1' : 'nc-h2')}>{title}</Tag>
      {description ? (
        <p className="nc-lede mt-4" data-reveal>
          {description}
        </p>
      ) : null}
    </div>
  );
}
