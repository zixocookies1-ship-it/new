import { attemptLogin, setSessionCookie, getSession, clearSessionCookie } from '@/lib/auth';
import { ok, fail, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validation';
import { integrationState } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('admin:login', RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    if (integrationState('auth') !== 'configured') {
      return fail('Admin login is disabled because AUTH_SECRET is not configured.', {
        status: 503,
        code: 'AUTH_NOT_CONFIGURED',
      });
    }

    const { email, password } = loginSchema.parse(await req.json());
    const result = await attemptLogin(email, password);

    if (!result.ok || !result.user) {
      return fail(result.message, { status: 401, code: 'INVALID_CREDENTIALS' });
    }

    await setSessionCookie({
      sub: String(result.user._id),
      email: result.user.email,
      role: result.user.role,
      name: result.user.name,
    });

    return ok(
      {
        user: {
          id: String(result.user._id),
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        },
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Session probe used by the admin shell to decide what to render. */
export async function GET() {
  try {
    const session = await getSession();
    return ok({ authenticated: Boolean(session), user: session ?? null }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE() {
  try {
    await clearSessionCookie();
    return ok({ signedOut: true }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}