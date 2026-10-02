import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/ButtonLink';
import type { ContentDoc } from '@/lib/models/Content';
import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';

/**
 * Section 13 — Final call to action.
 *
 * Note what is NOT here: no countdown timer, no "only 3 left", no discount
 * code we cannot honour. A closing ask plus an honest support line.
 */
export function FinalCtaSection({
  content,
  settings,
}: {
  content: ContentDoc | null;
  settings: BusinessSettingsDoc;
}) {
  const title = content?.title?.trim() || 'Ready when you are';
  const body =
    content?.body?.trim() ||
    'Pick a flavour, choose your pack size, and we will handle the rest from there.';

  const supportEmail = settings.supportEmail?.trim();
  const supportPhone = settings.supportPhone?.trim();

  return (
    <section className="bg-cream-100 pb-16 pt-4 sm:pb-24">
      <div className="nc-container">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-jaggery-500 px-6 py-12 text-center shadow-card sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute inset-0 nc-texture" aria-hidden="true" />
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-ginger-500/25 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-leaf-500/25 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative mx-auto max-w-2xl">
              <h2 className="nc-h2 text-cream-50">{title}</h2>
              <p className="nc-lede mt-4 text-cream-200/90">{body}</p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href="/shop" variant="accent" size="lg">
                  Shop the range
                </ButtonLink>
                <Link
                  href="/track-order"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-cream-50/30 px-8 text-[0.9375rem] font-semibold text-cream-50 transition-colors hover:border-cream-50/70 hover:bg-cream-50/10"
                >
                  Track an order
                </Link>
              </div>

              {supportEmail || supportPhone ? (
                <p className="mt-6 text-sm text-cream-200/80">
                  Questions before you order?{' '}
                  {supportEmail ? (
                    <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">
                      {supportEmail}
                    </a>
                  ) : null}
                  {supportEmail && supportPhone ? ' or ' : null}
                  {supportPhone ? (
                    <a
                      href={`tel:${supportPhone.replace(/[^\d+]/g, '')}`}
                      className="underline underline-offset-4"
                    >
                      {supportPhone}
                    </a>
                  ) : null}
                </p>
              ) : (
                <p className="mt-6 text-sm text-cream-200/75">
                  Support details are being added —{' '}
                  <Link href="/contact" className="underline underline-offset-4">
                    the contact page
                  </Link>{' '}
                  works in the meantime.
                </p>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}