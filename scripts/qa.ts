/**
 * Storefront QA sweep.
 *
 * Hits every public route plus the read-only public API endpoints and reports
 * status, title, canonical, OG tags and obvious markers (unrendered templates,
 * "undefined" leaks, stack traces). Run against a live dev/prod server:
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/qa.ts [baseUrl]
 *
 * Exit code 1 if any route fails or any marker is found.
 */

import { loadEnv } from './env-boot';

loadEnv();

const BASE = process.argv[2] || 'http://localhost:3000';

const PAGES: Array<{ path: string; expect?: number; note?: string }> = [
  { path: '/' },
  { path: '/shop' },
  { path: '/shop?q=jaggery' },
  { path: '/products/desi-chocolatey-jaggery' },
  { path: '/products/desi-til-chocolatey-jaggery' },
  { path: '/products/desi-elaichi-chocolatey-jaggery' },
  { path: '/about' },
  { path: '/contact' },
  { path: '/cart' },
  { path: '/checkout' },
  { path: '/sitemap.xml', note: 'sitemap' },
  { path: '/robots.txt', note: 'robots' },
  { path: '/favicon.ico' },
  { path: '/icon.svg' },
  { path: '/opengraph-image' },
  { path: '/this-route-should-not-exist', expect: 404 },
  { path: '/products/not-a-real-product', expect: 404 },
];

const API_GETS = [
  '/api/products',
  '/api/products/search?q=elaichi',
  '/api/track',
  '/api/reviews',
  '/api/serviceability?pincode=560001',
  '/api/admin/overview',
  '/api/admin/products',
];

const MARKERS = [
  /\$\{\s*pageProps/, // unrendered JSX
  /undefined undefined/,
  /Cannot read properties of (undefined|null)/,
  /at Object\.<anonymous> \(/,
  /Application error: a (client|server)-side/,
];

/**
 * Strip `<script>`/`<style>` bodies before scanning.
 *
 * Next inlines React and its Node polyfills into the HTML, and those bundles
 * legitimately contain the strings `NaN` and `undefined` in their source. Only
 * the rendered document is ours to judge.
 */
function renderedText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
}

function pick(html: string, re: RegExp): string | null {
  return html.match(re)?.[1] ?? null;
}

function findMarkers(html: string): string[] {
  const text = renderedText(html);
  const found: string[] = [];
  for (const m of MARKERS) if (m.test(text)) found.push(m.source);

  // Rendered artefacts only: a NaN or "undefined" the shopper can actually see.
  // Built with `new RegExp` from string patterns so that the `</` in a closing
  // tag never has to be escaped inside a regex *literal*.
  const rupee = '\\u20B9'; // ₹
  const tag = '\\s*<'; // \s*<
  const visible = [
    { label: 'rendered NaN', re: new RegExp(`>${tag.replace('<', '<')}(?:${rupee}|Rs\\.?\\s?)?NaN${tag}`) },
    { label: 'rendered undefined', re: new RegExp(`>${tag}(?:${rupee}|Rs\\.?\\s?)?undefined${tag}`) },
    { label: 'rendered [object Object]', re: new RegExp(`>${tag}\\[object Object\\]${tag}`) },
    { label: 'rendered null', re: new RegExp(`>${tag}null${tag}`) },
  ];
  for (const v of visible) if (v.re.test(text)) found.push(v.label);

  return found;
}

interface Row {
  path: string;
  status: number;
  ok: boolean;
  title: string | null;
  canonical: string | null;
  og: string | null;
  desc: string | null;
  notes: string[];
}

async function sweep(): Promise<Row[]> {
  const rows: Row[] = [];

  for (const page of PAGES) {
    const expected = page.expect ?? 200;
    let row: Row = {
      path: page.path,
      status: 0,
      ok: false,
      title: null,
      canonical: null,
      og: null,
      desc: null,
      notes: [],
    };
    try {
      const res = await fetch(`${BASE}${page.path}`, { redirect: 'follow' });
      const body = await res.text();
      row.status = res.status;
      row.ok = res.status === expected;
      if (!row.ok) row.notes.push(`expected ${expected}`);

      const isHtml = (res.headers.get('content-type') ?? '').includes('html');
      if (isHtml) {
        row.title = pick(body, /<title>([^<]*)<\/title>/);
        row.canonical = pick(body, /<link rel="canonical" href="([^"]*)"/);
        row.og = pick(body, /<meta property="og:title" content="([^"]*)"/);
        row.desc = pick(body, /<meta name="description" content="([^"]*)"/);
        row.notes.push(...findMarkers(body));
        if (!row.title) row.notes.push('no <title>');
        if (!row.desc) row.notes.push('no meta description');
        if (res.status === 200 && !row.canonical) row.notes.push('no canonical');
        if (res.status === 404 && (body.includes('data-nf') === false)) {
          // not-found still needs a title; handled by the no-<title> check.
        }
      }
    } catch (err) {
      row.notes.push(`threw: ${err instanceof Error ? err.message : String(err)}`);
    }
    rows.push(row);
  }

  return rows;
}

async function sweepApi(): Promise<Array<{ path: string; status: number; body: string }>> {
  const out: Array<{ path: string; status: number; body: string }> = [];
  for (const p of API_GETS) {
    try {
      const res = await fetch(`${BASE}${p}`);
      const body = await res.text();
      out.push({ path: p, status: res.status, body: body.slice(0, 160) });
    } catch (err) {
      out.push({ path: p, status: 0, body: String(err) });
    }
  }
  return out;
}

async function checkInternalLinks(): Promise<Array<{ href: string; status: number }>> {
  const seen = new Set<string>();
  const targets: string[] = [];

  // Only crawl the homepage's own chrome so the sweep stays fast; the deep
  // per-page link audit is what the `href` sweep in the browser QA does.
  for (const page of PAGES.slice(0, 6)) {
    if (!page.path.startsWith('/') || page.path.includes('.')) continue;
    const res = await fetch(`${BASE}${page.path}`).catch(() => null);
    if (!res) continue;
    const html = await res.text();
    for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      const href = m[1]!;
      if (href.startsWith('/_next') || href.startsWith('/api')) continue;
      if (!seen.has(href)) {
        seen.add(href);
        targets.push(href);
      }
    }
  }

  const results: Array<{ href: string; status: number }> = [];
  // HEAD would be cheaper but Next answers it differently from GET; a real GET
  // is the only honest check for "does this link work".
  for (const href of targets.slice(0, 40)) {
    const res = await fetch(`${BASE}${href}`, { redirect: 'manual' }).catch(() => null);
    results.push({ href, status: res ? res.status : 0 });
  }
  return results;
}

async function main() {
  console.log(`QA sweep against ${BASE}\n`);
  console.log('Pages');
  console.log('-'.repeat(78));

  const rows = await sweep();
  let failures = 0;

  for (const r of rows) {
    const flag = r.ok && r.notes.length === 0 ? 'ok  ' : 'FAIL';
    if (flag === 'FAIL') failures++;
    console.log(`${flag} ${String(r.status).padStart(3)}  ${r.path}`);
    if (r.title) console.log(`       title: ${r.title}`);
    if (r.canonical) console.log(`       canon: ${r.canonical}`);
    if (r.notes.length) console.log(`       ! ${r.notes.join('; ')}`);
  }

  console.log(`\nRead-only API endpoints (status, first bytes)`);
  console.log('-'.repeat(78));
  for (const a of await sweepApi()) {
    console.log(`${a.status === 200 || a.status === 401 || a.status === 400 ? 'ok  ' : 'note'} ${a.status}  ${a.path}`);
    console.log(`       ${a.body.replace(/\s+/g, ' ')}`);
  }

  console.log(`\nInternal links discovered`);
  console.log('-'.repeat(78));
  const links = await checkInternalLinks();
  const broken = links.filter((l) => l.status >= 400);
  console.log(`checked ${links.length} unique internal link(s); ${broken.length} broken`);
  for (const b of broken) console.log(`FAIL ${b.status}  ${b.href}`);
  failures += broken.length;

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} PROBLEM(S)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});