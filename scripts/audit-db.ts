/**
 * Static audit: every exported async function that touches a Mongoose model
 * must `await connectDb()` first.
 *
 * With `bufferCommands: false` (see `src/lib/db.ts`) a query issued before the
 * connection is ready throws
 *   "Cannot call `x.find()` before initial connection is complete",
 * which surfaces as a 500 on a cold route. This script catches the gaps that a
 * manual read-through misses.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/audit-db.ts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const MODEL_NAMES = [
  'Product',
  'ProductVariant',
  'Order',
  'User',
  'Review',
  'ContactMessage',
  'Faq',
  'Recipe',
  'Content',
  'Coupon',
  'Bundle',
  'ShippingConfiguration',
  'BusinessSettings',
  'Media',
];

interface Block {
  name: string;
  body: string;
  startLine: number;
}

/** Split a file into top-level function/class-method blocks by brace balance. */
function blocks(source: string): Block[] {
  const lines = source.split(/\r?\n/);
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const fnMatch = line.match(
      /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)|^\s*(?:public\s+|private\s+|static\s+)?(?:async\s+)?([A-Za-z0-9_]+)\s*\(/,
    );
    if (!fnMatch) {
      i++;
      continue;
    }
    const name = fnMatch[1] ?? fnMatch[2] ?? '(anonymous)';
    let depth = 0;
    let started = false;
    const startLine = i + 1;
    const body: string[] = [];
    for (; i < lines.length; i++) {
      const l = lines[i]!;
      body.push(l);
      for (const ch of l) {
        if (ch === '{') {
          depth++;
          started = true;
        } else if (ch === '}') depth--;
      }
      if (started && depth <= 0) break;
      if (!started && l.trim().endsWith(';')) break;
    }
    out.push({ name, body: body.join('\n'), startLine });
    i++;
  }
  return out;
}

const problems: Array<{ file: string; line: number; name: string; models: string[] }> = [];
let audited = 0;

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const rel = file.slice(ROOT.length + 1);

  for (const block of blocks(source)) {
    const used = MODEL_NAMES.filter((m) =>
      new RegExp(`\\b${m}\\.(find|findOne|findOneAndUpdate|findById|findByIdAndUpdate|aggregate|countDocuments|create|insertMany|updateOne|updateMany|deleteOne|deleteMany|exists)\\b`).test(
        block.body,
      ),
    );
    if (!used.length) continue;
    audited++;
    if (/await\s+connectDb\s*\(/.test(block.body)) continue;
    // Inside a route handler / lib function, a caller may already have awaited it.
    // Only flag when the block itself is the entry point.
    problems.push({ file: rel, line: block.startLine, name: block.name, models: used });
  }
}

console.log(`Audited ${audited} model-touching block(s) under src/.`);
if (!problems.length) {
  console.log('All of them await connectDb().');
  process.exit(0);
}

console.log(`\n${problems.length} block(s) do not await connectDb():\n`);
for (const p of problems) {
  console.log(`  ${p.file}:${p.line}  ${p.name}()  → ${p.models.join(', ')}`);
}