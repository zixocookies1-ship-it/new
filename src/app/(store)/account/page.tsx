import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { OrderLookup } from '@/components/account/OrderLookup';
import { buildMetadata } from '@/lib/seo';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { BRAND } from '@/lib/site';

export const metadata: Metadata = buildMetadata(
  { ...SETTINGS_DEFAULTS } as never,
  {
    title: 'Account',
    description: 'No account needed to order. Track your order with its order ID.',
    path: '/account',
  },
);

/**
 * Account page.
 *
 * Nature's Choice deliberately has no accounts: ordering never asks for
 * a login, and every order is tracked by the order ID sent on
 * confirmation. This page states that plainly and links to the two
 * things a customer actually needs — order tracking and support.
 */
export default function AccountPage() {
  return (
    <div className="bg-cream-100">
      <div className="nc-container py-10 sm:py-14">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Account' }]} />

        <div className="mx-auto mt-8 max-w-2xl">
          <p className="nc-eyebrow">Your account</p>
          <h1 className="nc-h1 mt-3">No account needed — ever.</h1>
          <p className="nc-lede mt-5">
            You can order from {BRAND.name} without signing up for anything. There is
            no login, no password and no profile to manage — just your order ID,
            which arrives with every confirmation.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-4">
          <div className="nc-card p-6 sm:p-8">
            <h2 className="font-display text-lg text-jaggery-500">Track an order</h2>
            <p className="nc-body mt-2">
              Quote the order ID from your confirmation email or SMS and we will show
              the live status of that order.
            </p>
            <div className="mt-5">
              <OrderLookup />
            </div>
          </div>

          <div className="nc-card p-6 sm:p-8">
            <h2 className="font-display text-lg text-jaggery-500">Need help with an order?</h2>
            <p className="nc-body mt-2">
              A person reads every message on the contact page. Quote your order ID
              and we can help with changes, cancellations or anything else.
            </p>
            <div className="mt-5">
              <ButtonLink href="/contact" variant="outline">
                Contact us
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
