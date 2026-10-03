import { Schema, model, models, type Model } from 'mongoose';
import { MediaSchema } from './media';
import { connectDb } from '../db';
import { serverEnv } from '../env';
import type { MediaRef } from '../types';

export interface SocialLinks {
  instagram: string;
  facebook: string;
  youtube: string;
  x: string;
  linkedin: string;
}

export interface NotificationChannels {
  /**
   * Every channel is a *capability flag*, never a claim. The storefront only
   * says "email confirmation" style copy for a channel that is actually true,
   * and admin sees a clear "not connected" state otherwise.
   */
  emailEnabled: boolean;
  emailFrom: string;
  emailFromName: string;
  smsEnabled: boolean;
  smsProvider: string;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  /** Free-form provider webhook config kept server-side by design. */
  providerEndpoint: string;
}

export interface BusinessSettingsDoc {
  _id: any;

  /* --- Identity --------------------------------------------------------- */
  brandName: string;
  legalName: string;
  tagline: string;
  description: string;

  /* --- Contact (only rendered when non-empty) --------------------------- */
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

  /* --- Registrations (only rendered when non-empty) --------------------- */
  fssaiNumber: string;
  gstNumber: string;
  cinNumber: string;

  /* --- Payments / fulfilment capability flags --------------------------- */
  onlinePaymentEnabled: boolean;
  razorpayDisplayName: string;

  /* --- Commerce --------------------------------------------------------- */
  currency: string;
  announcement: string;

  /* --- Social ----------------------------------------------------------- */
  social: SocialLinks;

  /* --- Notifications ---------------------------------------------------- */
  notifications: NotificationChannels;

  /* --- SEO -------------------------------------------------------------- */
  defaultOgImageUrl: string;
  twitterHandle: string;
  instagramHandle: string;
  /** Cloudinary-hosted wordmark / monogram used in the header + structured data. */
  logo: MediaRef | null;

  /**
   * False until a human confirms the legal / registration values above.
   * Footer and policy pages use this to avoid printing unverified specifics.
   */
  isVerified: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const SocialLinksSchema = new Schema<SocialLinks>(
  {
    instagram: { type: String, default: '', trim: true },
    facebook: { type: String, default: '', trim: true },
    youtube: { type: String, default: '', trim: true },
    x: { type: String, default: '', trim: true },
    linkedin: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const NotificationChannelsSchema = new Schema<NotificationChannels>(
  {
    emailEnabled: { type: Boolean, default: false },
    emailFrom: { type: String, default: '', trim: true, lowercase: true },
    emailFromName: { type: String, default: '', trim: true },
    smsEnabled: { type: Boolean, default: false },
    smsProvider: { type: String, default: '', trim: true },
    whatsappEnabled: { type: Boolean, default: false },
    whatsappNumber: { type: String, default: '', trim: true },
    providerEndpoint: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const BusinessSettingsSchema = new Schema<BusinessSettingsDoc>(
  {
    brandName: { type: String, default: "Nature's Choice Jaggery", trim: true },
    legalName: { type: String, default: '', trim: true },
    tagline: { type: String, default: 'The New Age of Indian Jaggery', trim: true },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },

    supportPhone: { type: String, default: '', trim: true },
    supportEmail: { type: String, default: '', trim: true, lowercase: true },
    whatsappNumber: { type: String, default: '', trim: true },
    businessAddressLine1: { type: String, default: '', trim: true },
    businessAddressLine2: { type: String, default: '', trim: true },
    businessCity: { type: String, default: '', trim: true },
    businessState: { type: String, default: '', trim: true },
    businessPincode: { type: String, default: '', trim: true },
    businessCountry: { type: String, default: 'India', trim: true },
    businessHours: { type: String, default: '', trim: true },

    fssaiNumber: { type: String, default: '', trim: true },
    gstNumber: { type: String, default: '', trim: true },
    cinNumber: { type: String, default: '', trim: true },

    onlinePaymentEnabled: { type: Boolean, default: false },
    razorpayDisplayName: { type: String, default: '', trim: true },

    currency: { type: String, default: 'INR' },
    announcement: {
      type: String,
      default: 'PAN INDIA DELIVERY | SECURE PAYMENTS | CUSTOMER SUPPORT',
      trim: true,
    },

    social: { type: SocialLinksSchema, default: () => ({}) },
    notifications: { type: NotificationChannelsSchema, default: () => ({}) },

    defaultOgImageUrl: { type: String, default: '', trim: true },
    twitterHandle: { type: String, default: '', trim: true },
    instagramHandle: { type: String, default: '', trim: true },
    logo: { type: MediaSchema, default: null },

    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'businesssettings' },
);

export const BusinessSettings =
  (models.BusinessSettings as Model<BusinessSettingsDoc>) ||
  model<BusinessSettingsDoc>('BusinessSettings', BusinessSettingsSchema);

export const SETTINGS_DEFAULTS: Omit<BusinessSettingsDoc, '_id' | 'createdAt' | 'updatedAt'> = {
  brandName: "Nature's Choice Jaggery",
  legalName: '',
  tagline: 'The New Age of Indian Jaggery',
  description: '',

  supportPhone: '',
  supportEmail: '',
  whatsappNumber: '',
  businessAddressLine1: '',
  businessAddressLine2: '',
  businessCity: '',
  businessState: '',
  businessPincode: '',
  businessCountry: 'India',
  businessHours: '',

  fssaiNumber: '',
  gstNumber: '',
  cinNumber: '',

  // Online payments are offered whenever Razorpay is actually connected. The
  // flag is an emergency switch an admin can still flip in Admin → Settings; it
  // is no longer something a new install has to remember to turn on.
  onlinePaymentEnabled: serverEnv.commerce.onlinePaymentEnabled,
  razorpayDisplayName: '',

  currency: 'INR',
  announcement: 'PAN INDIA DELIVERY | SECURE PAYMENTS | CUSTOMER SUPPORT',

  social: { instagram: '', facebook: '', youtube: '', x: '', linkedin: '' },
  notifications: {
    emailEnabled: false,
    emailFrom: '',
    emailFromName: '',
    smsEnabled: false,
    smsProvider: '',
    whatsappEnabled: false,
    whatsappNumber: '',
    providerEndpoint: '',
  },

  defaultOgImageUrl: '',
  twitterHandle: '',
  instagramHandle: '',
  logo: null,

  isVerified: false,
};

let settingsCache: { value: BusinessSettingsDoc; at: number } | null = null;
const CACHE_MS = 30_000;

/**
 * A settings document created by an older build had `onlinePaymentEnabled:
 * false` and no other distinguishing edits. If that is all that changed, switch
 * online payments on so checkout is not silently dead. Any document an admin has
 * actually customised is left exactly as it is.
 */
async function upgradeLegacyPaymentFlag(
  doc: BusinessSettingsDoc,
): Promise<BusinessSettingsDoc> {
  if (doc.onlinePaymentEnabled !== false) return doc;
  if (!serverEnv.commerce.onlinePaymentEnabled) return doc;

  const touched =
    (doc.legalName ?? '') !== '' ||
    (doc.gstNumber ?? '') !== '' ||
    (doc.fssaiNumber ?? '') !== '' ||
    (doc.cinNumber ?? '') !== '' ||
    (doc.announcement ?? '') !== '' ||
    doc.isVerified === true ||
    (doc.notifications?.emailEnabled ?? false) === true;

  if (touched) return doc;

  await BusinessSettings.updateOne({ _id: doc._id }, { $set: { onlinePaymentEnabled: true } }).exec();
  return { ...doc, onlinePaymentEnabled: true };
}

export async function getBusinessSettings(
  opts: { fresh?: boolean } = {},
): Promise<BusinessSettingsDoc> {
  if (!opts.fresh && settingsCache && Date.now() - settingsCache.at < CACHE_MS) {
    return settingsCache.value;
  }
  await connectDb();
  let doc = (await BusinessSettings.findOne({}).lean().exec()) as BusinessSettingsDoc | null;
  if (!doc) {
    doc = (await BusinessSettings.create(SETTINGS_DEFAULTS)).toObject() as BusinessSettingsDoc;
  } else {
    doc = await upgradeLegacyPaymentFlag(doc);
  }
  settingsCache = { value: doc, at: Date.now() };
  return doc;
}

export function invalidateSettingsCache(): void {
  settingsCache = null;
}
