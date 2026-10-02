import { formatINR, discountPct } from '@/lib/money';
import clsx from 'clsx';

/**
 * Price display.
 *
 * Honest by construction:
 *  - a price of 0 renders "Price to be announced", never "Free"
 *  - an MRP strikethrough only appears when a real, higher MRP is stored and
 *    the saving percentage is derived from those two numbers
 */
export function Price({
  pricePaise,
  mrpPaise = null,
  size = 'md',
  align = 'left',
  className = '',
  showFreeShipping = false,
}: {
  pricePaise: number;
  mrpPaise?: number | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  align?: 'left' | 'right' | 'center';
  className?: string;
  showFreeShipping?: boolean;
}) {
  const unpriced = pricePaise <= 0;
  const pct = mrpPaise ? discountPct(mrpPaise, pricePaise) : 0;
  const showStrike = !unpriced && pct > 0;

  const sizeClasses = {
    sm: 'text-[0.9375rem]',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-[2rem] sm:text-[2.5rem]',
  }[size];

  return (
    <div
      className={clsx(
        'flex flex-wrap items-baseline gap-x-2 gap-y-1',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
        className,
      )}
    >
      {unpriced ? (
        <span className={clsx('font-semibold text-ink-muted', sizeClasses)}>
          Price to be announced
        </span>
      ) : (
        <>
          <span
            className={clsx('font-semibold tabular-nums text-jaggery-500', sizeClasses)}
            itemProp="price"
          >
            {formatINR(pricePaise)}
          </span>
          {showStrike ? (
            <>
              <span className="text-sm tabular-nums text-ink-faint line-through">
                {formatINR(mrpPaise!)}
              </span>
              <span className="rounded-full bg-ginger-100 px-2 py-0.5 text-2xs font-bold text-ginger-700">
                {pct}% off
              </span>
            </>
          ) : null}
        </>
      )}
      {showFreeShipping ? null : null}
    </div>
  );
}

/** Compact price used inside cart lines and order summaries. */
export function PriceCompact({ paise, className = '' }: { paise: number; className?: string }) {
  return (
    <span className={clsx('tabular-nums', className)}>
      {paise > 0 ? formatINR(paise) : '—'}
    </span>
  );
}
