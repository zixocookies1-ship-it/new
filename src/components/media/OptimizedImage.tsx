import Image from 'next/image';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import type { MediaRef } from '@/lib/types';

interface OptimizedImageProps {
  media?: MediaRef | null;
  /** Plain URL fallback (e.g. an order line's stored imageUrl). */
  src?: string | null;
  alt: string;
  /** Intrinsic aspect ratio, e.g. "4/5" for pack shots, "16/9" for lifestyle. */
  aspect?: string;
  /**
   * `contain` keeps packaging fully visible and undistorted — the default for
   * anything that is a product pack shot. `cover` is for lifestyle/process
   * photography where a crop is acceptable.
   */
  fit?: 'contain' | 'cover';
  sizes: string;
  /** Above-the-fold images load eagerly; everything else lazily. */
  priority?: boolean;
  /** Cap the rendered width so the CDN never sends a larger asset than needed. */
  maxWidth?: number;
  className?: string;
  imgClassName?: string;
  /** Solid background behind a contained image. */
  background?: string;
  draggable?: boolean;
}

/**
 * The single image component for the whole site.
 *
 * Delivery strategy — deliberately two-stage, and cheap:
 *  1. Cloudinary serves the *source* at a generous width, `f_auto` + `q_auto`,
 *     capped with `c_limit` so the intrinsic aspect ratio (and therefore the
 *     packaging proportions) is never altered.
 *  2. `next/image` then generates the responsive `srcset` from that source,
 *     negotiates AVIF/WebP, and lazy-loads everything below the fold.
 *
 * This avoids double resizing while still giving correct `sizes`-based
 * selection, and it means a 390px phone never downloads a 2400px hero.
 */
export function OptimizedImage({
  media,
  src,
  alt,
  aspect = '4/5',
  fit = 'contain',
  sizes,
  priority = false,
  maxWidth = 2000,
  className = '',
  imgClassName = '',
  background,
  draggable = false,
}: OptimizedImageProps) {
  const publicId = media?.publicId;
  const rawUrl = media?.url ?? src ?? null;

  if (!publicId && !rawUrl) {
    return <ImageFallback alt={alt} aspect={aspect} className={className} />;
  }

  const source = publicId
    ? cloudinaryUrl(publicId, {
        width: maxWidth,
        crop: 'limit',
        quality: 'auto:good',
        format: 'auto',
      })
    : rawUrl!;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: aspect,
        ...(background ? { backgroundColor: background } : {}),
      }}
    >
      <Image
        src={source}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        draggable={draggable}
        className={`${fit === 'cover' ? 'object-cover' : 'object-contain'} ${imgClassName}`}
        style={fit === 'contain' ? { padding: '2.5%' } : undefined}
      />
    </div>
  );
}

/**
 * Rendered when an asset is genuinely missing. A clean branded tile is better
 * than a broken image, and it is honest — we never substitute stock photography
 * for the brand's real product.
 */
export function ImageFallback({
  alt,
  aspect = '4/5',
  className = '',
  label,
}: {
  alt: string;
  aspect?: string;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${alt} — image not yet available`}
      className={`relative flex items-center justify-center overflow-hidden bg-cream-200/70 ${className}`}
      style={{ aspectRatio: aspect }}
    >
      <div className="pointer-events-none absolute inset-0 nc-texture" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        <svg
          viewBox="0 0 48 48"
          className="h-9 w-9 text-ginger-400/70"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M14 20h20l-1.6 18.4a2 2 0 0 1-2 1.6H17.6a2 2 0 0 1-2-1.6L14 20Z" />
          <path d="M19 20v-3.2a5 5 0 0 1 10 0V20" strokeLinecap="round" />
        </svg>
        <span className="text-2xs font-medium uppercase tracking-eyebrow text-ink-faint">
          {label ?? 'Image coming soon'}
        </span>
      </div>
    </div>
  );
}
