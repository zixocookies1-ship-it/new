import Link from 'next/link';

import { ALL_ROUTES, BRAND } from '@/lib/site';

/**
 * Storefront 404 (rendered by `notFound()` calls inside the `(store)` group, so
 * the customer keeps the header, footer and cart).
 */
export default function StoreNotFound() {
  const suggestions = [
    { label: 'Shop all jaggery', href: ALL_ROUTES.shop, note: 'All three flavours in one place.' },
    { label: 'Track an order', href: ALL_ROUTES.trackOrder, note: 'Order status and courier updates.' },
    { label: 'Our story', href: ALL_ROUTES.ourStory, note: 'Who is behind Nature’s Choice.' },
    { label: 'Recipes', href: ALL_ROUTES.recipes, note: 'Ways to eat jaggery that are not just dessert.' },
    { label: 'Contact us', href: ALL_ROUTES.contact, note: 'A person reads every message.' },
  ];

  return (
    <div className="bg-cream-100">
      <div className="nc-container py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="nc-eyebrow">Error 404</p>
          <h1 className="nc-h1 mt-3">We could not find that page</h1>
          <p className="nc-lede mt-5">
            The link may be old, or the page may have moved. Nothing is wrong with
            your order — if you were checking on one, the tracking page will find it
            straight away.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={ALL_ROUTES.home} className="nc-btn-primary">
              Back to home
            </Link>
            <Link href={ALL_ROUTES.shop} className="nc-btn-accent">
              Shop jaggery
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-2xl">
          <h2 className="text-center font-display text-lg text-jaggery-500">
            Where would you like to go?
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {suggestions.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="nc-card block p-4 transition-shadow duration-200 hover:shadow-card-hover"
                >
                  <span className="block font-display text-base text-jaggery-500">{s.label}</span>
                  <span className="mt-1 block text-sm text-ink-muted">{s.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="mx-auto mt-12 max-w-2xl text-center text-xs text-ink-faint">
          Still stuck?{' '}
          <Link href={ALL_ROUTES.contact} className="nc-link">
            Send us a message
          </Link>{' '}
          — we will work out what you were after. © {BRAND.name}.
        </p>
      </div>
    </div>
  );
}
