/**
 * Shared domain types + enum unions used by both Mongoose schemas and the
 * TypeScript layer. Single source of truth so a status string can never drift
 * between the model, the API, the admin UI and the customer tracking page.
 */

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

export const MEDIA_ROLES = [
  'front_pack',
  'open_jar',
  'texture_closeup',
  'ingredients',
  'serving',
  'lifestyle',
  'back_label',
  'gallery',
  'logo',
  'founder',
  'process',
  'recipe',
  'ugc',
  'review',
  'og_image',
] as const;
export type MediaRole = (typeof MEDIA_ROLES)[number];

/**
 * Cloudinary reference. We never store image bytes in MongoDB — only the
 * delivery URL, public id and the transformation hints we need to build
 * responsive srcsets on the client.
 */
export interface MediaRef {
  publicId: string;
  url: string;
  secureUrl?: string;
  width: number;
  height: number;
  format?: string;
  bytes?: number;
  role: MediaRole;
  alt: string;
  /** 1..n; lowest number is treated as the primary image. */
  order: number;
  blurDataUrl?: string;
}

/* -------------------------------------------------------------------------- */
/* Products & variants                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The flavours actually in the catalogue.
 *
 * Derived from the real product listings, not from a wish list. Adding a name
 * here without a corresponding product would put a flavour on the storefront
 * that nobody can buy.
 */
export const PRODUCT_FLAVOURS = ['classic', 'til', 'elaichi'] as const;
export type ProductFlavour = (typeof PRODUCT_FLAVOURS)[number];

export interface NutritionRow {
  label: string;
  per100g?: string;
  perServing?: string;
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export const ORDER_STATUS = [
  'ORDER_PLACED',
  'PAYMENT_PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const PAYMENT_STATUS = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PAYMENT_METHODS = ['RAZORPAY', 'COD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SHIPPING_STATUS = [
  'NOT_APPLICABLE',
  'PENDING',
  'CREATING',
  'CREATED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'SYNC_FAILED',
] as const;
export type ShippingStatus = (typeof SHIPPING_STATUS)[number];

export const SYNC_STATUS = ['IDLE', 'PENDING', 'SUCCESS', 'FAILED'] as const;
export type SyncStatus = (typeof SYNC_STATUS)[number];

/** States that must never be invented by the client or by optimism. */
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

/** Statuses an admin is allowed to set manually (guarded server-side). */
export const ADMIN_SETTABLE_STATUSES: OrderStatus[] = [
  'ORDER_PLACED',
  'PAYMENT_PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

/* -------------------------------------------------------------------------- */
/* Shipping                                                                   */
/* -------------------------------------------------------------------------- */

export const SERVICEABILITY = ['SERVICEABLE', 'UNSERVICEABLE', 'UNKNOWN'] as const;
export type Serviceability = (typeof SERVICEABILITY)[number];

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

export const REVIEW_STATUS = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[number];

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

export const CONTENT_KEYS = [
  'home_hero',
  'home_trust',
  'home_three_flavours',
  'home_why',
  'home_featured',
  'home_process',
  'home_story',
  'home_reviews',
  'home_ugc',
  'home_bundle',
  'home_recipes',
  'home_faq',
  'home_final_cta',
  'our_story',
  'why_natures_choice',
  'policies_shipping',
  'policies_cancellation_refund_return',
  'policies_privacy',
  'policies_terms',
  'cookie_policy',
  'contact',
] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

/**
 * `verified: false` means the copy/value is a clearly-marked editable
 * placeholder. The storefront renders it, the admin flags it, and it is never
 * presented as a verified business fact (no invented GSTIN, FSSAI, reviews,
 * certifications, sales figures or founder biography).
 */
export interface ContentDoc {
  key: ContentKey;
  title?: string;
  eyebrow?: string;
  body?: string;
  sections?: Array<{
    heading?: string;
    body?: string;
    bullet?: string;
    image?: MediaRef;
    verified?: boolean;
  }>;
  faqRef?: string;
  items?: Array<Record<string, unknown>>;
  images?: MediaRef[];
  seoTitle?: string;
  seoDescription?: string;
  updatedAt: Date;
}
