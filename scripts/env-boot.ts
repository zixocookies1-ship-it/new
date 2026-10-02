/**
 * `.env` loader for the maintenance scripts.
 *
 * `next dev` / `next build` load `.env*` automatically; `tsx` does not. This
 * module reproduces enough of Next's behaviour (same file precedence, never
 * overwriting a variable that is already set) that a script and the running app
 * always see the same configuration.
 *
 * Imported for its side effect *first* in every script, before anything that
 * reads `process.env`.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

/** Highest precedence first — same ordering Next uses. */
function candidateFiles(): string[] {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return [
    '.env.development.local',
    '.env.local',
    '.env.development',
    '.env',
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
  ]
    .map((f) => join(ROOT, f))
    .filter((p) => existsSync(p));
}

/** Minimal dotenv parser: KEY=value, optional quotes, `#` comments, `export ` prefix. */
function parse(contents: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(key)) continue;

    let value = withoutExport.slice(eq + 1).trim();

    // Strip a trailing unquoted comment.
    if (!/^["'`]/.test(value)) {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trim();
    }

    // Unwrap quoted values and unescape `\n` inside double quotes.
    const quote = value[0];
    if ((quote === '"' || quote === "'" || quote === '`') && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    }

    out[key] = value;
  }

  return out;
}

/** Guards against re-reading the files; `applied` is the shared result. */
let loaded = false;
const applied: string[] = [];

/** Read every candidate file once, lowest precedence first, into `process.env`. */
export function loadEnv(): string[] {
  if (loaded) return applied;
  loaded = true;

  for (const file of candidateFiles()) {
    const parsed = parse(readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      // Already-set variables win, so `MONGODB_URI=... npm run seed` overrides the file.
      if (process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = value;
        applied.push(key);
      }
    }
  }
  return applied;
}

/**
 * Variables populated on import.
 *
 * This call sits at *module evaluation* time, deliberately. `src/lib/env.ts`
 * snapshots `process.env` into a frozen `serverEnv` object the moment it is
 * imported, so the `.env` files must be read before any module that imports it.
 * Because imports are evaluated in source order and this module is always
 * imported first, doing the work here — not inside `main()` — is what guarantees
 * ordering.
 */
export const appliedEnvKeys: string[] = loadEnv();

/** Fail loudly with a useful message instead of a bare Mongo timeout. */
export function requireEnv(key: string): string {
  const value = (process.env[key] ?? '').trim();
  if (!value) {
    throw new Error(
      `${key} is not set.\n\n` +
        `Copy .env.example to .env.local, fill in ${key}, then re-run from the project root.`,
    );
  }
  return value;
}