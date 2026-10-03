import { Reveal } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { ALL_ROUTES } from '@/lib/site';

/**
 * About page — closing call to action.
 *
 * One ask, one button, straight to the shop. No countdown,
 * no scarcity language.
 */
export function FinalCtaSection() {
  return (
    <section className="bg-cream-100 pb-16 pt-4 sm:pb-24">
      <div className="nc-container">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-jaggery-500 px-6 py-12 text-center shadow-card sm:px-12 sm:py-16">
            <div
              className="pointer-events-none absolute inset-0 nc-texture"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-ginger-500/25 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-leaf-500/25 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative mx-auto max-w-2xl">
              <p className="text-2xs font-semibold uppercase tracking-eyebrow text-ginger-200">
                Nature’s Choice Jaggery
              </p>
              <h2 className="nc-h2 mt-3 text-cream-50">
                Discover your favourite flavour
              </h2>
              <p className="nc-lede mt-4 text-cream-200/90">
                Explore the Nature’s Choice range and find your way
                to enjoy jaggery.
              </p>

              <div className="mt-8">
                <ButtonLink
                  href={ALL_ROUTES.shop}
                  variant="accent"
                  size="lg"
                >
                  Shop all products
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
