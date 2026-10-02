import type { Metadata } from 'next';
import Link from 'next/link';

import { TrackOrderClient } from '@/components/track/TrackOrderClient';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { PincodeChecker } from '@/components/product/PincodeChecker';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { getShippingConfig, SHIPPING_DEFAULTS } from '@/lib/models/ShippingConfiguration';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBusinessSettings().catch(() => ({ ...SETTINGS_DEFAULTS }) as never);
  return {
    ...buildMetadata(settings, {
      title: 'Track Order',
      description:
        'Track your Nature’s Choice Jaggery order with your order ID and the email or mobile you used.',
      path: '/track-order',
      noIndex: true,
    }),
    // Order tracking takes a query the search engine has no business indexing.
    robots: { index: false, follow: true },
  };
}

export default async function TrackOrderPage() {
  const shipping = await getShippingConfig().catch(() => ({ ...SHIPPING_DEFAULTS }) as never);

  return (
    <>
      <div className="bg-cream-100">
        <div className="nc-container py-8 sm:py-12">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Track Order' }]} />

          <header className="mt-6 max-w-3xl">
            <p className="nc-eyebrow mb-3">Order status</p>
            <h1 className="nc-h1">Where is my order?</h1>
            <p className="nc-lede mt-5">
              Enter your order ID and the email or mobile number you used. Both are needed so nobody
              else can see your order details.
            </p>
          </header>
        </div>
      </div>

      <div className="bg-white py-12 sm:py-16">
        <div className="nc-container">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <TrackOrderClient />

            <div className="space-y-5">
              {shipping.shippingEnabled ? (
                <section className="rounded-card border border-cream-300 bg-cream-50 p-5">
                  <h2 className="font-display text-lg text-jaggery-500">
                    Checking a different address?
                  </h2>
                  <p className="nc-body mt-1.5 text-ink-muted">
                    Before ordering, check whether we deliver to your PIN code.
                  </p>
                  <div className="mt-3">
                    <PincodeChecker compact />
                  </div>
                </section>
              ) : null}

              <section className="rounded-card border border-cream-300 bg-cream-50 p-5">
                <h2 className="font-display text-lg text-jaggery-500">Order changed your mind?</h2>
                <p className="nc-body mt-1.5 text-ink-muted">
                  You can cancel from your order page while the parcel has not shipped.
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link href="/cancellation-refund-return" className="nc-link">
                      Read the cancellation &amp; refund policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/shipping-policy" className="nc-link">
                      How delivery works
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="nc-link">
                      Contact the team
                    </Link>
                  </li>
                </ul>
              </section>

              <section className="rounded-card border border-cream-300 bg-cream-50 p-5">
                <h2 className="font-display text-lg text-jaggery-500">Find your order ID</h2>
                <ul className="mt-2.5 space-y-2 text-sm text-ink-muted">
                  <li>It looks like NC-XXXXXXXXXX and is on your order confirmation.</li>
                  <li>It is also the last line of any message we send about the order.</li>
                  <li>
                    If you cannot find it,{' '}
                    <Link href="/contact" className="nc-link">
                      tell us the email or mobile you used
                    </Link>{' '}
                    and we will look it up.
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}