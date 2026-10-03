/**
 * Admin fetch helper.
 *
 * Every admin endpoint speaks the same envelope: `{ok: true, data}` or
 * `{ok: false, error, code, details}`. This wrapper unwraps it, so components
 * deal in plain data and a thrown `AdminError` they can render.
 */

export class AdminError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'AdminError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function adminFetch<T>(
  path: string,
  init: { method?: Method; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
    credentials: 'same-origin',
  });

  let json: { ok?: boolean; data?: T; error?: string; code?: string; details?: unknown } = {};
  try {
    json = await res.json();
  } catch {
    throw new AdminError('The server did not return a valid response.', res.status, 'BAD_RESPONSE');
  }

  if (!res.ok || json.ok !== true || json.data === undefined) {
    // A session that has expired should send the operator back to the login form
    // rather than showing a confusing "not authenticated" toast forever.
    if (res.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
        window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    throw new AdminError(
      json.error ?? 'Something went wrong. Please try again.',
      res.status,
      json.code ?? 'ERROR',
      json.details,
    );
  }

  return json.data;
}

/** Paise -> the rupees string an admin actually types. */
export function paiseToRupeeInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '';
  if (paise === 0) return '0';
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

/** The rupees an admin typed -> integer paise, or null when left blank. */
export function rupeeInputToPaise(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}