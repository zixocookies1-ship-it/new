import Link from 'next/link';

import { BRAND } from '@/lib/site';

/**
 * Root 404.
 *
 * Lives at the app root so it also covers unmatched URLs outside the storefront
 * group (for example a mistyped admin path). It is intentionally standalone — no
 * header, no footer, no assumptions about a catalogue — so it renders correctly
 * even when the database is unreachable.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-5 py-16">
      <div className="w-full max-w-xl text-center">
        <p className="nc-eyebrow">Error 404</p>
        <h1 className="nc-h1 mt-3">We could not find that page</h1>
        <p className="nc-lede mt-5">
          The link may be old, or the page may have moved. Try the shop, the about
          page, or send us a message and we will point you the right way.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="nc-btn-primary">
            Back to home
          </Link>
          <Link href="/shop" className="nc-btn-accent">
            Shop jaggery
          </Link>
        </div>

        <ul className="mx-auto mt-10 flex max-w-md flex-col gap-2 text-left">
          {[
            { label: 'About us', href: '/about' },
            { label: 'Contact us', href: '/contact' },
            { label: 'Your cart', href: '/cart' },
          ].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="nc-card block px-4 py-3 text-sm font-medium text-jaggery-500 hover:shadow-card-hover"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-xs text-ink-faint">© {BRAND.name}.</p>
      </div>
    </div>
  );
}
