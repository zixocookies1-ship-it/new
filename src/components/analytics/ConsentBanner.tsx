'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { hasAnalyticsConsent, setAnalyticsConsent } from '@/lib/analytics';

/**
 * Consent banner.
 *
 * Analytics and marketing tags stay completely unloaded until this is accepted.
 * A stored "denied" still loads nothing; a stored "granted" reloads the tags.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem('nc_consent');
    } catch {
      stored = null;
    }
    // Show only when the visitor has not decided either way.
    setVisible(stored !== 'granted' && stored !== 'denied');
  }, []);

  function decide(granted: boolean) {
    setAnalyticsConsent(granted);
    setVisible(false);
    window.dispatchEvent(new CustomEvent('nc:consent-change'));
    if (granted) {
      // Re-render Analytics so the tags mount now that consent exists.
      window.location.reload();
    }
  }

  if (!mounted || !visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie and analytics preferences"
      className={clsx(
        'fixed inset-x-0 bottom-0 z-[60] animate-slide-up-sheet',
        'border-t border-cream-400 bg-white/97 backdrop-blur-md',
      )}
    >
      <div className="nc-container py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-jaggery-500">
              Cookies &amp; analytics
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">
              We use analytics cookies to understand how the site is used and to improve it.
              You can accept, or continue without them — ordering works either way.{' '}
              <Link href="/cookie-policy" className="nc-link whitespace-nowrap">
                Cookie policy
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => decide(false)}
              className="nc-btn-outline nc-btn-sm sm:min-w-[9rem]"
            >
              Continue without
            </button>
            <button
              type="button"
              onClick={() => decide(true)}
              className="nc-btn-primary nc-btn-sm sm:min-w-[9rem]"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
