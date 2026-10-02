import Link from 'next/link';
import { Rating } from '@/components/ui/Rating';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { OptimizedImage } from '@/components/media/OptimizedImage';
import type { ReviewVM } from '@/lib/catalog';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * Section 8 — Reviews.
 *
 * Only `status === APPROVED` **and** `permissionConfirmed === true` reviews
 * ever reach this component, and the aggregate rating is omitted entirely when
 * there are zero reviews. We never seed testimonials, so an empty catalogue of
 * reviews produces an honest invitation to be the first — not fake quotes.
 */
export function ReviewsSection({
  content,
  reviews,
}: {
  content: ContentDoc | null;
  reviews: ReviewVM[];
}) {
  const aggregate =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return (
    <section className="bg-cream-200/60 py-14 sm:py-20" id="reviews">
      <div className="nc-container">
        <SectionHeading
          as="h2"
          eyebrow={content?.eyebrow?.trim() || 'What customers say'}
          title={content?.title?.trim() || 'Real words from real orders'}
          description={
            content?.body?.trim() ||
            'Every review below comes from a customer who chose to share their experience. Nothing is written on their behalf.'
          }
        />

        {reviews.length > 0 ? (
          <>
            <Reveal className="mt-8 flex justify-center">
              <div className="flex items-center gap-3 rounded-full border border-cream-300 bg-white px-5 py-2.5 shadow-card">
                <Rating value={aggregate} count={reviews.length} size="sm" />
              </div>
            </Reveal>

            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 6).map((review, i) => (
                <Reveal as="li" key={review.id} delay={i * 60}>
                  <article className="flex h-full flex-col gap-3 rounded-card border border-cream-300/80 bg-white p-5 shadow-card">
                    <div className="flex items-center justify-between gap-3">
                      <Rating value={review.rating} count={0} size="xs" showValue={false} />
                      {review.isVerifiedPurchase ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-leaf-600">
                          <svg
                            viewBox="0 0 20 20"
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <path d="M4.5 10.5 8 14l7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Verified order
                        </span>
                      ) : null}
                    </div>

                    {review.title ? (
                      <h3 className="font-display text-lg leading-snug text-jaggery-500">
                        {review.title}
                      </h3>
                    ) : null}

                    <p className="nc-body flex-1 text-ink-soft">{review.body}</p>

                    {review.images.length > 0 ? (
                      <div className="flex gap-2">
                        {review.images.slice(0, 3).map((img, n) => (
                          <div
                            key={img.publicId || n}
                            className="h-16 w-16 overflow-hidden rounded-lg border border-cream-300"
                          >
                            <OptimizedImage
                              media={img}
                              alt={img.alt}
                              aspect="1/1"
                              fit="cover"
                              sizes="64px"
                              maxWidth={200}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <footer className="border-t border-cream-200 pt-3 text-xs text-ink-muted">
                      <span className="font-semibold text-ink">{review.authorName}</span>
                      {review.authorLocation ? <span> · {review.authorLocation}</span> : null}
                      {review.productSlug ? (
                        <>
                          <span> · </span>
                          <Link
                            href={`/products/${review.productSlug}`}
                            className="font-medium text-jaggery-500 underline decoration-cream-400 underline-offset-2 hover:decoration-ginger-500"
                          >
                            {review.productName || 'Product'}
                          </Link>
                        </>
                      ) : null}
                    </footer>
                  </article>
                </Reveal>
              ))}
            </ul>
          </>
        ) : (
          <Reveal className="mt-10">
            <div className="mx-auto max-w-xl rounded-card border border-dashed border-cream-400 bg-white/70 px-6 py-10 text-center">
              <h3 className="font-display text-lg text-jaggery-500">No reviews yet</h3>
              <p className="nc-body mt-2 text-ink-muted">
                We publish reviews exactly as customers write them — we do not write them for you. Once
                customers share their experience, it will appear here.
              </p>
              <Link href="/contact" className="nc-btn-outline nc-btn-sm mt-5 inline-flex">
                Share your experience
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}