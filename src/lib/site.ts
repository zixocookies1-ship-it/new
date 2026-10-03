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
    'Pure jaggery with a chocolatey twist. Nature’s Choice makes modern Indian jaggery in three flavours — classic, roasted sesame (til) and cardamom (elaichi). 500 g at ₹249. Secure payments, pan-India delivery.',
  defaultKeywords: [
    'chocolatey jaggery',
    'jaggery chocolate',
    'desi jaggery',
    'jaggery India',
    'til jaggery',
    'sesame jaggery',
    'elaichi jaggery',
    'cardamom jaggery',
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
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const FOOTER_NAV = {
  shop: [
    { label: 'All Products', href: '/shop' },
    { label: 'Desi Chocolatey', href: '/shop?f=classic' },
    { label: 'Desi Til Chocolatey', href: '/shop?f=til' },
    { label: 'Desi Elaichi Chocolatey', href: '/shop?f=elaichi' },
  ],
  company: [
    { label: 'Home', href: '/' },
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  policies: [],
} as const;

export const ALL_ROUTES = {
  home: '/',
  shop: '/shop',
  about: '/about',
  contact: '/contact',
  cart: '/cart',
  checkout: '/checkout',
} as const;
