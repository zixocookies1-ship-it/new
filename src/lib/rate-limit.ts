import 'server-only';

/**
 * Lightweight in-process rate limiter.
 *
 * Purpose: blunt abuse of the endpoints that matter (login, order creation,
 * payment verification, contact form, coupon guessing) without adding a Redis
 * dependency to the project.
 *
 * LIMITATION — documented rather than hidden: this is per-instance state. On a
 * multi-instance/serverless deployment the effective limit is
 * `limit x instanceCount`. Swap `hit()` for a Redis/Upstash implementation
 * behind the same signature if you scale horizontally.
 */

interface Bucket {
  count: number;
  resetAt: number;
  // Track distinct identifiers to make per-IP limits meaningful.
  seen: Set<string>;
}

const buckets = new Map<string, Bucket>();

let lastSweep = Date.now();
const SWEEP_MS = 60_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

export function hit(
  key: string,
  limit: number,
  windowMs: number,
  identifier = 'global',
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs, seen: new Set() };
    buckets.set(key, bucket);
  }

  // One IP must not consume the whole shared budget in one window.
  const perIdent = Math.max(1, Math.ceil(limit / 4));
  if (!bucket.seen.has(identifier) && bucket.seen.size >= perIdent * 4) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
      limit,
    };
  }
  bucket.seen.add(identifier);

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);

  return {
    ok: bucket.count <= limit,
    remaining,
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    limit,
  };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? '0.0.0.0';
}

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 10 * 60_000 },
  orderCreate: { limit: 12, windowMs: 10 * 60_000 },
  paymentVerify: { limit: 30, windowMs: 10 * 60_000 },
  coupon: { limit: 30, windowMs: 5 * 60_000 },
  serviceability: { limit: 40, windowMs: 5 * 60_000 },
  contact: { limit: 5, windowMs: 60 * 60_000 },
  review: { limit: 5, windowMs: 60 * 60_000 },
  track: { limit: 20, windowMs: 10 * 60_000 },
  adminWrite: { limit: 300, windowMs: 60_000 },
} as const;

export function clearAllRateLimits(): void {
  buckets.clear();
}
