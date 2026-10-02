import Link from 'next/link';
import { OptimizedImage } from '@/components/media/OptimizedImage';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';
import { Reveal } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { ProductVM } from '@/lib/catalog';
import type { StoreCapabilities } from '@/lib/integrations';
import type { ContentDoc } from '@/lib/models/Content';
import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';
import { formatINR } from '@/lib/money';

/**
 * Section 1 — Hero.
 *
 * Everything on this section is either brand copy from `Content` or a live
 * database value. There are no invented badges, ratings or claims, and the
 * secondary proof line only states capabilities the server has confirmed.
 */
export function Hero({
  content,
  settings,
  capabilities,
  featured,
}: {
  content: ContentDoc | null;
  settings: BusinessSettingsDoc;
  capabilities: StoreCapabilities;
  featured: ProductVM | null;
}) {
  const title = content?.title?.trim() || settings.tagline?.trim() || 'The New Age of Indian Jaggery';
  const eyebrow = content?.eyebrow?.trim() || '';
  const body = content?.body?.trim() || settings.description?.trim() || '';

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

      <div className="nc-container relative grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
        <div>
          {eyebrow ? (
            <Reveal>
              <p className="nc-eyebrow mb-4">{eyebrow}</p>
            </Reveal>
          ) : null}

          <Reveal delay={60}>
            <h1 id="hero-heading" className="nc-h1">
              {title}
            </h1>
          </Reveal>

          <Reveal delay={120}>
            {body ? (
              <p className="nc-lede mt-5 max-w-xl">{body}</p>
            ) : (
              <div className="mt-5">
                <PlaceholderNote label="Hero description — being finalised by the team." />
              </div>
            )}
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/shop" variant="accent" className="sm:w-auto">
                Shop all flavours
              </ButtonLink>
              <ButtonLink href="/why-natures-choice" variant="outline">
                Why Nature’s Choice
              </ButtonLink>
            </div>
          </Reveal>

          {proofs.length > 0 ? (
            <Reveal delay={240}>
              <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-ink-muted">
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
          ) : null}
        </div>

        <Reveal delay={140} className="relative">
          <div className="relative mx-auto max-w-[34rem]">
            <div className="overflow-hidden rounded-[2rem] border border-cream-300/80 bg-white shadow-card">
              <OptimizedImage
                media={featured?.primaryImage ?? content?.images?.[0] ?? null}
                alt={
                  featured?.primaryImage?.alt ||
                  content?.images?.[0]?.alt ||
                  `${featured?.name ?? 'Nature’s Choice'} jaggery pack`
                }
                aspect="4/5"
                fit="contain"
                sizes="(min-width: 1024px) 46vw, 92vw"
                priority
                maxWidth={1400}
                background="#FFFFFF"
              />
            </div>

            {featured && featured.pricePaise > 0 ? (
              <div className="absolute -bottom-4 left-1/2 w-[min(92%,20rem)] -translate-x-1/2 rounded-card border border-cream-300 bg-white/95 p-4 shadow-card-hover backdrop-blur">
                <p className="font-display text-[0.9375rem] text-jaggery-500">{featured.name}</p>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <Link
                    href={`/products/${featured.slug}`}
                    className="text-sm font-semibold text-ginger-600 underline underline-offset-4 decoration-ginger-200 hover:decoration-ginger-500"
                  >
                    {featured.variants.length > 1
                      ? `From ${formatINR(featured.pricePaise)}`
                      : 'View details'}
                  </Link>
                  <span className="text-xs text-ink-muted">
                    {featured.variants.map((v) => v.weightLabel).join(' · ')}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}