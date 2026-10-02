import Link from 'next/link';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { LinkProps } from 'next/link';

/**
 * The one button/link primitive for the whole site.
 *
 * Keeping the variant map in a single place is what guarantees the rule from
 * the brand system: ginger is an accent reserved for conversion, never the
 * default background of the page.
 */
const VARIANTS = {
  primary: 'nc-btn-primary',
  accent: 'nc-btn-accent',
  outline: 'nc-btn-outline',
  ghost: 'nc-btn-ghost',
  /** Solid deep brown, used where an accent button would fight the artwork. */
  quiet: 'nc-btn border border-cream-300 bg-white text-jaggery-500 hover:bg-cream-50',
} as const;

const SIZES = {
  sm: 'nc-btn-sm',
  md: '',
  lg: 'min-h-[52px] px-8 text-[0.9375rem]',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClass({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return clsx(VARIANTS[variant], SIZES[size], fullWidth && 'nc-btn-block', className);
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: {
  href: LinkProps['href'];
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'className' | 'children'>) {
  return (
    <Link href={href} className={buttonClass({ variant, size, fullWidth, className })} {...rest}>
      {children}
    </Link>
  );
}