import clsx from 'clsx';

/**
 * A clearly-marked placeholder for copy or a fact the merchant has not
 * confirmed yet.
 *
 * The rule this enforces: when we do not know something, we say so — we never
 * substitute a plausible-sounding claim. `ContentSection.verified` and
 * `BusinessSettings.isVerified` drive this, and the same flag shows up in the
 * admin setup checklist so the placeholder cannot quietly become a "fact".
 */
export function PlaceholderNote({
  label = 'Details to be confirmed',
  className = '',
  compact = false,
}: {
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <p
      className={clsx(
        'inline-flex items-start gap-2 rounded-full border border-dashed border-ginger-300 bg-ginger-50/70 text-ginger-700',
        compact ? 'px-3 py-1 text-2xs' : 'px-3.5 py-1.5 text-xs',
        className,
      )}
    >
      <svg
        viewBox="0 0 20 20"
        className="mt-px h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 9v4.5M10 6.5v.2" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </p>
  );
}

/**
 * Renders merchant copy only when it exists; otherwise shows a placeholder.
 * Used anywhere a section would otherwise collapse into an empty white box.
 */
export function VerifiedOrPlaceholder({
  text,
  verified,
  placeholder = 'This detail is being finalised. Please check back shortly.',
  className = '',
}: {
  text: string | null | undefined;
  /** `false` means the copy is present but NOT yet confirmed by a human. */
  verified: boolean;
  placeholder?: string;
  className?: string;
}) {
  if (!text || !text.trim()) {
    return <PlaceholderNote label={placeholder} className={className} />;
  }
  return (
    <span className={className}>
      {text}
      {!verified ? (
        <PlaceholderNote label="Placeholder — the team is confirming this detail." compact className="ml-2 align-middle" />
      ) : null}
    </span>
  );
}