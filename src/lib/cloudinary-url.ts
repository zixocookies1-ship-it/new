/**
 * Client-safe Cloudinary URL builder.
 *
 * Every image on the site is delivered through this helper so that:
 *  - `f_auto` negotiates AVIF → WebP → original per browser
 *  - `q_auto` applies Cloudinary's per-image quality optimisation
 *  - `dpr_auto` doubles density only where the screen needs it
 *  - cropping uses `fit` + `gravity: auto` (Cloudinary's content-aware
 *    cropping) for lifestyle/process shots, and `fit` with no crop at all for
 *    packaging so jars and pouches are never distorted or cut off
 *
 * This file must stay free of `server-only` and secrets: it is imported by
 * server components and client components alike.
 */

export type CropMode = 'contain' | 'cover' | 'limit' | 'none';

export interface BuildUrlOptions {
  width?: number;
  height?: number;
  crop?: CropMode;
  gravity?: 'auto' | 'center' | 'faces';
  quality?: 'auto' | 'auto:good' | 'auto:best' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  dpr?: 'auto' | 1 | 2 | 3;
  blur?: number;
  background?: string;
}

const CLOUDINARY_HOST_RE = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\//;

function ensureTransform(publicId: string, transforms: string[]): string | null {
  if (!publicId || publicId.includes('..')) return null;
  return transforms.length ? `${transforms.join(',')}/${publicId}` : publicId;
}

/** Build an optimised delivery URL from a publicId. */
export function cloudinaryUrl(publicId: string | undefined | null, o: BuildUrlOptions = {}): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
  if (!publicId || !cloudName) return '';

  const t: string[] = ['f_' + (o.format ?? 'auto'), 'q_' + (o.quality ?? 'auto')];

  if (o.blur) t.push(`e_blur:${o.blur}`);

  if (o.dpr) t.push(`dpr_${o.dpr}`);

  if (o.width && o.height) {
    const crop = o.crop ?? 'cover';
    t.push(`w_${Math.round(o.width)}`, `h_${Math.round(o.height)}`, `c_${crop}`);
    if (crop === 'cover') t.push(`g_${o.gravity ?? 'auto'}`);
    if (o.background) t.push(`b_${o.background}`);
  } else if (o.width) {
    t.push(`w_${Math.round(o.width)}`);
  } else if (o.height) {
    t.push(`h_${Math.round(o.height)}`);
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/${ensureTransform(publicId, t)}`;
}

/**
 * Rewrite a stored Cloudinary delivery URL with new transformations.
 * Falls back to the input unchanged for non-Cloudinary URLs.
 */
export function optimiseStoredUrl(url: string, o: BuildUrlOptions = {}): string {
  if (!url) return '';
  const m = CLOUDINARY_HOST_RE.exec(url);
  if (!m) return url;

  const rest = url.slice(m[0].length);
  // Drop any transformations already baked into the stored URL.
  const publicId = rest.replace(/^v\d+\//, '');

  const t: string[] = ['f_' + (o.format ?? 'auto'), 'q_' + (o.quality ?? 'auto')];
  if (o.blur) t.push(`e_blur:${o.blur}`);
  if (o.width && o.height) {
    const crop = o.crop ?? 'cover';
    t.push(`w_${Math.round(o.width)}`, `h_${Math.round(o.height)}`, `c_${crop}`);
    if (crop === 'cover') t.push(`g_${o.gravity ?? 'auto'}`);
  } else if (o.width) {
    t.push(`w_${Math.round(o.width)}`);
  }

  return `https://res.cloudinary.com/${m[1]}/image/upload/${ensureTransform(publicId, t)}`;
}

/**
 * Responsive `srcSet` for a Cloudinary asset.
 * Widths are the device breakpoints we actually render at, so the browser
 * never downloads a 2400px hero on a 390px phone.
 */
export function cloudinarySrcSet(
  publicId: string | undefined | null,
  widths: number[],
  o: BuildUrlOptions = {},
): string | undefined {
  if (!publicId) return undefined;
  const parts = widths
    .filter((w) => w > 0)
    .map((w) => `${cloudinaryUrl(publicId, { ...o, width: w, dpr: 'auto' })} ${w}w`);
  return parts.length ? parts.join(', ') : undefined;
}

/** Tiny LQIP for blur-up placeholders. */
export function cloudinaryPlaceholder(publicId: string | undefined | null): string | undefined {
  return publicId
    ? cloudinaryUrl(publicId, { width: 24, quality: 30, crop: 'cover', format: 'auto' })
    : undefined;
}

export function isCloudinaryUrl(url: string | undefined | null): boolean {
  return Boolean(url && CLOUDINARY_HOST_RE.test(url));
}
