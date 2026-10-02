import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** Consistent JSON envelope for every API route. */
export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }) {
  return NextResponse.json(
    { ok: true, data },
    { status: init?.status ?? 200, headers: init?.headers },
  );
}

export function fail(
  error: string,
  init: { status?: number; code?: string; details?: unknown; headers?: HeadersInit } = {},
) {
  return NextResponse.json(
    { ok: false, error, code: init.code ?? 'ERROR', details: init.details },
    { status: init.status ?? 400, headers: init.headers },
  );
}

export function notFound(error = 'Not found') {
  return fail(error, { status: 404, code: 'NOT_FOUND' });
}

export function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
    },
  );
}

export function serverError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const message = error instanceof Error ? error.message : fallback;
  // Log server-side; never leak internals to the client.
  console.error('[api:error]', error);
  return fail(message || fallback, { status: 500, code: 'INTERNAL_ERROR' });
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return fail('Invalid request.', {
      status: 422,
      code: 'VALIDATION_ERROR',
      details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return serverError(error);
}

/** Parses a JSON body with a hard size cap so a huge payload cannot be read. */
export async function readJson<T = unknown>(req: Request, maxBytes = 64 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new Error('PAYLOAD_TOO_LARGE');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

export const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const;

/** Short shared cache for public, non-personalised GET responses. */
export function publicCache(seconds: number) {
  return {
    'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`,
  } as const;
}
