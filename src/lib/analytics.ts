'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _ncq?: string[];
  }
}

/* -------------------------------------------------------------------------- */
/* Typed events                                                               */
/* -------------------------------------------------------------------------- */

export type AnalyticsEvent =
  | { name: 'view_item_list'; items: Item[] }
  | { name: 'select_item'; items: Item[] }
  | { name: 'view_item'; items: Item[] }
  | { name: 'add_to_cart'; items: Item[]; value: number; currency: 'INR' }
  | { name: 'remove_from_cart'; items: Item[]; value: number; currency: 'INR' }
  | { name: 'begin_checkout'; items: Item[]; value: number; currency: 'INR' }
  | { name: 'add_shipping_info'; value: number; currency: 'INR'; items: Item[] }
  | { name: 'add_payment_info'; value: number; currency: 'INR'; items: Item[] }
  | { name: 'search'; term: string; results: number }
  | { name: 'select_promotion'; promotion_name: string; value: number; currency: 'INR' }
  | { name: 'view_promotion'; promotion_name: string }
  | {
      name: 'purchase';
      transaction_id: string;
      value: number;
      currency: 'INR';
      items: Item[];
      coupon?: string | null;
    }
  | { name: 'share'; content_type: string; item_id: string; method: string }
  | { name: 'view_cart' }
  | { name: 'sign_up'; method: string };

export interface Item {
  item_id: string;
  item_name: string;
  /** Rupees (not paise) — GA4/Meta both expect the major unit. */
  price: number;
  quantity: number;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  /** Present when the line came from a bundle. */
  item_list_name?: string;
}

/* -------------------------------------------------------------------------- */
/* Runtime state                                                              */
/* -------------------------------------------------------------------------- */

let config = { gaId: '', pixelId: '' };
let consentGiven = false;
const queued: AnalyticsEvent[] = [];

/** Consent gate. Until this is true, nothing is transmitted anywhere. */
export function setAnalyticsConsent(granted: boolean): void {
  consentGiven = granted;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('nc_consent', granted ? 'granted' : 'denied');
  } catch {
    /* storage blocked — consent stays in memory only */
  }
  if (granted) {
    for (const e of queued.splice(0)) dispatch(e);
  }
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('nc_consent') === 'granted';
  } catch {
    return false;
  }
}

function canTrack(): boolean {
  if (typeof window === 'undefined') return false;
  if (!config.gaId && !config.pixelId) return false;
  if (consentGiven) return true;
  try {
    return window.localStorage.getItem('nc_consent') === 'granted';
  } catch {
    return false;
  }
}

/** Fan a single event out to every configured destination. */
function dispatch(event: AnalyticsEvent): void {
  if (event.name === 'purchase') {
    if (alreadyFired(event.transaction_id)) return;
    markFired(event.transaction_id);
  }
  try {
    sendToGa(event);
  } catch {
    /* analytics must never break the page */
  }
  try {
    sendToMeta(event);
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/* Purchase dedupe                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `purchase` must fire exactly once per order, even across page refreshes,
 * back-button navigation and a Meta Pixel + GA4 double mount.
 */
const PURCHASE_KEY = 'nc_purchased_orders';

function alreadyFired(transactionId: string): boolean {
  try {
    const raw = window.localStorage.getItem(PURCHASE_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) && list.includes(transactionId);
  } catch {
    return false;
  }
}

function markFired(transactionId: string): void {
  try {
    const raw = window.localStorage.getItem(PURCHASE_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!Array.isArray(list)) return;
    // Keep the last 50 so storage never grows unbounded.
    list.push(transactionId);
    window.localStorage.setItem(PURCHASE_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

function sendToGa(e: AnalyticsEvent): void {
  if (!config.gaId || !window.gtag) return;

  const { name, ...params } = e as AnalyticsEvent & Record<string, unknown>;

  // GA4 uses snake_case; normalise camelCase keys.
  const normalised: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    const snake = k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    normalised[snkey(snake)] = v;
  }

  window.gtag('event', name, normalised);
}

function snkey(s: string): string {
  return s;
}

function sendToMeta(e: AnalyticsEvent): void {
  if (!config.pixelId || !window.fbq) return;

  switch (e.name) {
    case 'view_item':
      window.fbq('track', 'ViewContent', {
        content_ids: e.items.map((i) => i.item_id),
        content_name: e.items[0]?.item_name,
        content_type: 'product',
        value: e.items[0]?.price,
        currency: 'INR',
      });
      break;
    case 'view_item_list':
      window.fbq('track', 'ViewContent', {
        content_ids: e.items.map((i) => i.item_id),
        content_type: 'product',
        value: e.items.reduce((s, i) => s + i.price * i.quantity, 0),
        currency: 'INR',
      });
      break;
    case 'add_to_cart':
      window.fbq('track', 'AddToCart', {
        content_ids: e.items.map((i) => i.item_id),
        content_type: 'product',
        value: e.value,
        currency: 'INR',
      });
      break;
    case 'begin_checkout':
      window.fbq('track', 'InitiateCheckout', {
        content_ids: e.items.map((i) => i.item_id),
        content_type: 'product',
        num_items: e.items.reduce((s, i) => s + i.quantity, 0),
        value: e.value,
        currency: 'INR',
      });
      break;
    case 'purchase':
      window.fbq('track', 'Purchase', {
        content_ids: e.items.map((i) => i.item_id),
        content_type: 'product',
        content_name: e.items.map((i) => i.item_name).join(', ').slice(0, 200),
        num_items: e.items.reduce((s, i) => s + i.quantity, 0),
        order_id: e.transaction_id,
        value: e.value,
        currency: 'INR',
      });
      break;
    case 'search':
      window.fbq('track', 'Search', { search_string: e.term });
      break;
    case 'select_promotion':
      window.fbq('track', 'AddToCart', {
        content_name: e.promotion_name,
        content_type: 'promotion',
        value: e.value,
        currency: 'INR',
      });
      break;
    default:
      break;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export function trackEvent(event: AnalyticsEvent): void {
  if (!canTrack()) {
    // Buffer a bounded number so a mid-session consent grant is not lost.
    if (queued.length < 40 && event.name !== 'purchase') queued.push(event);
    return;
  }

  dispatch(event);
}

/**
 * Server-side Conversions API mirror for `purchase`.
 *
 * The browser is blocked from sending it twice and the server is told what was
 * already sent, so a retried webhook or a re-render cannot double-count
 * revenue in the Meta Ads manager.
 */
export function notifyPurchaseMirror(payload: {
  orderId: string;
  value: number;
  items: Item[];
}): void {
  // The browser never holds the Conversions API token — it only tells our own
  // endpoint that a purchase happened, de-duplicated per order. The server
  // decides whether META_CAPI_ACCESS_TOKEN is configured and silently no-ops
  // when it is not.
  if (typeof window === 'undefined' || !config.pixelId || !consentGiven) return;
  const key = 'nc_capi_sent';
  try {
    const raw = window.localStorage.getItem(key);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (list.includes(payload.orderId)) return;
    list.push(payload.orderId);
    window.localStorage.setItem(key, JSON.stringify(list.slice(-50)));
  } catch {
    /* ignore */
  }

  void fetch('/api/analytics/purchase-mirror', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

export function initAnalytics(cfg: { gaId: string; pixelId: string }): void {
  config = cfg;
}
