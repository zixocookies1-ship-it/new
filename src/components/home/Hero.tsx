import { OptimizedImage } from '@/components/media/OptimizedImage';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';
import { Reveal } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { ProductVM } from '@/lib/catalog';
import type { ContentDoc } from '@/lib/models/Content';
import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';

/**
 * Client-supplied hero banner. Full-bleed, intrinsic 2:1 (955 x 477).
 * Filename is URL-safe (no spaces) so `next/image` can resolve it directly.
 */
const HERO_BANNER = '/media/hero-banner.png';

/**
 * Section 1 — Hero.
 *
 * The client-supplied banner is the hero: it is rendered edge-to-edge across
 * the full width of the viewport at its own 2:1 ratio, so nothing is cropped or
 * stretched. The copy and the calls to action sit above and below it rather
 * than on top of it, which keeps the product packaging unobstructed.
 *
 * Everything on this section is either brand copy from `Content` or a live
 * database value. There are no invented badges, ratings or claims, and the
 * proof line only states capabilities the server has confirmed.
 */
export function Hero({
  content,
  settings,
  capabilities,
  featured,
}: {
  content: ContentDoc | null;
  settings: BusinessSettingsDoc;
  capabilities: Record<string, boolean>;
  featured: ProductVM | null;
}) {
  const title = content?.title?.trim() || 'A sweeter way to choose better.';
  const eyebrow = content?.eyebrow?.trim() || '';
  const body =
    content?.body?.trim() ||
    'Pure jaggery. A chocolatey twist. Made for the modern Indian home.';

  // Proof points are *capability* statements, verified server-side at render time.
  const proofs: string[] = [];
  if (capabilities.onlinePayments) proofs.push('Secure online payment');
  if (capabilities.cod) proofs.push('Cash on delivery available');
  if (featured?.rating.count) {
    proofs.push(`${featured.rating.average.toFixed(1)}/5 from ${featured.rating.count} reviews`);
  }

  return (
    <section className="relative overflow-hidden bg-cream-100" aria-labelledby="hero-heading">
      <div className="pointer-events-none absolute inset-0 nc-texture" aria-hidden="true" />

      {/* Soft brand washes — ginger and green, kept far apart so neither dominates. */}
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-[26rem] w-[26rem] rounded-full bg-ginger-100/50 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 h-[22rem] w-[22rem] rounded-full bg-leaf-100/50 blur-3xl"
        aria-hidden="true"
      />

      {/* ---------------------------------------------------------------- */}
      {/* Copy — centred, sits above the banner                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="nc-container relative pt-10 pb-8 text-center sm:pt-14 sm:pb-10">
        {eyebrow ? (
          <Reveal>
            <p className="nc-eyebrow mb-4">{eyebrow}</p>
          </Reveal>
        ) : null}

        <Reveal delay={60}>
          <h1 id="hero-heading" className="nc-h1 mx-auto max-w-3xl text-balance">
            {title}
          </h1>
        </Reveal>

        <Reveal delay={120}>
          <div className="mx-auto mt-5 max-w-xl">
            {body ? (
              <p className="nc-lede">{body}</p>
            ) : (
              <PlaceholderNote label="Hero description — being finalised by the team." />
            )}
          </div>
        </Reveal>

        <Reveal delay={180}>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/shop" variant="accent" className="w-full sm:w-auto">
              Shop chocolatey jaggery
            </ButtonLink>
            <ButtonLink href="/shop#flavours" variant="outline" className="w-full sm:w-auto">
              Explore our flavours
            </ButtonLink>
          </div>
        </Reveal>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Banner — full-bleed, spans the complete screen width           */}
      {/* ---------------------------------------------------------------- */}
      <Reveal delay={140} className="relative">
        <div className="relative w-full bg-cream-50">
          <OptimizedImage
            src={HERO_BANNER}
            alt={
              content?.images?.[0]?.alt ||
              `${featured?.name ?? "Nature's Choice"} chocolatey jaggery — classic, til and elaichi`
            }
            aspect="2/1"
            fit="contain"
            sizes="100vw"
            priority
            maxWidth={955}
            background="#FFFFFF"
            className="w-full"
          />
        </div>
      </Reveal>

      {/* ---------------------------------------------------------------- */}
      {/* Proof line — capability statements only, verified server-side     */}
      {/* ---------------------------------------------------------------- */}
      {proofs.length > 0 ? (
        <div className="nc-container relative pb-12 pt-8 sm:pb-16 sm:pt-10">
          <Reveal delay={200}>
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.8125rem] text-ink-muted">
              {proofs.map((p) => (
                <li key={p} className="inline-flex items-center gap-1.5">
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4 text-leaf-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M4.5 10.5 8 14l7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      ) : null}
    </section>
  );
}
