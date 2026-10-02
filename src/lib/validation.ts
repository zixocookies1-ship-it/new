import { z } from 'zod';
import { MEDIA_ROLES, PRODUCT_FLAVOURS } from './types';

/**
 * All server-side input validation lives here.
 * Anything arriving from a browser is treated as hostile until it passes one of
 * these schemas.
 */

export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier.');

export const phoneIN = z
  .string()
  .trim()
  .min(10, 'Enter a valid mobile number.')
  .max(15, 'Enter a valid mobile number.')
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(?:\+?91)?[6-9]\d{9}$/.test(v), 'Enter a valid Indian mobile number.')
  .transform((v) => (v.startsWith('+') ? `+${v}` : v.replace(/^0+(?=\d{10}$)/, '')));

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v), 'Enter a valid email address.');

export const pincodeIN = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code.');

export const orderIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^NC-[0-9A-HJ-KM-NP-TV-Z]{10}$/i, 'Enter a valid order ID (e.g. NC-XXXXXXXXXX).');

/* -------------------------------------------------------------------------- */
/* Cart / checkout                                                            */
/* -------------------------------------------------------------------------- */

export const cartLineSchema = z.object({
  productId: objectId,
  variantId: objectId,
  qty: z.coerce.number().int().min(1).max(20),
});

export const bundleLineSchema = z.object({
  bundleId: objectId,
  qty: z.coerce.number().int().min(1).max(20),
});

export const addressSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name.').max(120),
  phone: phoneIN,
  alternatePhone: z
    .string()
    .trim()
    .max(15)
    .optional()
    .or(z.literal('')),
  email: z.union([email, z.literal('')]).optional(),
  line1: z.string().trim().min(4, 'Enter the house / street address.').max(240),
  line2: z.string().trim().max(240).optional().or(z.literal('')),
  landmark: z.string().trim().max(160).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Enter the city.').max(80),
  state: z.string().trim().min(2, 'Enter the state.').max(80),
  pincode: pincodeIN,
  country: z.string().trim().max(60).optional().or(z.literal('')),
});

export const createOrderSchema = z.object({
  lines: z.array(cartLineSchema).max(30).default([]),
  bundles: z.array(bundleLineSchema).max(10).default([]),
  couponCode: z.string().trim().max(40).optional().nullable(),
  paymentMethod: z.enum(['RAZORPAY', 'COD']),
  address: addressSchema,
  customerNote: z.string().trim().max(1000).optional().or(z.literal('')),
  clientCheckoutToken: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid checkout token.'),
});

export const couponValidateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  lines: z.array(cartLineSchema).max(30).default([]),
  bundles: z.array(bundleLineSchema).max(10).default([]),
  paymentMethod: z.enum(['RAZORPAY', 'COD']).default('RAZORPAY'),
});

export const quoteSchema = z.object({
  lines: z.array(cartLineSchema).max(30).default([]),
  bundles: z.array(bundleLineSchema).max(10).default([]),
  couponCode: z.string().trim().max(40).optional().nullable(),
  paymentMethod: z.enum(['RAZORPAY', 'COD']).optional(),
});

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

export const verifyPaymentSchema = z.object({
  orderId: z.string().trim().min(4).max(40),
  razorpayOrderId: z.string().trim().min(4).max(100),
  razorpayPaymentId: z.string().trim().min(4).max(100),
  razorpaySignature: z.string().trim().min(16).max(256),
});

/* -------------------------------------------------------------------------- */
/* Public endpoints                                                           */
/* -------------------------------------------------------------------------- */

export const serviceabilitySchema = z.object({
  pincode: pincodeIN,
  weightGrams: z.coerce.number().int().min(0).max(100000).optional(),
});

export const trackOrderSchema = z.object({
  orderId: orderIdSchema,
  /** Required verification: the email or mobile on the order. */
  contact: z.string().trim().min(4, 'Enter the email or mobile used for this order.').max(160),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  email: email,
  phone: z
    .string()
    .trim()
    .min(10, 'Enter a valid mobile number.')
    .max(15)
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => /^(?:\+?91)?[6-9]\d{9}$/.test(v), 'Enter a valid Indian mobile number.'),
  subject: z.string().trim().min(2, 'Enter a subject.').max(160),
  message: z.string().trim().min(10, 'Tell us a little more.').max(4000),
  // Honeypot: real people never fill this hidden field.
  website: z.string().max(0).optional().or(z.literal('')),
});

export const reviewSubmitSchema = z.object({
  productId: objectId,
  orderId: orderIdSchema.optional(),
  contact: z.string().trim().min(4).max(160).optional(),
  authorName: z.string().trim().min(2, 'Enter your name.').max(100),
  authorLocation: z.string().trim().max(120).optional().or(z.literal('')),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(160).optional().or(z.literal('')),
  body: z.string().trim().min(10, 'Please share a few more words.').max(3000),
  website: z.string().max(0).optional().or(z.literal('')),
});

export const cancelOrderSchema = z.object({
  orderId: orderIdSchema,
  contact: z.string().trim().min(4).max(160),
  reason: z.string().trim().min(3, 'Please tell us why.').max(500),
});

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: email,
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(200)
    .regex(/[a-z]/, 'Include a lowercase letter.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/\d/, 'Include a number.'),
});

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

const mediaSchema = z.object({
  publicId: z.string().trim().min(3).max(300),
  url: z.string().trim().url().max(500),
  width: z.coerce.number().int().min(1).max(20000),
  height: z.coerce.number().int().min(1).max(20000),
  format: z.string().trim().max(20).optional(),
  bytes: z.coerce.number().int().min(0).optional(),
  role: z.enum(MEDIA_ROLES).default('gallery'),
  alt: z.string().trim().min(1, 'Alt text is required.').max(240),
  order: z.coerce.number().int().min(1).max(50).default(1),
  blurDataUrl: z.string().trim().max(2000).optional(),
});

const variantSchema = z.object({
  _id: objectId.optional(),
  sku: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9-_]+$/, 'SKU may contain letters, numbers, - and _.')
    .transform((v) => v.toUpperCase()),
  weightLabel: z.string().trim().min(1).max(64),
  weightGrams: z.coerce.number().int().min(1).max(100000).optional(),
  pricePaise: z.coerce.number().int().min(0).max(100_000_000),
  mrpPaise: z.coerce.number().int().min(0).max(100_000_000).nullable().optional(),
  inventory: z.coerce.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const productUpsertSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.'),
  flavour: z.enum(PRODUCT_FLAVOURS),
  tagline: z.string().trim().max(200).default(''),
  shortDescription: z.string().trim().min(10).max(320),
  description: z.string().trim().min(20),
  ingredients: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  allergens: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  nutrition: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        per100g: z.string().trim().max(60).optional(),
        perServing: z.string().trim().max(60).optional(),
      }),
    )
    .max(40)
    .default([]),
  nutritionPer: z
    .object({
      amount: z.coerce.number().min(0).default(100),
      unit: z.string().trim().max(12).default('g'),
      label: z.string().trim().max(40).default('Per 100g'),
    })
    .default({ amount: 100, unit: 'g', label: 'Per 100g' }),
  storage: z.string().trim().max(600).default(''),
  shelfLife: z.string().trim().max(200).default(''),
  howToUse: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
  fssaiNote: z.string().trim().max(400).default(''),
  images: z.array(mediaSchema).max(20).default([]),
  ogImage: mediaSchema.nullable().optional(),
  /** Other sales channels. Recorded for the merchant; never rendered as a CTA. */
  marketplace: z
    .object({
      asin: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^B0[A-Z0-9]{8}$/, 'Use the 10-character Amazon ASIN, or leave blank.')
        .max(16)
        .or(z.literal(''))
        .transform((v) => v || null)
        .nullable()
        .default(null),
      url: z
        .string()
        .trim()
        .max(500)
        .url('Enter a full https:// URL.')
        .or(z.literal(''))
        .transform((v) => v || null)
        .nullable()
        .default(null),
      questionsUrl: z
        .string()
        .trim()
        .max(500)
        .url('Enter a full https:// URL.')
        .or(z.literal(''))
        .transform((v) => v || null)
        .nullable()
        .default(null),
    })
    .default({ asin: null, url: null, questionsUrl: null }),
  variants: z.array(variantSchema).min(1, 'Add at least one pack size.').max(12),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  seoTitle: z.string().trim().max(180).default(''),
  seoDescription: z.string().trim().max(320).default(''),
});

export const bundleUpsertSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.'),
  shortDescription: z.string().trim().min(10).max(320),
  description: z.string().trim().max(4000).default(''),
  image: mediaSchema.nullable().optional(),
  lines: z
    .array(
      z.object({
        productId: objectId,
        variantId: objectId.nullable().optional(),
        qty: z.coerce.number().int().min(1).max(20).default(1),
      }),
    )
    .min(1, 'A bundle needs at least one product.')
    .max(12),
  bundlePricePaise: z.coerce.number().int().min(0).max(100_000_000),
  compareAtPaise: z.coerce.number().int().min(0).max(100_000_000).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  seoTitle: z.string().trim().max(180).default(''),
  seoDescription: z.string().trim().max(320).default(''),
});

export const couponUpsertSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, 'Use letters, numbers, - and _ only.'),
  description: z.string().trim().max(300).default(''),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.coerce.number().min(0),
  maxDiscountPaise: z.coerce.number().int().min(0).max(100_000_000).nullable().optional(),
  minOrderPaise: z.coerce.number().int().min(0).max(100_000_000).default(0),
  maxDiscountPercentCap: z.coerce.number().min(0).max(100).nullable().optional(),
  startsAt: z.coerce.string().datetime().nullable().optional(),
  expiresAt: z.coerce.string().datetime().nullable().optional(),
  usageLimit: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
  perUserLimit: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
  applicableProductIds: z.array(objectId).max(40).default([]),
  isActive: z.boolean().default(true),
});

export const faqUpsertSchema = z.object({
  question: z.string().trim().min(4).max(300),
  answer: z.string().trim().min(10).max(6000),
  category: z.string().trim().min(1).max(80),
  order: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  productId: objectId.nullable().optional(),
});

export const contentUpsertSchema = z.object({
  title: z.string().trim().max(240).default(''),
  eyebrow: z.string().trim().max(120).default(''),
  body: z.string().trim().max(20000).default(''),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().max(240).default(''),
        body: z.string().trim().max(4000).default(''),
        bullet: z.string().trim().max(240).default(''),
        image: mediaSchema.nullable().optional(),
        verified: z.boolean().default(false),
      }),
    )
    .max(30)
    .default([]),
  items: z.array(z.record(z.unknown())).max(60).default([]),
  images: z.array(mediaSchema).max(30).default([]),
  faqCategory: z.string().trim().max(80).default(''),
  seoTitle: z.string().trim().max(180).default(''),
  seoDescription: z.string().trim().max(320).default(''),
  isVerified: z.boolean().default(false),
});

export const recipeUpsertSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.'),
  excerpt: z.string().trim().min(10).max(400),
  body: z.string().trim().max(20000).default(''),
  image: mediaSchema.nullable().optional(),
  category: z.string().trim().min(1).max(80).default('Ways to enjoy'),
  servings: z.coerce.number().int().min(1).max(50).default(2),
  prepMinutes: z.coerce.number().int().min(0).max(1440).default(5),
  cookMinutes: z.coerce.number().int().min(0).max(1440).default(5),
  difficulty: z.enum(['Easy', 'Medium']).default('Easy'),
  steps: z
    .array(
      z.object({
        instruction: z.string().trim().min(3).max(1000),
        durationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
        image: mediaSchema.nullable().optional(),
      }),
    )
    .max(30)
    .default([]),
  ingredients: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  relatedProductIds: z.array(objectId).max(12).default([]),
  order: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().trim().max(180).default(''),
  seoDescription: z.string().trim().max(320).default(''),
});

export const reviewModerationSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  isVerifiedPurchase: z.boolean().optional(),
  permissionConfirmed: z.boolean().optional(),
  moderationNote: z.string().trim().max(500).optional(),
});

export const orderStatusUpdateSchema = z.object({
  orderId: z.string().trim().min(4).max(40),
  status: z.enum([
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
  ]),
  note: z.string().trim().max(1000).optional(),
});

export const refundSchema = z.object({
  orderId: z.string().trim().min(4).max(40),
  amountPaise: z.coerce.number().int().min(1).max(100_000_000),
  reason: z.string().trim().max(300).optional(),
});

export const adminListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  paymentStatus: z.string().trim().max(40).optional(),
  shippingStatus: z.string().trim().max(40).optional(),
  syncStatus: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const settingsUpdateSchema = z
  .object({
    brandName: z.string().trim().max(120),
    legalName: z.string().trim().max(200),
    tagline: z.string().trim().max(200),
    description: z.string().trim().max(1000),
    supportPhone: z.string().trim().max(24),
    supportEmail: z.string().trim().max(160),
    whatsappNumber: z.string().trim().max(24),
    businessAddressLine1: z.string().trim().max(240),
    businessAddressLine2: z.string().trim().max(240),
    businessCity: z.string().trim().max(80),
    businessState: z.string().trim().max(80),
    businessPincode: z.string().trim().max(10),
    businessCountry: z.string().trim().max(60),
    businessHours: z.string().trim().max(160),
    fssaiNumber: z.string().trim().max(40),
    gstNumber: z.string().trim().max(40),
    cinNumber: z.string().trim().max(40),
    onlinePaymentEnabled: z.boolean(),
    razorpayDisplayName: z.string().trim().max(80),
    announcement: z.string().trim().max(200),
    defaultOgImageUrl: z.string().trim().max(500),
    twitterHandle: z.string().trim().max(60),
    instagramHandle: z.string().trim().max(60),
    /**
     * Cloudinary-hosted wordmark. Only the URL and publicId are stored — image
     * bytes never enter MongoDB.
     */
    logo: mediaSchema.nullable().optional(),
    isVerified: z.boolean(),
    social: z.object({
      instagram: z.string().trim().max(200),
      facebook: z.string().trim().max(200),
      youtube: z.string().trim().max(200),
      x: z.string().trim().max(200),
      linkedin: z.string().trim().max(200),
    }),
    notifications: z.object({
      emailEnabled: z.boolean(),
      emailFrom: z.string().trim().max(160),
      emailFromName: z.string().trim().max(120),
      smsEnabled: z.boolean(),
      smsProvider: z.string().trim().max(80),
      whatsappEnabled: z.boolean(),
      whatsappNumber: z.string().trim().max(24),
      providerEndpoint: z.string().trim().max(500),
    }),
  })
  .partial();

export const shippingConfigSchema = z
  .object({
    pickupName: z.string().trim().max(120),
    pickupAddressLine1: z.string().trim().max(240),
    pickupAddressLine2: z.string().trim().max(240),
    pickupCity: z.string().trim().max(80),
    pickupState: z.string().trim().max(80),
    pickupPincode: z.string().trim().max(6),
    pickupCountry: z.string().trim().max(60),
    pickupContactName: z.string().trim().max(120),
    pickupContactPhone: z.string().trim().max(24),
    pickupEmail: z.string().trim().max(160),

    serviceabilityMode: z.enum(['DELHIVERY_API', 'LIST', 'DISABLED']),
    serviceablePincodes: z.array(z.string().trim().regex(/^\d{6}$/)).max(5000),
    blockedPincodes: z.array(z.string().trim().regex(/^\d{6}$/)).max(5000),

    shippingEnabled: z.boolean(),
    flatShippingPaise: z.coerce.number().int().min(0).max(100_000_000),
    freeShippingEnabled: z.boolean(),
    freeShippingThresholdPaise: z.coerce.number().int().min(0).max(100_000_000).nullable(),
    weightBasedShipping: z.boolean(),
    weightRatePaisePerKg: z.coerce.number().int().min(0).max(100_000_000),
    handlingPaise: z.coerce.number().int().min(0).max(100_000_000),
    maxWeightPerOrderGrams: z.coerce.number().int().min(0).max(1_000_000),

    showEstimatedDelivery: z.boolean(),
    defaultEstimatedDeliveryDaysMin: z.coerce.number().int().min(0).max(90).nullable(),
    defaultEstimatedDeliveryDaysMax: z.coerce.number().int().min(0).max(90).nullable(),

    codEnabled: z.boolean(),
    codMaxOrderPaise: z.coerce.number().int().min(0).max(100_000_000).nullable(),
    codHandlingPaise: z.coerce.number().int().min(0).max(100_000_000),

    taxEnabled: z.boolean(),
    taxInclusive: z.boolean(),
    taxPercent: z.coerce.number().min(0).max(100),

    allowCancellation: z.boolean(),
    cancelWindowHours: z.coerce.number().int().min(0).max(720),
  })
  .partial();

export const userUpsertSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  role: z.enum(['ADMIN', 'EDITOR', 'SUPPORT']),
  isActive: z.boolean().default(true),
  /** Only required when creating. */
  password: z.string().min(10).max(200).optional().or(z.literal('')),
});

export const userPasswordResetSchema = z.object({
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(200)
    .regex(/[a-z]/, 'Include a lowercase letter.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/\d/, 'Include a number.'),
});

export const contactStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM']),
  adminReply: z.string().trim().max(2000).optional(),
});

/**
 * Derived from the shared MEDIA_ROLES union so an uploaded role can never be a
 * value the Mongoose `MediaRef.role` enum will reject at write time.
 */
export const mediaRoleSchema = z.enum(MEDIA_ROLES);

export const mediaUploadMetaSchema = z.object({
  role: mediaRoleSchema.default('gallery'),
  alt: z.string().trim().min(1, 'Alt text is required.').max(240),
  /** Optional folder prefix inside the Cloudinary account. */
  folder: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-zA-Z0-9/_-]*$/, 'Folder may contain letters, numbers, /, - and _ only.')
    .optional()
    .or(z.literal('')),
});

export const adminRoleSchema = z.enum(['ADMIN', 'EDITOR', 'SUPPORT']);

/** Catalogue listing filter used by /api/products and the admin product table. */
export const productListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  flavour: z.enum(PRODUCT_FLAVOURS).optional(),
  featured: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'name']).default('newest'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  admin: z.coerce.boolean().default(false),
});

export const idParamSchema = z.object({ id: objectId });
export const slugParamSchema = z.object({ slug: z.string().trim().min(1).max(200) });
export const orderIdParamSchema = z.object({
  orderId: z.string().trim().min(4).max(40),
});
