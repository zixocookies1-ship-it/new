import Link from 'next/link';
import clsx from 'clsx';

/**
 * Breadcrumb trail.
 *
 * Rendered as an ordered list so screen readers announce the position, and it
 * mirrors the `BreadcrumbList` JSON-LD emitted on the page.
 */
export function Breadcrumbs({
  items,
  className = '',
}: {
  items: Array<{ label: string; href?: string }>;
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={clsx('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] text-ink-muted">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="transition-colors hover:text-jaggery-500">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-ink-soft">
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="text-ink-faint/60">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}