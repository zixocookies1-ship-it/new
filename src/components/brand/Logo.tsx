import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import type { MediaRef } from '@/lib/types';

/**
 * Brand mark.
 *
 * If a logo has been uploaded in Admin → Settings it is used (served from
 * Cloudinary, optimised). Otherwise an inline wordmark is rendered — so the
 * header is never broken by a missing asset, and we never fabricate a logo file.
 */
export function Logo({
  logo,
  variant = 'light',
  className = '',
  priority = false,
}: {
  logo?: MediaRef | null;
  variant?: 'light' | 'dark';
  className?: string;
  priority?: boolean;
}) {
  const text = variant === 'light' ? 'text-jaggery-500' : 'text-cream-50';
  const sub = variant === 'light' ? 'text-ink-muted' : 'text-cream-200/80';

  if (logo?.publicId) {
    return (
      <Link
        href="/"
        aria-label="Nature’s Choice Jaggery — home"
        className={clsx('inline-flex shrink-0 items-center', className)}
    >
        <Image
          src={cloudinaryUrl(logo.publicId, { width: 320, height: 80, crop: 'contain' })}
          alt="Nature’s Choice Jaggery"
          width={160}
          height={40}
          priority={priority}
          className="h-9 w-auto object-contain sm:h-10"
        />
      </Link>
    );
  }

  return (
    <Link
      href="/"
      aria-label="Nature’s Choice Jaggery — home"
      className={clsx('group inline-flex shrink-0 items-center gap-2.5', className)}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-200 sm:h-10 sm:w-10',
          variant === 'light'
            ? 'bg-jaggery-500 text-cream-50 group-hover:bg-jaggery-600'
            : 'bg-cream-50/15 text-cream-50 group-hover:bg-cream-50/25',
        )}
      >
        <svg viewBox="0 0 32 32" className="h-[22px] w-[22px]" fill="none" aria-hidden="true">
          {/* A stylised jar with a jaggery pour — abstract, not a fake pack shot. */}
          <path
            d="M11 11.5h10l-.9 12.2a2 2 0 0 1-2 1.8h-4.2a2 2 0 0 1-2-1.8L11 11.5Z"
            fill="currentColor"
            fillOpacity="0.22"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9.6 11.5h12.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M13 11.5V9.8a3 3 0 0 1 6 0v1.7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={clsx(
            'font-display text-[1.0625rem] font-semibold leading-none tracking-[-0.01em] sm:text-xl',
            text,
          )}
        >
          Nature&rsquo;s Choice
        </span>
        <span
          className={clsx(
            'mt-1 text-[0.5625rem] font-semibold uppercase tracking-widest2 sm:text-[0.625rem]',
            sub,
          )}
        >
          Jaggery
        </span>
      </span>
    </Link>
  );
}
