import clsx from 'clsx';

/**
 * Star rating.
 *
 * `count` is the number of real approved reviews. Callers must pass 0 when
 * there are none — this component never invents an average, and the storefront
 * hides the block entirely at zero.
 */
export function Rating({
  value,
  count,
  size = 'sm',
  showValue = true,
  className = '',
}: {
  value: number;
  count: number;
  size?: 'xs' | 'sm' | 'md';
  showValue?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;

  const rounded = Math.round(value * 2) / 2;
  const px = size === 'xs' ? 12 : size === 'sm' ? 14 : 18;

  return (
    <div
      className={clsx('flex items-center gap-1.5', className)}
      aria-label={`Rated ${value.toFixed(1)} out of 5 from ${count} customer review${count === 1 ? '' : 's'}`}
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <svg
              key={i}
              width={px}
              height={px}
              viewBox="0 0 20 20"
              className={clsx(
                filled || half ? 'text-ginger-500' : 'text-cream-400',
              )}
            >
              <defs>
                {half ? (
                  <linearGradient id={`half-${i}`}>
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                ) : null}
              </defs>
              <path
                d="M10 1.6l2.47 5.2 5.53.76-4.03 3.9 1 5.54L10 14.4l-4.97 2.6 1-5.54L2 7.56l5.53-.76L10 1.6Z"
                fill={half ? `url(#half-${i})` : 'currentColor'}
                className={clsx(!filled && !half && 'opacity-60')}
              />
            </svg>
          );
        })}
      </span>
      {showValue ? (
        <span className="text-[0.8125rem] font-medium text-ink-soft">
          {value.toFixed(1)}
          <span className="ml-1 text-ink-faint">
            ({count} review{count === 1 ? '' : 's'})
          </span>
        </span>
      ) : null}
    </div>
  );
}
