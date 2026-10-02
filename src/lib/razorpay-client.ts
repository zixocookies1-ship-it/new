'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; close?: () => void };
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
const SCRIPT_ID = 'nc-razorpay-checkout';

/**
 * Loads the Razorpay checkout script once per page.
 *
 * The script is a third-party asset, so it is only requested when a customer
 * actually reaches the payment step — never on page load. If the CDN is
 * unreachable we surface the failure so checkout can fall back to
 * "retry / choose another method" instead of hanging on a spinner.
 */
export function useRazorpayScript(): 'idle' | 'loading' | 'ready' | 'failed' {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  useEffect(() => {
    if (status !== 'idle') return;
    if (typeof window === 'undefined') return;
    if (window.Razorpay) {
      setStatus('ready');
      return;
    }

    setStatus('loading');
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => setStatus('ready'));
      existing.addEventListener('error', () => setStatus('failed'));
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => setStatus('ready'));
    script.addEventListener('error', () => setStatus('failed'));
    document.body.appendChild(script);
  }, [status]);

  return status;
}
