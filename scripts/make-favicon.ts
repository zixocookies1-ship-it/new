/**
 * Generate the favicon.ico that `src/app/icon.svg` does not cover.
 *
 * Browsers (and every crawler that ignores `<link rel="icon">`) still request
 * `/favicon.ico` directly; answering 404 there is a visible 404 in the server
 * log for every cold visitor.
 *
 * This renders the same stylised jar as `src/app/icon.svg` at 16/32/48 px and
 * packs the three sizes into a real 32-bit ICO. No image library: an ICO with
 * uncompressed BGRA DIB entries is a few dozen lines of byte packing.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/make-favicon.ts
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/* Brand palette — keep in sync with tailwind.config.ts and icon.svg. */
const BROWN = [0x5a, 0x32, 0x1f] as const;
const CREAM = [0xf7, 0xf1, 0xe7] as const;

type Rgb = readonly [number, number, number];

/** Rounded-corner coverage, sampled from the same geometry as icon.svg. */
function roundedRectAlpha(x: number, y: number, size: number, radius: number): number {
  const cx = Math.min(Math.max(x + 0.5, radius), size - radius);
  const cy = Math.min(Math.max(y + 0.5, radius), size - radius);
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  const dist = Math.hypot(dx, dy);
  // 1px feather so small sizes do not look jagged.
  return Math.max(0, Math.min(1, radius + 0.5 - dist));
}

/** Coverage of a thick line segment, used for the jar outline and lid. */
function segmentAlpha(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  halfWidth: number,
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  const cx = x1 + t * vx;
  const cy = y1 + t * vy;
  return Math.max(0, Math.min(1, halfWidth + 0.5 - Math.hypot(px - cx, py - cy)));
}

/**
 * Render the mark at `size`×`size` into straight-alpha RGBA.
 *
 * Layout is expressed in 32-unit space (the viewBox of icon.svg) and scaled, so
 * the 16 px favicon is a genuine reduction of the same drawing rather than a
 * separate approximation.
 */
function render(size: number): Uint8Array {
  const rgba = new Uint8Array(size * size * 4);
  const s = size / 32;
  const radius = 7 * s;
  const half = 0.85 * s; // stroke half-width

  const jarLeft = 11.6;
  const jarRight = 20.4;
  const jarTop = 12.6;
  const jarBottom = 25.3;
  const lidLeft = 10.3;
  const lidRight = 21.7;
  const neckLeft = 13.4;
  const neckRight = 18.6;
  const neckTop = 11.1;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = (x + 0.5) / s;
      const py = (y + 0.5) / s;

      const plate = roundedRectAlpha(x, y, size, radius);

      // Jar body: a translucent cream fill with a cream outline, tapering in
      // slightly at the base exactly like the SVG path.
      const insideJar =
        py >= jarTop &&
        py <= jarBottom &&
        px >= jarLeft + ((jarBottom - py) / (jarBottom - jarTop)) * 0.35 &&
        px <= jarRight - ((jarBottom - py) / (jarBottom - jarTop)) * 0.35;

      const outline = Math.max(
        segmentAlpha(px, py, jarLeft, jarTop, jarRight, jarTop, half),
        segmentAlpha(px, py, jarRight, jarTop, jarRight - 0.35, jarBottom, half),
        segmentAlpha(px, py, jarRight - 0.35, jarBottom, jarLeft + 0.35, jarBottom, half),
        segmentAlpha(px, py, jarLeft + 0.35, jarBottom, jarLeft, jarTop, half),
        segmentAlpha(px, py, lidLeft, jarTop, lidRight, jarTop, half),
        segmentAlpha(px, py, neckLeft, jarTop, neckLeft, neckTop, half),
        segmentAlpha(px, py, neckRight, neckTop, neckRight, jarTop, half),
      );

      // Lid line extends past the jar, so it wins where they overlap.
      const lid = segmentAlpha(px, py, lidLeft, jarTop, lidRight, jarTop, half);

      const cream =
        Math.max(outline, lid) + (insideJar ? 0.22 : 0);
      const creamA = Math.min(1, cream);

      const o = (y * size + x) * 4;
      rgba[o] = Math.round(BROWN[0] * (1 - creamA) + CREAM[0] * creamA);
      rgba[o + 1] = Math.round(BROWN[1] * (1 - creamA) + CREAM[1] * creamA);
      rgba[o + 2] = Math.round(BROWN[2] * (1 - creamA) + CREAM[2] * creamA);
      rgba[o + 3] = Math.round(255 * plate);
    }
  }

  return rgba;
}

/** Pack straight RGBA into a bottom-up BGRA DIB with an AND mask. */
function dib(size: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight (XOR + AND)
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // BI_RGB
  header.writeUInt32LE(size * size * 4, 20); // biSizeImage

  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const src = (y * size + x) * 4;
      const dst = ((size - 1 - y) * size + x) * 4;
      xor[dst] = rgba[src + 2]!; // B
      xor[dst + 1] = rgba[src + 1]!; // G
      xor[dst + 2] = rgba[src]!; // R
      xor[dst + 3] = rgba[src + 3]!; // A
    }
  }

  // 1bpp AND mask, rows padded to 4 bytes, bottom-up.
  const maskStride = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskStride * size);

  return Buffer.concat([header, xor, mask]);
}

function ico(sizes: number[]): Buffer {
  const images = sizes.map((size) => dib(size, render(size)));
  const count = sizes.length;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries: Buffer[] = [];
  images.forEach((img, i) => {
    const e = Buffer.alloc(16);
    e[0] = sizes[i]! >= 256 ? 0 : sizes[i]!;
    e[1] = sizes[i]! >= 256 ? 0 : sizes[i]!;
    e[2] = 0; // palette
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(img.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.length;
    entries.push(e);
  });

  return Buffer.concat([header, ...entries, ...images]);
}

const out = ico([16, 32, 48]);
const path = join(process.cwd(), 'src', 'app', 'favicon.ico');
writeFileSync(path, out);
console.log(`Wrote ${path} (${out.length} bytes, 16/32/48 px)`);