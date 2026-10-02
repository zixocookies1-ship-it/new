import 'server-only';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { connectDb } from './db';
import { serverEnv, integrationState } from './env';
import { User, type UserDoc, type UserRole } from './models/User';

/**
 * Admin authentication.
 *
 * - Passwords are bcrypt-hashed (cost 12); hashes never leave the server.
 * - Sessions are stateless JWTs in an httpOnly, SameSite=Lax, Secure cookie.
 *   The signing secret lives only in AUTH_SECRET, never in NEXT_PUBLIC_*.
 * - Every mutating admin route calls `requireAdmin()`; there is no client-side
 *   gate that is treated as a security boundary.
 */

export const SESSION_COOKIE = 'nc_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h working day
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

export interface SessionPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
}

function secretKey(): Uint8Array {
  if (integrationState('auth') !== 'configured') {
    throw new Error('AUTH_SECRET is not configured. Admin login is disabled.');
  }
  return new TextEncoder().encode(serverEnv.authSecret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: payload.email, role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .setIssuer('natures-choice')
    .setAudience('natures-choice-admin')
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'natures-choice',
      audience: 'natures-choice-admin',
    });
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      sub: String(payload.sub),
      email: payload.email,
      role: (payload.role as UserRole) ?? 'EDITOR',
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  if (integrationState('auth') !== 'configured') return null;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Defence in depth: confirm the account is still active server-side, so a
  // deactivated admin loses access immediately rather than at token expiry.
  try {
    await connectDb();
    const user = await User.findById(payload.sub).select('isActive role email name').lean().exec();
    if (!user || !user.isActive) return null;
    return { sub: payload.sub, email: user.email, role: user.role, name: user.name };
  } catch {
    // If the DB is momentarily unreachable, fail closed.
    return null;
  }
}

export type AuthResult =
  | { ok: true; session: SessionPayload; user: UserDoc }
  | { ok: false; reason: string; status: number };

/** Guard for every admin API route / server action. */
export async function requireAdmin(
  allowedRoles?: UserRole[],
): Promise<AuthResult> {
  if (integrationState('auth') !== 'configured') {
    return { ok: false, reason: 'Admin access is not configured (AUTH_SECRET missing).', status: 503 };
  }

  const session = await getSession();
  if (!session) {
    return { ok: false, reason: 'Not authenticated.', status: 401 };
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return { ok: false, reason: 'Insufficient permissions.', status: 403 };
  }

  try {
    await connectDb();
    const user = await User.findById(session.sub).exec();
    if (!user || !user.isActive) {
      return { ok: false, reason: 'Account is inactive.', status: 403 };
    }
    return { ok: true, session, user };
  } catch {
    return { ok: false, reason: 'Could not verify account.', status: 503 };
  }
}

/** Constant-time compare for internal API-key auth (webhooks, internal jobs). */
export function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a ?? '', 'utf8');
  const bb = Buffer.from(b ?? '', 'utf8');
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export interface LoginOutcome {
  ok: boolean;
  message: string;
  user?: UserDoc;
}

/** Password login with progressive lockout on repeated failures. */
export async function attemptLogin(email: string, password: string): Promise<LoginOutcome> {
  await connectDb();
  const user = await User.findOne({ email: email.toLowerCase().trim() }).exec();

  // Always run a comparison so response timing does not reveal account
  // existence. Uses a dummy hash when the user does not exist.
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const matches = await verifyPassword(password, hash);

  if (!user) {
    return { ok: false, message: 'Invalid email or password.' };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, message: `Too many failed attempts. Try again in ${mins} minute(s).` };
  }

  if (!user.isActive) {
    return { ok: false, message: 'This account has been deactivated.' };
  }

  if (!matches) {
    user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    return { ok: false, message: 'Invalid email or password.' };
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  return { ok: true, message: 'Signed in.', user };
}
