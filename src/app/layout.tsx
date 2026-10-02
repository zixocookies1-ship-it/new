import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Inter } from 'next/font/google';

import './globals.css';
import { getBusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';
import { publicEnv } from '@/lib/env';
import { BRAND } from '@/lib/site';
import { absoluteUrl, jsonLdScript, organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import { connectDb } from '@/lib/db';

/**
 * Document root.
 *
 * Deliberately contains only what belongs to *every* route: `<html>`, the two
 * brand fonts, and the site-wide structured data. The storefront chrome lives in
 * `src/app/(store)/layout.tsx` and the admin chrome in `src/app/admin/**`, so the
 * admin panel never inherits the customer header, footer or cart drawer.
 */

/**
 * Fonts are self-hosted by next/font (no render-blocking request to a third
 * party), preloaded, and rendered with `display: swap` so text paints
 * immediately. Exactly two families, per the brand system.
 */
const display = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-display',
  preload: true,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: true,
});

const body = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  preload: true,
  weight: ['400', '500', '600', '700'],
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
  adjustFontFallback: true,
});

/** Favicon + PWA icon live at src/app/icon.svg. */
export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl('/')),
  title: {
    default: `${BRAND.name} — ${BRAND.idea}`,
    template: BRAND.titleTemplate,
  },
  description: BRAND.defaultDescription,
  applicationName: BRAND.name,
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  keywords: [...BRAND.defaultKeywords],
  category: 'Food & Beverage',
  alternates: { canonical: absoluteUrl('/') },
  formatDetection: { telephone: false, address: false, email: false },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.idea}`,
    description: BRAND.defaultDescription,
    url: absoluteUrl('/'),
    locale: BRAND.locale,
  },
  twitter: {
    card: 'summary_large_image',
    site: BRAND.twitter,
  },
  verification: publicEnv.googleSiteVerification
    ? { google: publicEnv.googleSiteVerification }
    : undefined,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F1E7' },
    { media: '(prefers-color-scheme: dark)', color: '#5A321F' },
  ],
  colorScheme: 'light',
};
/** Build a fully-shaped settings doc from defaults (used when Mongo is down). */
function fallbackSettings(): BusinessSettingsDoc {
  return {
    ...SETTINGS_DEFAULTS,
    ...({} as Record<string, never>),
    _id: null as never,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /**
   * Graceful degradation: if MongoDB is unreachable every route still renders
   * with defaults rather than a 500. Individual pages surface their own explicit
   * error states.
   */
  const settings =
    (await connectDb()
      .then(() => getBusinessSettings())
      .catch(() => null)) ?? fallbackSettings();

  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript([organizationJsonLd(settings), websiteJsonLd()]),
          }}
        />
      </head>
      <body className="bg-cream-100 font-sans text-ink">{children}</body>
    </html>
  );
}
