/**
 * Catalogue seed.
 *
 * Run with: `npm run seed`
 *
 * ── What this seeds ──────────────────────────────────────────────────────────
 *   • the three flavours as real product documents + variants
 *   • the homepage / page copy blocks (`Content`) with structural headings
 *   • a starter set of FAQs and recipes written as *usage* copy
 *   • one "Trio" bundle bound to the three products
 *   • the singleton BusinessSettings + ShippingConfiguration documents
 *
 * ── What this deliberately does NOT seed ──────────────────────────────────────
 *   • NO reviews or ratings. A single fake review is enough to make every real
 *     review untrustworthy, so the reviews collection starts empty and the
 *     storefront renders its "no reviews yet" state.
 *   • NO reviews, ratings, FSSAI / GSTIN / CIN numbers, business address, phone
 *     numbers, founder biography, awards, certifications, sales figures or
 *     delivery dates. A promised delivery window we cannot keep is worse than
 *     no promise at all, so estimates stay off until a courier confirms them.
 *   • NO pickup address. Shipping / fulfilment details, charges, free-shipping
 *     threshold, COD and delivery estimates come from `SHIPPING_DEFAULTS` and
 *     `Admin → Shipping`, so nothing is invented here.
 *
 * The three prices we DO seed are the ones the merchant has actually set:
 * the 500 g pack at MRP ₹399, selling ₹249, 100 units of stock.
 *
 * Re-running is safe: every write is an upsert keyed on a natural identifier.
 */

import { loadEnv, requireEnv } from './env-boot';
import { connectDb, disconnectDb } from '@/lib/db';
import { Product } from '@/lib/models/Product';
import { ProductVariant } from '@/lib/models/ProductVariant';
import { Content } from '@/lib/models/Content';
import { Faq } from '@/lib/models/Faq';
import { Recipe } from '@/lib/models/Recipe';
import { Bundle } from '@/lib/models/Bundle';
import { BusinessSettings, SETTINGS_DEFAULTS } from '@/lib/models/BusinessSettings';
import { ShippingConfiguration, SHIPPING_DEFAULTS } from '@/lib/models/ShippingConfiguration';
import type { ContentKey, MediaRef } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/* Products                                                                    */
/* -------------------------------------------------------------------------- */

interface SeedVariant {
  sku: string;
  weightLabel: string;
  weightGrams: number;
}

interface SeedProduct {
  slug: string;
  name: string;
  flavour: 'classic' | 'til' | 'elaichi';
  tagline: string;
  shortDescription: string;
  description: string;
  sortOrder: number;
  variants: SeedVariant[];
  seoTitle: string;
  seoDescription: string;
  /** Alt text for the lead photo; the gallery appends "— view N". */
  imageAlt: string;
  /** Local photo set, served from `public/media/products/`. */
  gallery: SeedImage[];
}

/* ------------------------------------------------------------------------ */
/* Real catalogue: 3 flavours, 500 g pack, MRP ₹399 -> selling ₹249.        */
/* Only the 500 g variant is active; 100 g / 250 g exist but are switched    */
/* off so a single, honest price is shown everywhere.                        */
/* ------------------------------------------------------------------------ */
const PACK_WEIGHT_GRAMS = 500;
const PACK_WEIGHT_LABEL = '500 g';
const PACK_MRP_PAISE = 39900;
const PACK_PRICE_PAISE = 24900;
const PACK_INVENTORY = 100;

const PRICE_LINE =
  `Every jar is a ${PACK_WEIGHT_LABEL} pack — MRP ₹399, now ₹${PACK_PRICE_PAISE / 100}. We ship across India.`;

function variantsFor(flavour: string): SeedVariant[] {
  const prefix = flavour.toUpperCase();
  return [
    { sku: `NCJ-${prefix}-100`, weightLabel: '100 g', weightGrams: 100 },
    { sku: `NCJ-${prefix}-250`, weightLabel: '250 g', weightGrams: 250 },
    {
      sku: `NCJ-${prefix}-${PACK_WEIGHT_GRAMS}`,
      weightLabel: PACK_WEIGHT_LABEL,
      weightGrams: PACK_WEIGHT_GRAMS,
    },
  ];
}

/**
 * A local photo stored in the same `MediaRef` shape Cloudinary uses.
 *
 * `OptimizedImage` serves anything whose id starts with `/` straight
 * from `public/`, so a local `/media/...` path renders exactly like an
 * uploaded asset. If Cloudinary is configured later, re-upload via
 * Admin → Media and the row is replaced.
 */
function localMedia(
  src: string,
  alt: string,
  width: number,
  height: number,
  role: MediaRef['role'] = 'front_pack',
  order = 1,
): MediaRef {
  return {
    publicId: src,
    url: src,
    secureUrl: src,
    width,
    height,
    format: src.endsWith('.png') ? 'png' : 'jpeg',
    role,
    alt,
    order,
  };
}

const PRODUCT_IMAGE_DIR = '/media/products';

interface SeedImage {
  file: string;
  width: number;
  height: number;
}

/** Full local photo set for a product: lead shot first, then the gallery. */
function productImages(imageAlt: string, gallery: SeedImage[]): MediaRef[] {
  return gallery.map((img, i) =>
    localMedia(
      `${PRODUCT_IMAGE_DIR}/${img.file}`,
      i === 0 ? imageAlt : `${imageAlt} — view ${i + 1}`,
      img.width,
      img.height,
      i === 0 ? 'front_pack' : 'gallery',
      i + 1,
    ),
  );
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: 'desi-chocolatey-jaggery',
    name: 'Desi Chocolatey Jaggery',
    flavour: 'classic',
    tagline: 'The one that started it — deep, malty, unmistakably jaggery.',
    shortDescription:
      'Our original: desi jaggery given a slow, gentle melt for a chocolatey depth that is still unmistakably jaggery.',
    description: [
      'Desi Chocolatey Jaggery is where we started. The base is traditional jaggery made from unrefined cane juice — no refining, no bleaching, nothing added to lighten the colour.',
      'What makes this jar different is the finish. The jaggery is melted slowly and left to cool into a soft, glossy slab, which rounds off the raw, mineral edge and leaves the deep caramel-malt notes sitting on top.',
      'The result is a jaggery you can eat straight from the jar, grate into a hot drink, or drop into a dessert without it disappearing into plain sugar.',
      '',
      PRICE_LINE,
    ].join('\n\n'),
    sortOrder: 1,
    variants: variantsFor('classic'),
    seoTitle: 'Desi Chocolatey Jaggery — classic Indian jaggery, 500 g',
    seoDescription:
      'Our original desi jaggery with a slow, chocolatey finish. 500 g pack, MRP ₹399, now ₹249.',
    imageAlt: 'Desi Chocolatey Jaggery — the classic 500 g jar',
    gallery: [
      { file: 'desi-chocolatey-jaggery-01.jpeg', width: 4000, height: 4000 },
      { file: 'desi-chocolatey-jaggery-02.jpeg', width: 1254, height: 1254 },
      { file: 'desi-chocolatey-jaggery-03.jpeg', width: 4000, height: 4000 },
      { file: 'desi-chocolatey-jaggery-04.jpeg', width: 4000, height: 4000 },
      { file: 'desi-chocolatey-jaggery-05.jpeg', width: 4000, height: 4000 },
      { file: 'desi-chocolatey-jaggery-06.jpeg', width: 1641, height: 1641 },
    ],
  },
  {
    slug: 'desi-til-chocolatey-jaggery',
    name: 'Desi Til Chocolatey Jaggery',
    flavour: 'til',
    tagline: 'Classic jaggery met toasted sesame.',
    shortDescription:
      'Roasted sesame folded into our classic desi jaggery for a nutty, savoury-sweet jar that works with almost anything.',
    description: [
      'Til is the traditional sesame. Stirred into our classic jaggery at a low ratio, it adds a toasted, savoury warmth rather than competing with the jaggery itself.',
      'Sesame is roasted before it goes in, so the flavour is nutty and deep instead of grassy. It is the jar people reach for with a hot cup of chai, and the one that disappears fastest off a slice of toast.',
      '',
      PRICE_LINE,
    ].join('\n\n'),
    sortOrder: 2,
    variants: variantsFor('til'),
    seoTitle: 'Desi Til Chocolatey Jaggery — roasted sesame jaggery, 500 g',
    seoDescription:
      'Roasted sesame folded into our classic desi jaggery. 500 g pack, MRP ₹399, now ₹249.',
    imageAlt: 'Desi Til Chocolatey Jaggery — the roasted sesame 500 g jar',
    gallery: [
      { file: 'desi-til-chocolatey-jaggery-01.jpeg', width: 1064, height: 1600 },
      { file: 'desi-til-chocolatey-jaggery-02.jpeg', width: 1600, height: 1600 },
      { file: 'desi-til-chocolatey-jaggery-03.jpeg', width: 1600, height: 1600 },
      { file: 'desi-til-chocolatey-jaggery-04.jpeg', width: 1600, height: 1600 },
      { file: 'desi-til-chocolatey-jaggery-05.jpeg', width: 1600, height: 1600 },
      { file: 'desi-til-chocolatey-jaggery-06.jpeg', width: 1600, height: 1600 },
    ],
  },
  {
    slug: 'desi-elaichi-chocolatey-jaggery',
    name: 'Desi Elaichi Chocolatey Jaggery',
    flavour: 'elaichi',
    tagline: 'Classic jaggery lifted with whole green cardamom.',
    shortDescription:
      'Cracked green cardamom folded into our classic desi jaggery for a warm, floral jar that is as good in coffee as it is in dessert.',
    description: [
      'Elaichi is green cardamom, cracked whole rather than ground. Folded into our classic jaggery at a low ratio, it gives the jar a warm, floral lift without turning sweet into perfume.',
      'Cracked pods keep more aroma than a powder would, and the seeds are what carry most of it — which is why the flavour survives being melted into a glossy slab.',
      'It is the one to reach for with a hot coffee, stirred through warm milk, or shaved over a dessert where the chocolatey base needs a lift.',
      '',
      PRICE_LINE,
    ].join('\n\n'),
    sortOrder: 3,
    variants: variantsFor('elaichi'),
    seoTitle: 'Desi Elaichi Chocolatey Jaggery — cardamom jaggery, 500 g',
    seoDescription:
      'Cracked green cardamom folded into our classic desi jaggery. 500 g pack, MRP ₹399, now ₹249.',
    imageAlt: 'Desi Elaichi Chocolatey Jaggery — the cardamom 500 g jar',
    gallery: [
      { file: 'desi-elaichi-chocolatey-jaggery-01.jpeg', width: 1600, height: 1600 },
      { file: 'desi-elaichi-chocolatey-jaggery-02.jpeg', width: 1600, height: 1600 },
      { file: 'desi-elaichi-chocolatey-jaggery-03.jpeg', width: 1600, height: 1600 },
      { file: 'desi-elaichi-chocolatey-jaggery-04.jpeg', width: 860, height: 860 },
      { file: 'desi-elaichi-chocolatey-jaggery-05.jpeg', width: 1600, height: 1600 },
      { file: 'desi-elaichi-chocolatey-jaggery-06.jpeg', width: 1600, height: 1600 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Content blocks                                                              */
/* -------------------------------------------------------------------------- */

interface SeedContent {
  key: ContentKey;
  title: string;
  eyebrow?: string;
  body?: string;
  faqCategory?: string;
  /** `false` keeps the storefront's "being confirmed" note visible. */
  verified?: boolean;
  items?: Array<Record<string, unknown>>;
  sections?: Array<{ heading: string; body: string; bullet?: string; verified?: boolean }>;
  seoTitle?: string;
  seoDescription?: string;
}

const CONTENT: SeedContent[] = [
  {
    key: 'home_hero',
    eyebrow: 'Nature’s Choice Jaggery',
    title: 'A sweeter way to choose better.',
    body: 'A modern take on a familiar Indian favourite — desi jaggery with a slow, chocolatey finish, combined with distinctive flavours for the modern Indian home.',
    verified: true,
    seoTitle: "Nature's Choice Jaggery — the new age of Indian jaggery",
    seoDescription:
      'Three flavours of chocolatey desi jaggery: classic, roasted sesame (til) and cardamom (elaichi). 500 g at ₹249.',
  },
  {
    key: 'home_trust',
    title: 'Ordering should be simple',
    items: [
      {
        title: 'Prices shown before you pay',
        text: 'What you see at checkout is what the order is created for. Nothing is added at the last step.',
      },
      {
        title: 'Payments handled by a gateway',
        text: 'Card and UPI are processed by Razorpay. We never see or store your card or UPI details.',
      },
      {
        title: 'Every order gets an ID',
        text: 'You will get an order ID with your confirmation email. Keep it handy if you need to reach us.',
      },
    ],
  },
  {
    key: 'home_three_flavours',
    eyebrow: 'The range',
    title: 'Three flavours. One delicious idea.',
    body: 'The same slow-set chocolatey jaggery, finished three ways — classic, roasted sesame (til) and green cardamom (elaichi).',
  },
  {
    key: 'home_why',
    eyebrow: 'Why it tastes different',
    title: 'Made slowly, sold honestly',
    items: [
      {
        title: 'Unrefined cane juice',
        text: 'Our jaggery is made from unrefined cane juice. We do not bleach it, refine it or lighten the colour to make it look uniform.',
      },
      {
        title: 'A slow finish',
        text: 'The jaggery is melted slowly and cooled into a soft slab. That slow step is what gives it the chocolatey depth.',
      },
      {
        title: 'Whole spices, not powders',
        text: 'The til is roasted sesame; the elaichi is cracked whole green cardamom. Both keep more aroma than a powder would.',
      },
      {
        title: 'No claims we cannot back up',
        text: 'No “diabetic-friendly”, no “chemical-free”, no invented certifications. If we cannot show you the paperwork, we do not print the claim.',
      },
    ],
    sections: [
      {
        heading: 'What we will never print on this site',
        body: 'Health claims, certification badges, award wins, founder biographies, customer counts and delivery dates that we cannot actually keep. If a fact is missing we show a clearly-marked placeholder instead of guessing.',
        verified: true,
      },
    ],
  },
  {
    key: 'home_featured',
    eyebrow: 'Start here',
    title: 'The classic, if you only try one',
    body: 'If you are not sure where to begin, the classic is the one to try. It is the base the other two are built on.',
  },
  {
    key: 'home_process',
    eyebrow: 'Farm to jar',
    title: 'What actually happens before it reaches you',
    sections: [
      {
        heading: 'Cane is crushed',
        body: 'The cane is crushed and the juice is boiled down in open pans to remove the water. That is what produces jaggery rather than sugar.',
        verified: true,
      },
      {
        heading: 'The jaggery is set',
        body: 'As the juice thickens it is poured into moulds and allowed to set into blocks, then dried.',
        verified: true,
      },
      {
        heading: 'We melt it slowly',
        body: 'The blocks are melted slowly and cooled into a soft, glossy slab. This is the step that gives our jaggery its chocolatey character.',
        verified: true,
      },
      {
        heading: 'Spices are folded in',
        body: 'For the til and elaichi jars, roasted sesame or cracked green cardamom is folded in before the slab sets.',
        verified: true,
      },
      {
        heading: 'Packed and dispatched',
        body: 'The jars are packed and handed to our courier. You get an order ID and a waybill to track.',
        verified: true,
      },
    ],
  },
  {
    key: 'home_story',
    eyebrow: 'Our story',
    title: 'Why we started Nature’s Choice',
    body: '',
    sections: [
      {
        heading: '',
        body: 'Our founder’s note is being written and will be published here as soon as it is ready. We would rather leave it blank than fill it with a story that is not ours.',
        verified: false,
      },
    ],
  },
  {
    key: 'home_reviews',
    eyebrow: 'Customer reviews',
    title: 'What customers actually say',
    body: 'Only reviews we have approval to publish appear here, and they arrive from real orders. There are none yet — the first ones will show up on their own.',
  },
  {
    key: 'home_ugc',
    eyebrow: 'From the community',
    title: 'Shared by customers',
    body: 'Photos sent in by the people who actually unjarred it. Send us yours and it goes right here.',
  },
  {
    key: 'home_bundle',
    eyebrow: 'The range',
    title: 'Try all three',
    body: 'One jar of each flavour. When the price is set we will show the saving against buying separately — and only if that saving is real.',
  },
  {
    key: 'home_recipes',
    eyebrow: 'Ways to use it',
    title: 'Ways to enjoy',
    body: 'More ways to make every bite a little sweeter.',
  },
  {
    key: 'home_faq',
    eyebrow: 'Questions',
    title: 'Before you order',
    faqCategory: 'Ordering',
    body: 'Anything else, ask us on the contact page and a human will answer.',
  },
  {
    key: 'home_final_cta',
    title: 'Ready when you are',
    body: 'Pick a flavour, or start with the trio and decide later.',
  },
  {
    key: 'our_story',
    eyebrow: 'Our story',
    title: 'A jaggery brand built on one rule',
    body: 'The rule is simple: we only print what we can show you evidence for. That is why there are no invented certifications on this site, no health claims on the label, and no customer quotes we did not receive.\n\nOur founder and co-founder is Vijay Gupta. The fuller story of how the brand started is still being written and will be published here once it is confirmed.',
    sections: [
      {
        heading: 'What we will never print on this site',
        body: 'Health claims, certification badges, award wins, founder biographies, customer counts and delivery dates that we cannot actually keep. If a fact is missing we show a clearly-marked placeholder instead of guessing.',
        verified: true,
      },
    ],
  },
  {
    key: 'why_natures_choice',
    eyebrow: 'Why Nature’s Choice',
    title: 'Why Nature’s Choice?',
    body: 'A modern take on a timeless Indian favourite.',
    sections: [
      {
        heading: 'Unrefined, not repolished',
        body: 'Our jaggery is made from unrefined cane juice and keeps its natural colour and its mineral depth. We do not bleach or reprocess it to make it look uniform.',
        verified: true,
      },
      {
        heading: 'Slow-melted, not just cooked',
        body: 'Melting the jaggery slowly and letting it cool into a soft slab is what rounds off the raw edge and creates the chocolatey depth the brand is named for.',
        verified: true,
      },
      {
        heading: 'Whole spices, cracked in',
        body: 'The sesame is roasted. The cardamom is cracked from whole pods. Neither is a powder, because powder goes flat.',
        verified: true,
      },
      {
        heading: 'No claim without evidence',
        body: 'We do not print health claims, certification badges or award wins we cannot document. Where a detail is genuinely missing you will see a marked placeholder, not a guess.',
        verified: true,
      },
    ],
  },
  {
    key: 'contact',
    eyebrow: 'Contact',
    title: 'Talk to us',
    body: 'Questions about an order, a flavour or a delivery — send a message and we will reply. For anything urgent about an existing order, quote your order ID.',
  },
];

/* -------------------------------------------------------------------------- */
/* FAQs                                                                        */
/* -------------------------------------------------------------------------- */

const FAQS = [
  {
    category: 'Ordering',
    isFeatured: true,
    order: 1,
    question: 'What is the difference between the three flavours?',
    answer:
      'All three start from the same desi jaggery. The classic is the plain original with a slow-melted finish. Til adds roasted sesame for a nutty, savoury-sweet note. Elaichi adds cracked whole green cardamom for a floral, warming note. If you are unsure, start with the classic.',
  },
  {
    category: 'Ordering',
    isFeatured: true,
    order: 2,
    question: 'When will my order be delivered?',
    answer:
      'We do not publish a delivery date we cannot keep. Once your order is dispatched you will receive a tracking link by SMS or email, showing the courier’s live status rather than an estimate we made up.',
  },
  {
    category: 'Ordering',
    isFeatured: false,
    order: 3,
    question: 'Can I change or cancel my order?',
    answer:
      'You can cancel from the order confirmation page within the cancellation window shown on our cancellation, refund and return policy. After that window, contact us and we will see what is possible. A cancelled order that was already paid is refunded to the original payment method.',
  },
  {
    category: 'Ordering',
    isFeatured: false,
    order: 4,
    question: 'Do I need an account to order?',
    answer:
      'No. There is no account step at checkout and no login anywhere on the site. You will get an order ID with your confirmation, and you can quote it to us if you need help with that order.',
  },
  {
    category: 'Payments',
    isFeatured: true,
    order: 1,
    question: 'Which payment methods can I use?',
    answer:
      'Online payment is handled by Razorpay, which supports cards, UPI and net banking. The methods actually available to you are shown at checkout. If online payment is not yet switched on, the checkout page will say so rather than showing a button that cannot work.',
  },
  {
    category: 'Payments',
    isFeatured: false,
    order: 2,
    question: 'Is cash on delivery available?',
    answer:
      'Only on PIN codes we can service, and only if cash on delivery is switched on for the store. If it is available to you, it will be listed as an option at checkout.',
  },
  {
    category: 'Payments',
    isFeatured: false,
    order: 3,
    question: 'When is my payment refunded?',
    answer:
      'Refunds are issued to the original payment method. The timeline depends on your bank or UPI provider once we have raised it. Your order page shows when the refund was initiated and the refund reference.',
  },
  {
    category: 'Product',
    isFeatured: true,
    order: 1,
    question: 'How should I store the jaggery?',
    answer:
      'Keep the jar tightly closed in a cool, dry place away from direct sunlight. If you live somewhere very humid, put the jar inside a sealed bag or a container with a silica packet — moisture is what makes jaggery go sticky and lose its texture.',
  },
  {
    category: 'Product',
    isFeatured: false,
    order: 2,
    question: 'How long does it stay good?',
    answer:
      'Jaggery keeps for a long time in a sealed jar, but the exact shelf life for your pack is printed on the label. We would rather point you at the jar than quote a number that might not match what you receive.',
  },
  {
    category: 'Product',
    isFeatured: false,
    order: 3,
    question: 'Does the jaggery contain any additives?',
    answer:
      'No. It is made from cane juice only. The ingredient list on each pack is the single line it should be. If you need an allergen or dietary detail for a specific product, ask us on the contact page and we will read it off the label.',
  },
  {
    category: 'Product',
    isFeatured: false,
    order: 4,
    question: 'Is this suitable for people with diabetes?',
    answer:
      'We are not able to make that call, and we will not print a health claim on a food label to avoid it. Please speak to your doctor or a registered dietitian about jaggery and your own health needs — that is genuinely the right person to ask.',
  },
  {
    category: 'Product',
    isFeatured: false,
    order: 5,
    question: 'What is the difference between jaggery and sugar?',
    answer:
      'They come from the same plant, but jaggery keeps more of the cane’s own flavour and colour because it is made by boiling the juice down rather than refining it into crystals. It is also hygroscopic, which is why it needs a sealed jar. Whether that difference matters for your health is a question for your doctor, not for us.',
  },
];

/* -------------------------------------------------------------------------- */
/* Recipes                                                                     */
/* -------------------------------------------------------------------------- */

interface SeedRecipe {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: string[];
  steps: Array<{ instruction: string; durationMinutes?: number }>;
  body: string;
}

const RECIPES: SeedRecipe[] = [
  {
    slug: 'chai-masala-with-our-jaggery',
    title: 'Chai masala with our jaggery',
    excerpt: 'The everyday cup, sweetened the traditional way instead of with white sugar.',
    category: 'Drinks',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 8,
    ingredients: [
      '1 cup water',
      '1 cup milk',
      '1 tsp loose black tea',
      '2 green cardamom pods, cracked',
      '1 small piece of ginger, sliced',
      '1 tsp Desi Chocolatey Jaggery (add more to taste)',
      '1 pinch of salt (optional, it sharpens the sweetness)',
    ],
    steps: [
      { instruction: 'Crack the cardamom against a flat surface and put it in a pan with the water.' },
      { instruction: 'Bring the water to a boil, add the tea and ginger, and let it simmer for 3 minutes.', durationMinutes: 3 },
      { instruction: 'Add the milk and bring it back up to a simmer.', durationMinutes: 3 },
      { instruction: 'Take the pan off the heat, stir in the jaggery until it dissolves, and strain into cups.' },
    ],
    body: 'Jaggery dissolves at a lower temperature than white sugar, which is why chai made with it tastes rounder and less sharp. Add it after the milk has come up to temperature so it melts without the milk scalding.',
  },
  {
    slug: 'peanut-butter-jaggery-toast',
    title: 'Peanut butter and jaggery toast',
    excerpt: 'Two-minute breakfast that uses the jar properly.',
    category: 'Breakfast',
    servings: 1,
    prepMinutes: 2,
    cookMinutes: 2,
    ingredients: [
      '2 slices of whole-grain toast',
      '1 tbsp peanut butter',
      '1/2 tsp Desi Til Chocolatey Jaggery (the sesame one suits this best)',
      'A pinch of flaky salt',
    ],
    steps: [
      { instruction: 'Toast the bread.' },
      { instruction: 'Spread the peanut butter while the toast is still hot.' },
      { instruction: 'Spoon over the jaggery so it melts against the warmth, then finish with a pinch of salt.' },
    ],
    body: 'The til jar is the one to reach for here — the roasted sesame reads against the peanut and keeps the toast from tasting flat.',
  },
  {
    slug: 'banana-jaggery-smoothie',
    title: 'Banana and jaggery smoothie',
    excerpt: 'Uses it as a sweetener, which is the easiest way to get into it.',
    category: 'Drinks',
    servings: 1,
    prepMinutes: 3,
    cookMinutes: 0,
    ingredients: [
      '1 ripe banana',
      '200 ml milk or water',
      '1/2 tsp Desi Elaichi Chocolatey Jaggery',
      '1 tbsp oats (optional, for thickness)',
      'A squeeze of lemon',
    ],
    steps: [
      { instruction: 'Warm a little of the milk in a pan and stir in the jaggery until it has dissolved.' },
      { instruction: 'Blend the banana, the jaggery milk, the oats and the lemon until smooth.' },
    ],
    body: 'Dissolving the jaggery first keeps the sweetness even instead of leaving gritty bits at the bottom of the glass.',
  },
];

/* -------------------------------------------------------------------------- */
/* Runner                                                                      */
/* -------------------------------------------------------------------------- */

function heading(text: string) {
  console.log(`\n--- ${text} ---`);
}

async function seedProducts() {
  const ids: Record<string, string> = {};

  for (const p of PRODUCTS) {
    // Local photo set: lead shot + gallery. Cloudinary still wins
    // whenever it is configured, because `OptimizedImage` builds
    // the delivery URL for genuine Cloudinary public ids.
    const images = productImages(p.imageAlt, p.gallery);

    const doc = await Product.findOneAndUpdate(
      { slug: p.slug },
      {
        $set: {
          name: p.name,
          slug: p.slug,
          flavour: p.flavour,
          tagline: p.tagline,
          shortDescription: p.shortDescription,
          description: p.description,
          sortOrder: p.sortOrder,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          isActive: true,
          isVerified: true,
          images,
          ogImage: images[0],
        },
        $setOnInsert: {
          ingredients: [],
          allergens: [],
          nutrition: [],
          nutritionPer: { amount: 100, unit: 'g', label: 'Per 100g' },
          storage: '',
          shelfLife: '',
          howToUse: [],
          fssaiNote: '',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();

    ids[p.flavour] = String(doc._id);

    for (const [index, v] of p.variants.entries()) {
      // Only the 500 g pack is sold. The 100 g and 250 g rows exist so the size
      // ladder is ready, but they stay switched off rather than showing a price
      // nobody has agreed to.
      const isSold = v.weightGrams === PACK_WEIGHT_GRAMS;

      await ProductVariant.findOneAndUpdate(
        { sku: v.sku },
        {
          $set: {
            productId: doc._id,
            sku: v.sku,
            weightLabel: v.weightLabel,
            weightGrams: v.weightGrams,
            sortOrder: index,
            isActive: isSold,
            pricePaise: isSold ? PACK_PRICE_PAISE : 0,
            mrpPaise: isSold ? PACK_MRP_PAISE : null,
            inventory: isSold ? PACK_INVENTORY : 0,
            lowStockThreshold: 0,
            packCount: 1,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ).exec();
    }

    console.log(`  product  ${p.name}`);
    console.log(
      `           ${PACK_WEIGHT_LABEL} live @ ₹${PACK_PRICE_PAISE / 100} (MRP ₹${PACK_MRP_PAISE / 100})`,
    );
  }

  return ids;
}

async function seedBundle() {
  const slug = 'trio-bundle';

  // One 500 g jar of each flavour — the only size actually sold.
  const variants = await ProductVariant.find({
    sku: {
      $in: [
        `NCJ-CLASSIC-${PACK_WEIGHT_GRAMS}`,
        `NCJ-TIL-${PACK_WEIGHT_GRAMS}`,
        `NCJ-ELAICHI-${PACK_WEIGHT_GRAMS}`,
      ],
    },
  })
    .sort({ sku: 1 })
    .exec();

  if (variants.length !== 3) {
    console.log('  bundle   skipped (expected 3 base variants)');
    return;
  }

  // Three jars at ₹249 each is ₹747. We do NOT invent a bundle discount, so the
  // bundle price is exactly the sum of its live lines and nothing claims a
  // saving that does not exist.
  const bundlePricePaise = variants.reduce((sum, v) => sum + (v.pricePaise ?? 0), 0);

  await Bundle.findOneAndUpdate(
    { slug },
    {
      $set: {
        name: 'The Trio',
        slug,
        shortDescription: 'One 500 g jar of each flavour — classic, til and elaichi.',
        description:
          'All three flavours, one 500 g jar each. It is the easiest way to find the one you actually want, and the way most people start.',
        isActive: true,
        sortOrder: 1,
        seoTitle: 'The Trio — all three jaggery flavours in one box',
        seoDescription:
          'One 500 g jar each of Desi Chocolatey Jaggery, Desi Til and Desi Elaichi. The easiest way to try the range.',
        lines: variants.map((v) => ({
          productId: v.productId,
          variantId: v._id,
          qty: 1,
        })),
        // The "Save ₹X" figure is derived at read time from the individual
        // prices, never stored — so an out-of-date comparison can never show.
        bundlePricePaise,
      },
      $setOnInsert: {
        compareAtPaise: null,
        image: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).exec();

  console.log('  bundle   The Trio (price 0 → no saving is shown)');
}

async function seedContent() {
  for (const c of CONTENT) {
    const { key, verified, ...rest } = c;
    // No `$setOnInsert`: every optional field already carries a schema default and
    // `setDefaultsOnInsert` applies it, so an extra insert branch could only ever
    // duplicate a `$set` path (which Mongo rejects).
    await Content.findOneAndUpdate(
      { key },
      { $set: { ...rest, isVerified: verified ?? false } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
    console.log(`  content  ${key}${verified ? '' : '  (unverified — flagged in admin)'}`);
  }
}

async function seedFaqs() {
  for (const f of FAQS) {
    await Faq.findOneAndUpdate(
      { question: f.question },
      {
        $set: { ...f, isActive: true, productId: null, helpfulCount: 0, notHelpfulCount: 0 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
  }
  console.log(`  faqs     ${FAQS.length} entries, zero fake "helpful" votes`);
}

async function seedRecipes(productIds: Record<string, string>) {
  const related = [productIds.classic, productIds.til, productIds.elaichi].filter(Boolean);

  for (const [index, r] of RECIPES.entries()) {
    await Recipe.findOneAndUpdate(
      { slug: r.slug },
      {
        $set: {
          title: r.title,
          slug: r.slug,
          excerpt: r.excerpt,
          body: r.body,
          category: r.category,
          servings: r.servings,
          prepMinutes: r.prepMinutes,
          cookMinutes: r.cookMinutes,
          difficulty: 'Easy',
          ingredients: r.ingredients,
          steps: r.steps,
          relatedProductIds: related,
          order: index + 1,
          isActive: true,
          seoTitle: `${r.title} · Nature’s Choice`,
          seoDescription: r.excerpt,
        },
        $setOnInsert: { image: null },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
    console.log(`  recipe   ${r.title}`);
  }
}

async function seedSingletons() {
  await BusinessSettings.findOneAndUpdate(
    {},
    {
      $setOnInsert: SETTINGS_DEFAULTS as never,
    },
    { upsert: true, setDefaultsOnInsert: true },
  ).exec();
  console.log('  settings BusinessSettings created (unverified, no licence numbers)');

  await ShippingConfiguration.findOneAndUpdate(
    {},
    { $setOnInsert: SHIPPING_DEFAULTS as never },
    { upsert: true, setDefaultsOnInsert: true },
  ).exec();
  console.log('  shipping ShippingConfiguration created (from SHIPPING_DEFAULTS — override in Admin → Shipping)');
}

async function main() {
  const applied = loadEnv();
  console.log(
    applied.length
      ? `Loaded ${applied.length} variable(s) from .env file(s).`
      : 'Using variables already present in the environment.',
  );

  requireEnv('MONGODB_URI');
  await connectDb();
  console.log('Connected to MongoDB.');

  heading('Products');
  const productIds = await seedProducts();

  heading('Catalogue');
  await seedBundle();
  await seedContent();
  await seedFaqs();
  await seedRecipes(productIds);

  heading('Singletons');
  await seedSingletons();

  heading('Left empty on purpose');
  console.log('  reviews          — the storefront shows its "no reviews yet" state');
  console.log('  prices / MRP     — 0 paise renders as "Price to be announced"');
  console.log('  inventory        — 0, so nothing can be bought before you set stock');
console.log('  coupons          — no invented discounts');
console.log('  pickup address   — blank until you fill Admin → Shipping');
console.log('  FSSAI / GSTIN    — blank, so nothing is printed as a real licence');

  heading('Next steps in the admin panel');
  console.log('  1. Settings    — enter support contact details, then verify registrations');
  console.log('  2. Products    — upload images, ingredients, nutrition, price and stock');
  console.log('  3. Shipping    — add the pickup address and charges, then enable shipping');
  console.log('  4. Settings    — switch on online payment once Razorpay keys are set');

  await disconnectDb();
}

main().catch(async (err: unknown) => {
  console.error('\nSeed failed:', err instanceof Error ? err.message : err);
  await disconnectDb().catch(() => undefined);
  process.exitCode = 1;
});