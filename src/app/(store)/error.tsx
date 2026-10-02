'use client';

import { useEffect } from 'react';
import Link from 'next/link';

import { ErrorState } from '@/components/ui/StateBlocks';
import { ALL_ROUTES } from '@/lib/site';

/**
 * Route-level error boundary.
 *
 * It never prints the underlying error to the customer (that can leak schema
 * names, connection strings or query shapes). It logs to the console for the
 * operator and offers the two useful next steps.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] route error', error);
  }, [error]);

  return (
    <div className="nc-container py-16 sm:py-24">
      <div className="mx-auto max-w-xl">
        <ErrorState
          title="This page did not load"
          message="Something went wrong on our side — not with anything you did. Try again, and if it keeps happening, tell us and we will fix it."
          onRetry={reset}
        />

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={ALL_ROUTES.home} className="nc-btn-outline">
            Back to home
          </Link>
          <Link href={ALL_ROUTES.contact} className="nc-btn-outline">
            Report a problem
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-6 text-center text-2xs text-ink-faint">
            Reference for our team: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
