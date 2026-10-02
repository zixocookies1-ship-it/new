/**
 * Route-level fallback while a server component streams in.
 *
 * Deliberately brand-neutral: no lorem text, no fake product names, no invented
 * prices — just the skeleton language used everywhere else in the system.
 */
export default function Loading() {
  return (
    <div className="nc-container py-12 sm:py-16" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="nc-skeleton h-3 w-28 rounded" aria-hidden="true" />
      <div className="nc-skeleton mt-4 h-9 w-3/4 max-w-xl rounded" aria-hidden="true" />
      <div className="nc-skeleton mt-3 h-4 w-2/3 max-w-lg rounded" aria-hidden="true" />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="nc-card p-5">
            <div className="nc-skeleton aspect-[4/3] w-full rounded-xl" aria-hidden="true" />
            <div className="nc-skeleton mt-4 h-4 w-3/4 rounded" aria-hidden="true" />
            <div className="nc-skeleton mt-2 h-3 w-1/2 rounded" aria-hidden="true" />
            <div className="nc-skeleton mt-4 h-10 w-full rounded-full" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}
