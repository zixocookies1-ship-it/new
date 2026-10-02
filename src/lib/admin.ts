import 'server-only';

import type { NextResponse } from 'next/server';
import { fail } from './http';
import { requireAdmin, type SessionPayload } from './auth';
import type { UserRole } from './models/User';

/**
 * Admin route guard.
 *
 * Every admin endpoint calls this first and returns its `Response` immediately
 * on failure, so there is exactly one place where "is this request authorised"
 * is decided. No client-side check is ever treated as a security boundary.
 */
export async function guardAdmin(
  allowedRoles?: UserRole[],
): Promise<
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAdmin(allowedRoles);
  if (!auth.ok) {
    return { ok: false, response: fail(auth.reason, { status: auth.status, code: 'UNAUTHORIZED' }) };
  }
  return { ok: true, session: auth.session };
}

/** Roles that may not change money, integration secrets, or user accounts. */
export const ELEVATED_ROLES: UserRole[] = ['ADMIN'];