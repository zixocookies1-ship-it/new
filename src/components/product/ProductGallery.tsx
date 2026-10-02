'use client';

import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';

import { OptimizedImage } from '@/components/media/OptimizedImage';
import type { MediaRef } from '@/lib/types';

/**
 * Product gallery.
 *
 * Behaviour that matters on a phone:
 *  - horizontal swipe rail with scroll-snap, native momentum
 *  - dot indicator that reflects the real scroll position
 *  - a zoom-on-tap lightbox for reading packaging detail
 *  - packaging is `object-contain` on a cream tile — never cropped, never
 *    stretched, because a jaggery block's proportions are the product
 */
export function ProductGallery({
  images,
  alt,
  className = '',
}: {
  images: MediaRef[];
  alt: string;
  className?: string;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<MediaRef | null>(null);

  const onScroll = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setIndex(Math.min(images.length - 1, Math.max(0, i)));
  }, [images.length]);

  const goTo = useCallback((i: number) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setIndex(i);
  }, []);

  if (!images.length) {
    return (
      <OptimizedImage
        src={null}
        alt={alt}
        aspect="4/5"
        sizes="(min-width: 1024px) 55vw, 100vw"
        className={clsx('rounded-card', className)}
      />
    );
  }

  return (
    <div className={className}>
      <div
        ref={railRef}
        onScroll={onScroll}
        className="nc-snap-rail nc-no-scrollbar -mx-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-5 sm:mx-0 sm:px-0"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${alt} — image gallery`}
      >
        {images.map((img, i) => (
          <button
            key={img.publicId || i}
            type="button"
            onClick={() => setLightbox(img)}
            className="nc-product-media w-full shrink-0 snap-start rounded-card border border-cream-300/70 bg-cream-50"
            aria-label={`View image ${i + 1} of ${images.length} of ${alt}`}
          >
            <OptimizedImage
              media={img}
              alt={img.alt || `${alt} — view ${i + 1}`}
              aspect="4/5"
              fit="contain"
              sizes="(min-width: 1024px) 55vw, 100vw"
              priority={i === 0}
              maxWidth={1600}
            />
          </button>
        ))}
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2" role="tablist" aria-label="Gallery images">
          {images.map((img, i) => (
            <button
              key={img.publicId || i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show image ${i + 1}`}
              onClick={() => goTo(i)}
              className={clsx(
                'h-2 rounded-full transition-all duration-200',
                i === index ? 'w-6 bg-jaggery-500' : 'w-2 bg-cream-400 hover:bg-ginger-300',
              )}
            />
          ))}
        </div>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-jaggery-600/92 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — enlarged image`}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Close image"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <div className="relative max-h-[82vh] w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <OptimizedImage
              media={lightbox}
              alt={lightbox.alt || alt}
              aspect={lightbox.width && lightbox.height ? `${lightbox.width}/${lightbox.height}` : '4/5'}
              fit="contain"
              sizes="100vw"
              maxWidth={2400}
              className="rounded-xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}