/**
 * Create or update a staff account.
 *
 * Run with:
 *   npm run seed:admin -- --email you@example.com --name "Your Name"
 *   npm run seed:admin -- --email you@example.com --role EDITOR --password "..."
 *
 * Options:
 *   --email     required
 *   --name      required (defaults to the email local part)
 *   --role      ADMIN | EDITOR | SUPPORT   (default: ADMIN)
 *   --password  at least 10 chars with upper, lower and a digit.
 *               Falls back to ADMIN_PASSWORD, then prompts on the TTY.
 *   --reset     change the role/name of an existing account without a password
 *
 * Safe to re-run: an existing email is updated rather than duplicated.
 */

import { loadEnv, requireEnv } from './env-boot';
import { connectDb, disconnectDb } from '@/lib/db';
import { User, USER_ROLES, type UserRole } from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';
import { userPasswordResetSchema } from '@/lib/validation';

/** Same rule the admin panel enforces, so a script cannot create a weaker account. */
function validatePassword(password: string): string | null {
  const parsed = userPasswordResetSchema.safeParse({ password });
  if (parsed.success) return null;
  const first = parsed.error.issues[0];
  return first ? first.message : 'Password does not meet the requirements.';
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/** Hidden prompt so a password never lands in shell history. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('No TTY available. Pass --password instead.'));
      return;
    }
    process.stdout.write(question);
    const wasRaw = stdin.isRaw ?? false;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (char: string) => {
      if (char === '\u0003' || char === '\u0004') {
        cleanup();
        reject(new Error('Cancelled.'));
        return;
      }
      if (char === '\r' || char === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (char === '\u007F' || char === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
    };

    stdin.on('data', onData);
  });
}

async function main() {
  loadEnv();

  const args = parseArgs(process.argv.slice(2));

  const email =
    (typeof args.email === 'string' ? args.email : (process.env.ADMIN_EMAIL ?? '').trim()).toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error(
      'An email address is required.\n\n  npm run seed:admin -- --email you@example.com',
    );
  }

  const roleRaw = typeof args.role === 'string' ? args.role.toUpperCase() : 'ADMIN';
  if (!USER_ROLES.includes(roleRaw as UserRole)) {
    throw new Error(`Role must be one of: ${USER_ROLES.join(', ')}`);
  }
  const role = roleRaw as UserRole;

  const name =
    (typeof args.name === 'string' ? args.name.trim() : '') || email.split('@')[0].replace(/[._-]+/g, ' ');

  requireEnv('MONGODB_URI');
  await connectDb();

  const existing = await User.findOne({ email }).exec();
  const resetOnly = args.reset === true || (existing && typeof args.password !== 'string');

  if (resetOnly && existing) {
    existing.name = name;
    existing.role = role;
    await existing.save();
    console.log(`Updated existing account ${email} → role ${role}. Password unchanged.`);
    await disconnectDb();
    return;
  }

  let password = typeof args.password === 'string' ? args.password : (process.env.ADMIN_PASSWORD ?? '').trim();
  if (!password) {
    password = await promptHidden(`Password for ${email}: `);
  }

  const problem = validatePassword(password);
  if (problem) {
    throw new Error(`Password rejected: ${problem}`);
  }

  const passwordHash = await hashPassword(password);

  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.passwordHash = passwordHash;
    existing.isActive = true;
    existing.failedLoginAttempts = 0;
    existing.lockedUntil = null;
    await existing.save();
    console.log(`Password reset for ${email} (role ${role}).`);
  } else {
    await User.create({ name, email, role, passwordHash, isActive: true });
    console.log(`Created ${role} account: ${email}`);
  }

  console.log(`\nSign in at /admin/login with ${email}.`);

  await disconnectDb();
}

main().catch(async (err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  await disconnectDb().catch(() => undefined);
  process.exitCode = 1;
});