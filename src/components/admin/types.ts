/**
 * Response shapes for the `/api/admin/*` surface.
 *
 * These mirror exactly what the routes return. They live in their own file so a
 * route change that alters a payload becomes a compile error in the panel rather
 * than an `undefined` at runtime.
 */

import type { MediaRole } from '@/lib/types';

export interface AdminMediaRef {
  publicId: string;
  url: string;
  secureUrl?: string;
  width: number;
  height: number;
  format?: string;
  bytes?: number;
  role: MediaRole;
  alt: string;
  order: number;
  blurDataUrl?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

export interface IntegrationHealth {
  key: string;
  label: string;
  state: 'configured' | 'missing';
  hint: string;
}

export interface OverviewResponse {
  stats: {
    totalOrders: number;
    paidOrders: number;
    pendingPayment: number;
    failedShippingSync: number;
    deliveredOrders: number;
    revenuePaise: number;
    revenueLast30Paise: number;
    revenueLast7Paise: number;
    averageOrderValuePaise: number;
  };
  catalogue: {
    products: number;
    activeProducts: number;
    unverifiedProducts: number;
    bundles: number;
    faqs: number;
    recipes: number;
    contentDocs: number;
    unverifiedContentKeys: string[];
    contentKeysTotal: number;
    coupons: number;
    activeCoupons: number;
    lowStock: Array<{
      id: string;
      sku: string;
      weightLabel: string;
      inventory: number;
      lowStockThreshold: number;
      productName: string;
    }>;
  };
  moderation: {
    reviewsPending: number;
    reviewsApproved: number;
    contactMessagesNew: number;
  };
  chart: Array<{ date: string; revenuePaise: number }>;
  topProducts: Array<{ _id: string; name: string; qty: number; revenuePaise: number }>;
  recentOrders: Array<{
    orderId: string;
    customer: string;
    totalPaise: number;
    status: string;
    paymentStatus: string;
    shippingStatus: string;
    syncStatus: string;
    createdAt: string;
  }>;
  capabilities: {
    onlinePayments: boolean;
    cod: boolean;
    liveTracking: boolean;
    images: boolean;
  };
  integrations: IntegrationHealth[];
  setupTasks: Array<{
    id: string;
    label: string;
    detail: string;
    severity: 'blocking' | 'important' | 'optional';
    href: string;
  }>;
}

/* -------------------------------------------------------------------------- */
/* Products                                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminProductVariant {
  id: string;
  sku: string;
  weightLabel: string;
  weightGrams: number | null;
  pricePaise: number;
  mrpPaise: number | null;
  inventory: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export interface AdminProductListItem {
  id: string;
  name: string;
  slug: string;
  flavour: 'classic' | 'til';
  tagline: string;
  shortDescription: string;
  isActive: boolean;
  isFeatured: boolean;
  isVerified: boolean;
  sortOrder: number;
  imageCount: number;
  updatedAt: string;
  variants: AdminProductVariant[];
}

export interface AdminProductDetail extends AdminProductListItem {
  description: string;
  ingredients: string[];
  allergens: string[];
  nutrition: Array<{ label: string; per100g?: string; perServing?: string }>;
  nutritionPer: { amount: number; unit: string; label: string };
  storage: string;
  shelfLife: string;
  howToUse: string[];
  fssaiNote: string;
  images: AdminMediaRef[];
  ogImage: AdminMediaRef | null;
  seoTitle: string;
  seoDescription: string;
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export interface AdminOrderRow {
  id: string;
  orderId: string;
  reference: string;
  customerName: string;
  phone: string;
  email: string | null;
  city: string;
  pincode: string;
  itemSummary: string;
  itemCount: number;
  totalPaise: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  razorpayPaymentId: string | null;
  shippingStatus: string;
  syncStatus: string;
  syncError: string | null;
  waybill: string | null;
  hasRefund: boolean;
  createdAt: string;
}

export interface AdminOrderDetail {
  _id: string;
  orderId: string;
  reference: string;
  email: string | null;
  phone: string;
  items: Array<{
    name: string;
    slug: string;
    flavour: string;
    sku: string;
    weightLabel: string;
    imageUrl: string | null;
    unitPricePaise: number;
    mrpPaise: number | null;
    qty: number;
    lineTotalPaise: number;
    bundleName: string | null;
  }>;
  subtotalPaise: number;
  mrpTotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  shippingChargedPaise: number;
  taxPaise: number;
  totalPaise: number;
  amountRefundedPaise: number;
  couponCode: string | null;
  couponDiscountPaise: number | null;
  customerNote: string;
  adminNote: string;
  cancelReason: string | null;
  cancelledAt: string | null;
  deliveredAt: string | null;
  status: string;
  statusHistory: Array<{ status: string; at: string; source: string; note?: string }>;
  payment: {
    method: string;
    status: string;
    amount: number;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    signatureVerified: boolean;
    method_: string | null;
    bank?: string | null;
    cardLast4?: string | null;
    failureReason: string | null;
    failureDescription: string | null;
    refundId: string | null;
    refundAmount: number | null;
    refundedAt: string | null;
  };
  shipping: {
    status: string;
    carrier: string;
    syncStatus: string;
    waybill: string | null;
    trackingUrl: string | null;
    delhiveryRefNo: string | null;
    awbGenerated: boolean;
    lastStatusText: string | null;
    lastSyncedAt: string | null;
    syncError: string | null;
    syncAttempts: number;
    estimatedDeliveryDays: number | null;
    courierCharges: number | null;
    codAmount: number | null;
    statusHistory: Array<{ status: string; at: string; source: string; note?: string }>;
  };
  address: {
    name: string;
    phone: string;
    email?: string;
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    serviceability: string;
  };
  shippingAddress: AdminOrderDetail['address'];
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Reviews, messages                                                           */
/* -------------------------------------------------------------------------- */

export interface AdminReview {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  orderId: string | null;
  authorName: string;
  authorLocation: string;
  rating: number;
  title: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  isVerifiedPurchase: boolean;
  permissionConfirmed: boolean;
  moderationNote: string;
  createdAt: string;
}

export interface AdminMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  source: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'SPAM';
  adminReply: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

export interface AdminBundleLine {
  productId: string;
  productName: string;
  productSlug: string;
  flavour: string | null;
  variantId: string | null;
  variantSku: string | null;
  weightLabel: string;
  unitPricePaise: number | null;
  qty: number;
  resolvable: boolean;
}

export interface AdminBundle {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  image: AdminMediaRef | null;
  lines: AdminBundleLine[];
  bundlePricePaise: number;
  compareAtPaise: number | null;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  savings: { individualTotalPaise: number; bundlePricePaise: number; savingsPaise: number; savingsPercent: number } | null;
}

export interface AdminCoupon {
  id: string;
  code: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  maxDiscountPercentCap: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usageCount: number;
  applicableProductIds: string[];
  isActive: boolean;
  liveState: 'LIVE' | 'SCHEDULED' | 'EXPIRED' | 'LIMIT_REACHED' | 'INACTIVE';
}

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  productId: string | null;
}

export interface AdminRecipe {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: 'Easy' | 'Medium';
  steps: Array<{ instruction: string; durationMinutes?: number; image?: AdminMediaRef | null }>;
  ingredients: string[];
  relatedProductIds: string[];
  image: AdminMediaRef | null;
  body: string;
  order: number;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
}

export interface AdminContentDoc {
  key: string;
  exists: boolean;
  title: string;
  eyebrow: string;
  body: string;
  sections: Array<{
    heading: string;
    body: string;
    bullet: string;
    image?: AdminMediaRef | null;
    verified: boolean;
  }>;
  items: Array<Record<string, unknown>>;
  images: AdminMediaRef[];
  faqCategory: string;
  seoTitle: string;
  seoDescription: string;
  isVerified: boolean;
  updatedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Settings, shipping, customers                                               */
/* -------------------------------------------------------------------------- */

export interface AdminBusinessSettings {
  brandName: string;
  legalName: string;
  tagline: string;
  description: string;
  supportPhone: string;
  supportEmail: string;
  whatsappNumber: string;
  businessAddressLine1: string;
  businessAddressLine2: string;
  businessCity: string;
  businessState: string;
  businessPincode: string;
  businessCountry: string;
  businessHours: string;
  fssaiNumber: string;
  gstNumber: string;
  cinNumber: string;
  onlinePaymentEnabled: boolean;
  razorpayDisplayName: string;
  currency: string;
  announcement: string;
  social: {
    instagram: string;
    facebook: string;
    youtube: string;
    x: string;
    linkedin: string;
  };
  notifications: {
    emailEnabled: boolean;
    emailFrom: string;
    emailFromName: string;
    smsEnabled: boolean;
    smsProvider: string;
    whatsappEnabled: boolean;
    whatsappNumber: string;
    providerEndpoint: string;
  };
  defaultOgImageUrl: string;
  twitterHandle: string;
  instagramHandle: string;
  logo: AdminMediaRef | null;
  isVerified: boolean;
}

export interface AdminShippingConfig {
  pickupName: string;
  pickupAddressLine1: string;
  pickupAddressLine2: string;
  pickupCity: string;
  pickupState: string;
  pickupPincode: string;
  pickupCountry: string;
  pickupContactName: string;
  pickupContactPhone: string;
  pickupEmail: string;

  serviceabilityMode: 'DELHIVERY_API' | 'LIST' | 'DISABLED';
  serviceablePincodes: string[];
  blockedPincodes: string[];

  shippingDisabledMessage: string;
  unserviceableMessage: string;
  unknownPincodeMessage: string;
  shippingPolicyNote: string;

  shippingEnabled: boolean;
  flatShippingPaise: number;
  freeShippingEnabled: boolean;
  freeShippingThresholdPaise: number | null;
  weightBasedShipping: boolean;
  weightRatePaisePerKg: number;
  handlingPaise: number;
  maxWeightPerOrderGrams: number;

  showEstimatedDelivery: boolean;
  defaultEstimatedDeliveryDaysMin: number | null;
  defaultEstimatedDeliveryDaysMax: number | null;

  codEnabled: boolean;
  codMaxOrderPaise: number | null;
  codHandlingPaise: number;

  taxEnabled: boolean;
  taxInclusive: boolean;
  taxPercent: number;

  allowCancellation: boolean;
  cancelWindowHours: number;
}

export interface AdminCustomer {
  key: string;
  name: string;
  phone: string;
  email: string | null;
  orderCount: number;
  totalPaise: number;
  paidPaise: number;
  lastOrderAt: string;
  cities: string[];
}

export interface AdminStaffUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'SUPPORT';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}