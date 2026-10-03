'use server';

import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { NextResponse } from 'next/server';

const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not set in environment variables.');
}

const secret = new TextEncoder().encode(AUTH_SECRET);

export interface AdminSession {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'EDITOR' | 'SUPPORT';
  iat?: number;
  exp?: number;
}

/**
 * Create a signed session cookie for the admin.
 */
export async function setSessionCookie(session: AdminSession) {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const jwt = await new SignJWT({ session })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1y')
    .sign(secret);

  const cookieStore = await cookies();
  const cookieProps: Record<string, unknown> = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  };
  if (process.env.NODE_ENV === 'production') {
    cookieProps.secure = true;
  }
  cookieStore.set('nc_admin_session', jwt, cookieProps as any);
}

/**
 * Retrieve the admin session from the cookie.
 */
export async function getSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get('nc_admin_session')?.value;

    if (!jwt) return null;

    const { payload } = await jwtVerify(jwt, secret, {
      algorithms: ['HS256'],
    });

    return payload.session as AdminSession;
  } catch {
    return null;
  }
}

/**
 * Clear the admin session cookie.
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set('nc_admin_session', '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 0,
  });
}