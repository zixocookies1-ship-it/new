/**
 * Static site configuration that does not belong in the database.
 * Anything a merchant is allowed to change lives in BusinessSettings /
 * Content and is read at request time instead.
 */

export const BRAND = {
  name: "Nature's Choice Jaggery",
  shortName: "Nature's Choice",
  idea: 'The New Age of Indian Jaggery',
  /** Used in <title> templates. */
  titleTemplate: '%s | Nature’s Choice Jaggery',
  defaultDescription:
    'Pure jaggery with a chocolatey twist. Nature’s Choice makes modern Indian jaggery in two flavours — classic and roasted sesame (til). Secure payments, pan-India delivery.',
  defaultKeywords: [
    'chocolatey jaggery',
    'jaggery chocolate',
    'desi jaggery',
    'jaggery India',
    'til jaggery',
    'sesame jaggery',
    'Nature’s Choice Jaggery',
  ],
  locale: 'en_IN',
  twitter: '@natureschoice',
} as const;

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export const PRIMARY_NAV: NavItem[] = [
  { label: 'Shop', href: '/shop' },
  { label: 'Our Story', href: '/our-story' },
  { label: 'Why Nature’s Choice', href: '/why-natures-choice' },
  { label: 'Recipes', href: '/recipes' },
  { label: 'Contact', href: '/contact' },
];

export const FOOTER_NAV = {
  shop: [
    { label: 'All Products', href: '/shop' },
    { label: 'Pair Bundle', href: '/shop#pair-bundle' },
    { label: 'Track Order', href: '/track-order' },
  ],
  learn: [
    { label: 'Our Story', href: '/our-story' },
    { label: 'Why Nature’s Choice', href: '/why-natures-choice' },
    { label: 'Recipes', href: '/recipes' },
    { label: 'FAQ', href: '/faq' },
  ],
  policies: [
    { label: 'Shipping Policy', href: '/shipping-policy' },
    { label: 'Cancellation, Refund & Return', href: '/cancellation-refund-return' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Terms & Conditions', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookie-policy' },
  ],
} as const;

export const ALL_ROUTES = {
  home: '/',
  shop: '/shop',
  ourStory: '/our-story',
  why: '/why-natures-choice',
  recipes: '/recipes',
  contact: '/contact',
  faq: '/faq',
  trackOrder: '/track-order',
  cart: '/cart',
  checkout: '/checkout',
  shippingPolicy: '/shipping-policy',
  cancellationPolicy: '/cancellation-refund-return',
  privacyPolicy: '/privacy-policy',
  terms: '/terms',
  cookiePolicy: '/cookie-policy',
} as const;
