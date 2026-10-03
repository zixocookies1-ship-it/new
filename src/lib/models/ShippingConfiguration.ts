import { Schema, model, models, type Model } from 'mongoose';
import { connectDb } from '../db';
import { serverEnv } from '../env';

/**
 * Shipping + tax configuration.
 *
 * Every knob the storefront and the pricing engine need lives here so that
 * the site never hardcodes a shipping promise it cannot honour. Notably:
 *  - `freeShippingEnabled` gates the "₹X more to unlock free shipping" nudge
 *  - `codEnabled` must be true for COD to be offered at checkout
 *  - `serviceabilityMode` decides whether a PIN check hits Delhivery or uses
 *    the admin-maintained list, so we never fabricate delivery dates
 */
export interface ShippingConfigurationDoc {
  _id: any;

  /* --- Origin (Delhivery pickup) ---------------------------------------- */
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

  /* --- Pincodes --------------------------------------------------------- */
  serviceabilityMode: 'DELHIVERY_API' | 'LIST' | 'DISABLED';
  /** Used when serviceabilityMode === 'LIST' */
  serviceablePincodes: string[];
  /** Never serviceable, even if the courier would accept them. */
  blockedPincodes: string[];

  /* --- Customer-facing copy (editable, no promises we cannot keep) ------ */
  /** Shown when `shippingEnabled` is false. */
  shippingDisabledMessage: string;
  /** Shown when a PIN is confirmed undeliverable. */
  unserviceableMessage: string;
  /** Shown when the courier could not give a definite answer. */
  unknownPincodeMessage: string;
  /** Optional merchant note about shipping; empty means "not written yet". */
  shippingPolicyNote: string;

  /* --- Charges ---------------------------------------------------------- */
  shippingEnabled: boolean;
  flatShippingPaise: number;
  freeShippingEnabled: boolean;
  freeShippingThresholdPaise: number | null;
  /** Per-gram surcharge, applied as ceil(weightG * rate). */
  weightBasedShipping: boolean;
  weightRatePaisePerKg: number;
  handlingPaise: number;
  maxWeightPerOrderGrams: number;

  /* --- Estimates (only shown when the courier supports them) ------------- */
  showEstimatedDelivery: boolean;
  defaultEstimatedDeliveryDaysMin: number | null;
  defaultEstimatedDeliveryDaysMax: number | null;

  /* --- COD -------------------------------------------------------------- */
  codEnabled: boolean;
  codMaxOrderPaise: number | null;
  codHandlingPaise: number;

  /* --- Tax -------------------------------------------------------------- */
  taxEnabled: boolean;
  taxInclusive: boolean;
  taxPercent: number;

  /* --- Behaviour -------------------------------------------------------- */
  allowCancellation: boolean;
  cancelWindowHours: number;

  /**
   * Bumped whenever the shipped defaults change. Used to bring a database that
   * was created by an older build up to date *without* overwriting anything an
   * admin has since configured.
   */
  configVersion: number;

  createdAt: Date;
  updatedAt: Date;
}

/** Current shipped defaults. Bump this whenever `SHIPPING_DEFAULTS` changes. */
export const SHIPPING_CONFIG_VERSION = 2;

const ShippingConfigurationSchema = new Schema<ShippingConfigurationDoc>(
  {
    pickupName: { type: String, default: '' },
    pickupAddressLine1: { type: String, default: '' },
    pickupAddressLine2: { type: String, default: '' },
    pickupCity: { type: String, default: '' },
    pickupState: { type: String, default: '' },
    pickupPincode: { type: String, default: '' },
    pickupCountry: { type: String, default: 'India' },
    pickupContactName: { type: String, default: '' },
    pickupContactPhone: { type: String, default: '' },
    pickupEmail: { type: String, default: '' },

    serviceabilityMode: {
      type: String,
      enum: ['DELHIVERY_API', 'LIST', 'DISABLED'],
      default: 'DISABLED',
    },
    serviceablePincodes: { type: [String], default: [] },
    blockedPincodes: { type: [String], default: [] },

    shippingDisabledMessage: {
      type: String,
      default:
        'Online ordering is temporarily paused. Please check back shortly or use the contact page to reach us.',
      trim: true,
    },
    unserviceableMessage: {
      type: String,
      default: 'We are not able to deliver to that PIN code at the moment.',
      trim: true,
    },
    unknownPincodeMessage: {
      type: String,
      default:
        'We could not confirm this PIN code. Please continue with your order — we will contact you if there is a problem.',
      trim: true,
    },
    shippingPolicyNote: { type: String, default: '', trim: true, maxlength: 2000 },

    shippingEnabled: { type: Boolean, default: true },
    flatShippingPaise: { type: Number, default: 5900, min: 0 },
    freeShippingEnabled: { type: Boolean, default: true },
    freeShippingThresholdPaise: { type: Number, default: 59900, min: 0 },
    weightBasedShipping: { type: Boolean, default: false },
    weightRatePaisePerKg: { type: Number, default: 0, min: 0 },
    handlingPaise: { type: Number, default: 0, min: 0 },
    maxWeightPerOrderGrams: { type: Number, default: 0, min: 0 },

    showEstimatedDelivery: { type: Boolean, default: true },
    defaultEstimatedDeliveryDaysMin: { type: Number, default: 3, min: 0 },
    defaultEstimatedDeliveryDaysMax: { type: Number, default: 6, min: 0 },

    codEnabled: { type: Boolean, default: false },
    codMaxOrderPaise: { type: Number, default: null, min: 0 },
    codHandlingPaise: { type: Number, default: 0, min: 0 },

    taxEnabled: { type: Boolean, default: false },
    taxInclusive: { type: Boolean, default: true },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },

    allowCancellation: { type: Boolean, default: true },
    cancelWindowHours: { type: Number, default: 24, min: 0 },

    configVersion: { type: Number, default: SHIPPING_CONFIG_VERSION },
  },
  { timestamps: true, collection: 'shippingconfigurations' },
);

export const ShippingConfiguration =
  (models.ShippingConfiguration as Model<ShippingConfigurationDoc>) ||
  model<ShippingConfigurationDoc>('ShippingConfiguration', ShippingConfigurationSchema);

let cached: { value: ShippingConfigurationDoc; at: number } | null = null;
const CACHE_MS = 30_000;
export const SHIPPING_DEFAULTS: Omit<
  ShippingConfigurationDoc,
  '_id' | 'createdAt' | 'updatedAt'
> = {
  pickupName: '',
  pickupAddressLine1: '',
  pickupAddressLine2: '',
  pickupCity: '',
  pickupState: '',
  pickupPincode: '',
  pickupCountry: 'India',
  pickupContactName: '',
  pickupContactPhone: '',
  pickupEmail: '',

  // Delivery dates come from the courier or from the admin-configured window
  // below. They are never invented per-request. Live PIN checking is only turned
  // on when the courier is actually connected, so the storefront degrades to the
  // honest "we will confirm" message instead of erroring.
  serviceabilityMode: serverEnv.delhivery.apiKey ? 'DELHIVERY_API' : 'DISABLED',
  serviceablePincodes: [],
  blockedPincodes: [],

  shippingDisabledMessage:
    'Online ordering is temporarily paused. Please check back shortly or use the contact page to reach us.',
  unserviceableMessage: 'We are not able to deliver to that PIN code at the moment.',
  unknownPincodeMessage:
    'We could not confirm this PIN code. Please continue with your order — we will contact you if there is a problem.',
  shippingPolicyNote: '',

  // Real, editable delivery charges. An admin overrides all of these in
  // Admin → Shipping; these are only the values a fresh install starts with.
  shippingEnabled: serverEnv.commerce.shippingEnabled,
  flatShippingPaise: serverEnv.commerce.flatShippingPaise,
  freeShippingEnabled: serverEnv.commerce.freeShippingEnabled,
  freeShippingThresholdPaise: serverEnv.commerce.freeShippingEnabled
    ? serverEnv.commerce.freeShippingThresholdPaise
    : null,
  weightBasedShipping: false,
  weightRatePaisePerKg: 0,
  handlingPaise: serverEnv.commerce.handlingPaise,
  maxWeightPerOrderGrams: 0,

  showEstimatedDelivery: serverEnv.commerce.showEstimatedDelivery,
  defaultEstimatedDeliveryDaysMin: serverEnv.commerce.estimatedDeliveryDaysMin,
  defaultEstimatedDeliveryDaysMax: serverEnv.commerce.estimatedDeliveryDaysMax,

  codEnabled: false,
  codMaxOrderPaise: null,
  codHandlingPaise: 0,

  taxEnabled: false,
  taxInclusive: true,
  taxPercent: 0,

  allowCancellation: true,
  cancelWindowHours: 24,
  configVersion: SHIPPING_CONFIG_VERSION,
};

/**
 * Has an admin ever edited this document?
 *
 * A "pristine" document is one still sitting on the untouched legacy defaults —
 * shipping switched off, no origin address, no charges. Those are safe to
 * upgrade to the current defaults. Anything else is a real business decision and
 * is never rewritten by this module.
 */
function isPristineLegacyConfig(doc: ShippingConfigurationDoc): boolean {
  return (
    doc.shippingEnabled === false &&
    !doc.freeShippingEnabled &&
    (doc.flatShippingPaise ?? 0) === 0 &&
    (doc.handlingPaise ?? 0) === 0 &&
    (doc.weightRatePaisePerKg ?? 0) === 0 &&
    doc.freeShippingThresholdPaise === null &&
    !doc.pickupName &&
    !doc.pickupPincode &&
    !doc.pickupCity &&
    (doc.serviceabilityMode ?? 'DISABLED') === 'DISABLED' &&
    (doc.serviceablePincodes?.length ?? 0) === 0 &&
    (doc.blockedPincodes?.length ?? 0) === 0 &&
    doc.codEnabled === false
  );
}

/**
 * Bring an older, still-pristine document up to the current shipped defaults.
 *
 * This is what unblocks a store created by a previous build, where checkout was
 * gated behind `shippingEnabled: false`. It deliberately refuses to touch a
 * configuration an admin has configured.
 */
async function upgradeLegacyConfig(doc: ShippingConfigurationDoc): Promise<ShippingConfigurationDoc> {
  if ((doc.configVersion ?? 0) >= SHIPPING_CONFIG_VERSION) return doc;
  if (!isPristineLegacyConfig(doc)) {
    // Configured by an admin — only stamp the version so we stop re-checking.
    await ShippingConfiguration.updateOne({ _id: doc._id }, { $set: { configVersion: SHIPPING_CONFIG_VERSION } }).exec();
    return { ...doc, configVersion: SHIPPING_CONFIG_VERSION };
  }

  const update: Record<string, unknown> = { configVersion: SHIPPING_CONFIG_VERSION };
  if (serverEnv.commerce.shippingEnabled) {
    update.shippingEnabled = SHIPPING_DEFAULTS.shippingEnabled;
    update.flatShippingPaise = SHIPPING_DEFAULTS.flatShippingPaise;
    update.handlingPaise = SHIPPING_DEFAULTS.handlingPaise;
    update.freeShippingEnabled = SHIPPING_DEFAULTS.freeShippingEnabled;
    update.freeShippingThresholdPaise = SHIPPING_DEFAULTS.freeShippingThresholdPaise;
    update.showEstimatedDelivery = SHIPPING_DEFAULTS.showEstimatedDelivery;
    update.defaultEstimatedDeliveryDaysMin = SHIPPING_DEFAULTS.defaultEstimatedDeliveryDaysMin;
    update.defaultEstimatedDeliveryDaysMax = SHIPPING_DEFAULTS.defaultEstimatedDeliveryDaysMax;
    update.shippingDisabledMessage = SHIPPING_DEFAULTS.shippingDisabledMessage;
  }

  await ShippingConfiguration.updateOne({ _id: doc._id }, { $set: update }).exec();
  const fresh = (await ShippingConfiguration.findById(doc._id).lean().exec()) as ShippingConfigurationDoc;
  return fresh ?? { ...doc, ...update } as ShippingConfigurationDoc;
}

/** Read-through cached config, so pricing does not hit Mongo on every request. */
export async function getShippingConfig(
  opts: { fresh?: boolean } = {},
): Promise<ShippingConfigurationDoc> {
  if (!opts.fresh && cached && Date.now() - cached.at < CACHE_MS) {
    return cached.value;
  }
  await connectDb();
  let doc = (await ShippingConfiguration.findOne({}).lean().exec()) as ShippingConfigurationDoc | null;
  if (!doc) {
    doc = (await ShippingConfiguration.create(SHIPPING_DEFAULTS)).toObject() as ShippingConfigurationDoc;
  } else if ((doc.configVersion ?? 0) < SHIPPING_CONFIG_VERSION) {
    doc = await upgradeLegacyConfig(doc);
  }
  cached = { value: doc, at: Date.now() };
  return doc;
}

export function invalidateShippingConfigCache(): void {
  cached = null;
}
