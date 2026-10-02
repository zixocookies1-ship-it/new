import Link from 'next/link';
import { OptimizedImage } from '@/components/media/OptimizedImage';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/StateBlocks';
import { AddBundleButton, BundlePrice, type BundleCartItem } from '@/components/cart/AddBundleButton';
import type { BundleVM, ProductVM } from '@/lib/catalog';
import type { ContentDoc } from '@/lib/models/Content';

/**
 * Section 10 — Trio bundle.
 *
 * The saving shown is computed server-side from live variant prices against the
 * configured bundle price (`computeBundleSavings`), so it can never overstate
 * a discount that does not exist in the database.
 */
export function BundleSection({
  content,
  bundles,
  products,
}: {
  content: ContentDoc | null;
  bundles: BundleVM[];
  products: ProductVM[];
}) {
  const bundle = bundles[0] ?? null;

  // Build the client payload from real product rows; anything we cannot resolve
  // is skipped so the "add" button is disabled instead of adding junk.
  const cartItems: BundleCartItem[] = (bundle?.lines ?? []).flatMap((line) => {
    const product = products.find((p) => p.id === line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) return [];
    return [
      {
        productId: product.id,
        variantId: variant.id,
        slug: product.slug,
        name: product.name,
        flavour: product.flavour,
        weightLabel: variant.weightLabel,
        imageUrl: line.imageUrl,
        unitPricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        qty: line.qty,
      },
    ];
  });

  return (
    <section className="bg-cream-200/60 py-14 sm:py-20" id="trio-bundle">
      <div className="nc-container">
        <SectionHeading
          as="h2"
          eyebrow={content?.eyebrow?.trim() || 'Try all three'}
          title={content?.title?.trim() || 'The trio bundle'}
          description={
            content?.body?.trim() ||
            'All three flavours, packed together — for people who cannot choose, and for people who want to compare.'
          }
        />

        {bundle ? (
          <Reveal className="mt-10">
            <div className="nc-card overflow-hidden bg-white">
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
                <div>
                  <div className="overflow-hidden rounded-xl2 bg-cream-50">
                    <OptimizedImage
                      media={bundle.image}
                      alt={bundle.image?.alt || bundle.name}
                      aspect="4/3"
                      fit="contain"
                      sizes="(min-width: 1024px) 44vw, 92vw"
                      maxWidth={1200}
                    />
                  </div>

                  {bundle.description ? (
                    <p className="nc-body mt-5 text-ink-muted">{bundle.description}</p>
                  ) : null}
                </div>

                <div className="flex flex-col justify-center">
                  <h3 className="font-display text-2xl text-jaggery-500">{bundle.name}</h3>
                  {bundle.shortDescription ? (
                    <p className="nc-body mt-2 text-ink-soft">{bundle.shortDescription}</p>
                  ) : null}

                  <ul className="mt-6 space-y-3">
                    {bundle.lines.map((line) => (
                      <li key={`${line.productId}-${line.variantId ?? 'x'}`} className="flex items-center gap-3">
                        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-cream-300 bg-cream-50">
                          <OptimizedImage
                            src={line.imageUrl}
                            alt={line.name}
                            aspect="1/1"
                            fit="contain"
                            sizes="56px"
                            maxWidth={160}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <Link
                            href={`/products/${products.find((p) => p.id === line.productId)?.slug ?? '/shop'}`}
                            className="text-sm font-semibold text-ink hover:text-jaggery-600"
                          >
                            {line.name}
                          </Link>
                          <span className="block text-xs text-ink-faint">
                            {line.weightLabel}
                            {line.qty > 1 ? ` · ×${line.qty}` : ''}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    <BundlePrice
                      pricePaise={bundle.bundlePricePaise}
                      savingsPaise={bundle.savings.savingsPaise}
                      individualTotalPaise={bundle.savings.individualTotalPaise}
                    />
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    {cartItems.length === bundle.lines.length && bundle.lines.length > 0 ? (
                      <AddBundleButton
                        bundleId={bundle.id}
                        name={bundle.name}
                        items={cartItems}
                        variant="accent"
                        label="Add the trio to cart"
                      />
                    ) : (
                      <span className="nc-btn-outline nc-btn cursor-not-allowed opacity-60">
                        Currently unavailable
                      </span>
                    )}
                    <Link href="/shop" className="text-sm font-medium text-jaggery-500 nc-link">
                      Or buy separately
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        ) : (
          <Reveal className="mt-10">
            <div className="mx-auto max-w-xl rounded-card border border-dashed border-cream-400 bg-white/70 px-6 py-10 text-center">
              <h3 className="font-display text-lg text-jaggery-500">Bundle coming soon</h3>
              <p className="nc-body mt-2 text-ink-muted">
                A three-flavour bundle is being prepared. In the meantime you can pick any combination
                you like.
              </p>
              <Link href="/shop" className="nc-btn-primary nc-btn-sm mt-5 inline-flex">
                Go to the shop
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}