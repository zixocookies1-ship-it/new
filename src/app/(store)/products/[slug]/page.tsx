import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { ProductGallery } from '@/components/product/ProductGallery';
import { BuyBox } from '@/components/product/BuyBox';
import { NutritionTable } from '@/components/product/NutritionTable';
import { ReviewForm } from '@/components/product/ReviewForm';
import { ProductCard } from '@/components/product/ProductCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Prose } from '@/components/ui/Prose';
import { Rating } from '@/components/ui/Rating';
import { Alert, EmptyState } from '@/components/ui/StateBlocks';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';
import { Accordion } from '@/components/ui/Accordion';

import {
  getProductBySlug,
  getStorefrontProducts,
  getApprovedReviewsForProduct,
  getFaqs,
} from '@/lib/catalog';
import { getStoreCapabilities } from '@/lib/integrations';
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, jsonLdScript, productJsonLd } from '@/lib/seo';

export const revalidate = 60;

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const { products } = await getStorefrontProducts().catch(() => ({ products: [] }));
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug).catch(() => null);
  if (!data) return { title: 'Product not found', robots: { index: false, follow: false } };

  const { product, settings } = data;
  return buildMetadata(settings, {
    title: product.seoTitle,
    description: product.seoDescription,
    path: `/products/${product.slug}`,
    image: product.ogImage,
    type: 'product',
    keywords: [product.name, product.flavour, 'chocolatey jaggery', 'jaggery India'].filter(Boolean),
  });
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();

  const { product, settings, shipping } = data;

  const [reviews, productFaqs, { products }] = await Promise.all([
    getApprovedReviewsForProduct(product.id, 20).catch(() => []),
    getFaqs({ productId: product.id }).catch(() => []),
    getStorefrontProducts().catch(() => ({ products: [], settings, shipping })),
  ]);

  const capabilities = await getStoreCapabilities({
    onlinePaymentEnabled: settings.onlinePaymentEnabled,
    codEnabled: shipping.codEnabled,
  });

  // Checkout is only offered when the courier is live AND at least one payment
  // path is genuinely available — a buy button that cannot complete is worse
  // than an honest "ordering is being set up".
  const canCheckout = shipping.shippingEnabled && (capabilities.onlinePayments || capabilities.cod);

  const related = products.filter((p) => p.id !== product.id).slice(0, 3);

  const productLd = productJsonLd(product, settings);
  const faqLd = faqJsonLd(productFaqs.map((f) => ({ question: f.question, answer: f.answer })));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Shop', path: '/shop' },
              { name: product.name, path: `/products/${product.slug}` },
            ]),
            productLd,
            faqLd,
          ].filter(Boolean)),
        }}
      />

      <div className="bg-cream-100">
        <div className="nc-container py-6 sm:py-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Shop', href: '/shop' },
              { label: product.name },
            ]}
          />
        </div>

        {/* --- Gallery + buy box ------------------------------------------- */}
        <div className="nc-container grid gap-8 pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <ProductGallery images={product.images} alt={product.name} />

          <div className="lg:sticky lg:top-28 lg:self-start">
            <BuyBox
              product={product}
              canCheckout={canCheckout}
              shippingEnabled={shipping.shippingEnabled}
            />
          </div>
        </div>

        {/* --- Detail panels ------------------------------------------------ */}
        <div className="nc-container grid gap-8 border-t border-cream-300 py-10 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
          <div className="space-y-8">
            {product.description ? (
              <section>
                <h2 className="nc-h3">About this flavour</h2>
                <Prose className="mt-3">{product.description}</Prose>
              </section>
            ) : null}

            {product.ingredients.length > 0 || product.allergens.length > 0 ? (
              <section>
                <h2 className="nc-h3">Ingredients & allergens</h2>
                <div className="mt-3 space-y-4">
                  {product.ingredients.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Ingredients</h3>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {product.ingredients.map((ing) => (
                          <li
                            key={ing}
                            className="rounded-full border border-cream-300 bg-white px-3 py-1 text-xs text-ink-soft"
                          >
                            {ing}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {product.allergens.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Allergen information</h3>
                      <ul className="mt-2 space-y-1">
                        {product.allergens.map((a) => (
                          <li key={a} className="text-sm text-ink-soft">
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : (
              <section>
                <h2 className="nc-h3">Ingredients</h2>
                <div className="mt-3">
                  <PlaceholderNote label="Ingredient list is being confirmed with our production team." />
                </div>
              </section>
            )}

            {product.howToUse.length > 0 ? (
              <section>
                <h2 className="nc-h3">How to use it</h2>
                <ul className="mt-3 space-y-2.5">
                  {product.howToUse.map((use, i) => (
                    <li key={i} className="flex gap-3 text-[0.9375rem] text-ink-soft">
                      <span className="mt-0.5 font-display text-base text-ginger-500">{i + 1}</span>
                      {use}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {productFaqs.length > 0 ? (
              <section>
                <h2 className="nc-h3 mb-4">Questions about this product</h2>
                <Accordion
                  items={productFaqs.map((faq, i) => ({
                    id: String(faq._id ?? i),
                    question: faq.question,
                    answer: <Prose>{faq.answer}</Prose>,
                  }))}
                />
              </section>
            ) : null}

            {/* --- Reviews ------------------------------------------------- */}
            <section id="reviews">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="nc-h3">Customer reviews</h2>
                  {product.rating.count > 0 ? (
                    <div className="mt-2">
                      <Rating value={product.rating.average} count={product.rating.count} size="sm" />
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm text-ink-muted">
                      No reviews yet for this flavour.
                    </p>
                  )}
                </div>
                <ReviewForm productId={product.id} productName={product.name} />
              </div>

              {reviews.length > 0 ? (
                <ul className="mt-6 space-y-4">
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-card border border-cream-300/80 bg-white p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Rating value={review.rating} count={0} size="xs" showValue={false} />
                        {review.isVerifiedPurchase ? (
                          <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-leaf-600">
                            Verified order
                          </span>
                        ) : null}
                      </div>
                      {review.title ? (
                        <h3 className="mt-2.5 font-display text-base text-jaggery-500">
                          {review.title}
                        </h3>
                      ) : null}
                      <p className="nc-body mt-1.5 text-ink-soft">{review.body}</p>
                      <p className="mt-3 text-xs text-ink-muted">
                        <span className="font-semibold text-ink">{review.authorName}</span>
                        {review.authorLocation ? ` · ${review.authorLocation}` : ''} ·{' '}
                        {new Date(review.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-6">
                  <EmptyState
                    title="Be the first to review this"
                    message="We publish reviews exactly as customers write them. Yours would be the first — and it would need to pass a quick read by our team before it appears."
                  />
                </div>
              )}
            </section>
          </div>

          {/* --- Sidebar ---------------------------------------------------- */}
          <aside className="space-y-5">
            <NutritionTable
              rows={product.nutrition}
              basis={product.nutritionPer}
              fssaiNote={product.fssaiNote}
            />

            {!product.isVerified ? (
              <div className="rounded-xl border border-cream-300 bg-white/70 p-4">
                <p className="text-sm font-semibold text-ink">Product information status</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  This listing has not been marked as verified by our team yet. Details shown are the
                  merchant’s own entries and may still be being finalised.
                </p>
                <PlaceholderNote compact className="mt-2.5" label="Pending verification" />
              </div>
            ) : null}

            {settings.fssaiNumber ? (
              <div className="rounded-xl border border-cream-300 bg-white/70 p-4">
                <p className="text-sm font-semibold text-ink">FSSAI</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Licence {settings.fssaiNumber}
                  {settings.legalName ? ` · ${settings.legalName}` : ''}
                </p>
              </div>
            ) : null}

            {shipping.shippingEnabled ? (
              <div className="rounded-xl border border-leaf-200 bg-leaf-50/60 p-4">
                <p className="text-sm font-semibold text-leaf-600">Delivery</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  {shipping.flatShippingPaise > 0
                    ? `Flat shipping of ₹${shipping.flatShippingPaise / 100} applies.`
                    : 'Shipping charges are calculated at checkout.'}
                  {shipping.freeShippingEnabled && shipping.freeShippingThresholdPaise
                    ? ` Free above ₹${shipping.freeShippingThresholdPaise / 100}.`
                    : ''}
                </p>
              </div>
            ) : (
              <Alert tone="warning" title="Online ordering is being set up">
                <p>{shipping.shippingDisabledMessage}</p>
              </Alert>
            )}

            <div className="rounded-xl border border-cream-300 bg-white/70 p-4">
              <p className="text-sm font-semibold text-ink">Need help before you order?</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li>
                  <Link href="/contact" className="nc-link">
                    Contact the team
                  </Link>
                </li>
                <li>
                  <Link href="/our-story" className="nc-link">
                    Read our story
                  </Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>

        {/* --- Related ------------------------------------------------------ */}
        {related.length > 0 ? (
          <section className="border-t border-cream-300 bg-white py-12">
            <div className="nc-container">
              <h2 className="nc-h3 mb-6">You might also like</h2>
              <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <ProductCard key={p.id} product={p} compact />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}