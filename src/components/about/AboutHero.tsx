import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * About page — hero.
 *
 * Small label, one editorial headline, a warm supporting line, and the
 * client-supplied brand banner as the visual. Nothing here is cropped
 * or stretched: the banner renders at its own 2:1 ratio.
 */
const HERO_IMAGE = '/media/hero-banner.png';

export function AboutHero({ content }: { content: ContentDoc | null }) {
  const title = content?.title?.trim() || 'A sweeter way to choose better.';
  const body =
    content?.body?.trim() ||
    'A modern take on a familiar Indian favourite — desi jaggery with a slow, chocolatey finish, combined with distinctive flavours for the modern Indian home.';

  return (
    <section className="relative overflow-hidden bg-cream-100" aria-labelledby="about-heading">
      <div className="pointer-events-none absolute inset-0 nc-texture" aria-hidden="true" />

      {/* Soft brand washes — ginger and green, kept apart so neither dominates. */}
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-[26rem] w-[26rem] rounded-full bg-ginger-100/50 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 h-[22rem] w-[22rem] rounded-full bg-leaf-100/50 blur-3xl"
        aria-hidden="true"
      />

      <div className="nc-container relative pb-10 pt-12 text-center sm:pb-12 sm:pt-16">
        <Reveal>
          <p className="nc-eyebrow mb-4">About Nature’s Choice</p>
        </Reveal>

        <Reveal delay={60}>
          <h1 id="about-heading" className="nc-h1 mx-auto max-w-3xl text-balance">
            {title}
          </h1>
        </Reveal>

        <Reveal delay={120}>
          <p className="nc-lede mx-auto mt-5 max-w-xl">{body}</p>
        </Reveal>
      </div>

      <Reveal delay={160} className="nc-container relative pb-14 sm:pb-20">
        <div className="overflow-hidden rounded-[1.75rem] border border-cream-300/70 bg-white shadow-card">
          <OptimizedImage
            src={HERO_IMAGE}
            alt="Nature’s Choice chocolatey jaggery — the classic, til and elaichi jars"
            aspect="2/1"
            fit="contain"
            sizes="(min-width: 1280px) 1216px, 92vw"
            priority
            maxWidth={1427}
            background="#FFFFFF"
            className="w-full"
          />
        </div>
      </Reveal>
    </section>
  );
}
