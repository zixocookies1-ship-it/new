/**
 * Fetch the real product photography into `public/media/products/`.
 *
 * Cloudinary is not configured for this deployment, so instead of hotlinking
 * `m.media-amazon.com` (which Amazon can throttle or block at any time) the
 * source images are pulled once and served from the app's own origin through
 * `next/image`.
 *
 * Each file lands at a stable, human-readable name and a manifest is written to
 * `scripts/product-images.json` for the seed to read. Re-running skips files
 * that already exist, so the script is safe to repeat.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/fetch-product-images.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface SourceImage {
  /** Amazon image id, e.g. `51XBEBt97oL`. */
  id: string;
  /** Position in the gallery; 1 is the primary pack shot. */
  order: number;
  role: 'front_pack' | 'gallery';
  alt: string;
}

interface ManifestEntry {
  publicId: string;
  url: string;
  width: number;
  height: number;
  order: number;
  role: string;
  alt: string;
}

const OUT_DIR = join(process.cwd(), 'public', 'media', 'products');
const MANIFEST = join(process.cwd(), 'scripts', 'product-images.json');

/** Longest-edge cap. Wide enough for a 1200px hero, small enough to stay fast. */
const LONG_EDGE = 1500;

/**
 * Gallery order as published on the Amazon listing.
 * The first entry is the pack shot the listing leads with.
 */
const SOURCES: Record<string, SourceImage[]> = {
  'desi-chocolatey-jaggery': [
    { id: '71XNT8BbzTL', order: 1, role: 'front_pack', alt: "Nature's Choice Desi Chocolatey Gud — 500 g jar" },
    { id: '41N+LzE5viL', order: 2, role: 'gallery', alt: 'Desi Chocolatey Gud, 500 g pack' },
    { id: '51HkkYC985L', order: 3, role: 'gallery', alt: 'Desi Chocolatey Gud — close-up of the jaggery block' },
    { id: '51aZp9mLPAL', order: 4, role: 'gallery', alt: 'Desi Chocolatey Gud — pack and contents' },
    { id: '416b2KcnP4L', order: 5, role: 'gallery', alt: 'Desi Chocolatey Gud — serving suggestion' },
    { id: '41X62GFeg8L', order: 6, role: 'gallery', alt: 'Desi Chocolatey Gud — pack detail' },
    { id: '412JnqRI0QL', order: 7, role: 'gallery', alt: 'Desi Chocolatey Gud — back of pack' },
  ],
  'desi-til-chocolatey-jaggery': [
    { id: '51XBEBt97oL', order: 1, role: 'front_pack', alt: "Nature's Choice Desi Til Chocolatey Gud — 500 g jar" },
    { id: '416xlYblGFL', order: 2, role: 'gallery', alt: 'Desi Til Chocolatey Gud, 500 g pack' },
    { id: '41cAIWpnLGL', order: 3, role: 'gallery', alt: 'Desi Til Chocolatey Gud — close-up of the jaggery block' },
    { id: '41D7VACV4cL', order: 4, role: 'gallery', alt: 'Desi Til Chocolatey Gud — pack and contents' },
    { id: '41RAtUghWvL', order: 5, role: 'gallery', alt: 'Desi Til Chocolatey Gud — serving suggestion' },
    { id: '410e3fvmidL', order: 6, role: 'gallery', alt: 'Desi Til Chocolatey Gud — pack detail' },
    { id: '51fWGKsldwL', order: 7, role: 'gallery', alt: 'Desi Til Chocolatey Gud — back of pack' },
  ],
};

function fileName(slug: string, order: number, id: string): string {
  return `${slug}-${String(order).padStart(2, '0')}-${id.replace(/[^A-Za-z0-9]/g, '')}.jpg`;
}

/** Read intrinsic size out of a JPEG's SOF marker — no image library needed. */
function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1]!;
    // SOF0..SOF15, skipping the non-frame markers DHT/JPG/DAC.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

async function download(url: string, attempts = 3): Promise<Buffer> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          // Amazon's CDN returns 503 to clients with no UA.
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          accept: 'image/avif,image/webp,image/jpeg,*/*',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) throw new Error(`suspiciously small (${buf.length} bytes)`);
      return buf;
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  throw lastErr;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest: Record<string, ManifestEntry[]> = {};

  for (const [slug, images] of Object.entries(SOURCES)) {
    manifest[slug] = [];
    console.log(`\n${slug}`);

    for (const img of images) {
      const name = fileName(slug, img.order, img.id);
      const path = join(OUT_DIR, name);

      let buf: Buffer;
      if (existsSync(path)) {
        buf = readFileSync(path);
        console.log(`  = ${name} (cached, ${(buf.length / 1024).toFixed(0)} kB)`);
      } else {
        // `_SL<n>_` caps the longest edge and leaves the aspect ratio intact,
        // so packaging proportions are preserved exactly.
        const url = `https://m.media-amazon.com/images/I/${img.id}._SL${LONG_EDGE}_.jpg`;
        buf = await download(url);
        writeFileSync(path, buf);
        console.log(`  + ${name} (${(buf.length / 1024).toFixed(0)} kB)`);
      }

      const size = jpegSize(buf);
      if (!size) throw new Error(`Could not read JPEG dimensions for ${name}`);

      manifest[slug]!.push({
        // Local assets have no Cloudinary id. An empty `publicId` makes
        // `OptimizedImage` fall through to the stored `url`, which is the
        // supported path for non-CDN media.
        publicId: '',
        url: `/media/products/${name}`,
        width: size.width,
        height: size.height,
        order: img.order,
        role: img.role,
        alt: img.alt,
      });
    }

    const first = manifest[slug]![0]!;
    console.log(`  primary: ${first.width}x${first.height}`);
  }

  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${MANIFEST}`);
}

main().catch((err: unknown) => {
  console.error('\nImage fetch failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});