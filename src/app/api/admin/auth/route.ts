import { NextResponse } from 'next/server';
import { setSessionCookie, clearSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/auth – Admin login.
 *
 * Expects JSON body: { email, password }
 * On success: sets httpOnly session cookie and returns { ok: true }
 * On failure: returns { ok: false, error: 'Invalid credentials' }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Email and password are required' },
        { status: 400 },
      );
    }

    // TODO: Replace with actual database lookup + bcrypt compare
    // For now, accept any non-empty credentials as a demo
    // In production, this should query the User model and verify password
    if (email.trim() && password.trim()) {
      const session = {
        id: 'admin-session-' + Date.now(),
        email,
        name: email.split('@')[0],
        role: 'ADMIN' as const,
      };

      await setSessionCookie(session);
      return NextResponse.json({ ok: true, session });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid credentials' },
        { status: 401 },
      );
    }
  } catch (err) {
    console.error('Admin login error:', err);
    return NextResponse.json(
      { ok: false, error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/auth – Admin logout.
 *
 * Clears the httpOnly session cookie and redirects to login.
 */
export async function DELETE(request: Request) {
  try {
    await clearSessionCookie();
    const response = NextResponse.json({ ok: true });
    response.cookies.delete('nc_admin_session');
    return response;
  } catch (err) {
    console.error('Admin logout error:', err);
    return NextResponse.json(
      { ok: false, error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}