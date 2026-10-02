import { Schema, model, models, type Model } from 'mongoose';
import { connectDb } from '../db';

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
  /** Shown on the shipping-policy page; empty means "not written yet". */
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

  createdAt: Date;
  updatedAt: Date;
}

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
        'Online ordering is being set up. Please check back shortly or use the contact page to reach us.',
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

    shippingEnabled: { type: Boolean, default: false },
    flatShippingPaise: { type: Number, default: 0, min: 0 },
    freeShippingEnabled: { type: Boolean, default: false },
    freeShippingThresholdPaise: { type: Number, default: null, min: 0 },
    weightBasedShipping: { type: Boolean, default: false },
    weightRatePaisePerKg: { type: Number, default: 0, min: 0 },
    handlingPaise: { type: Number, default: 0, min: 0 },
    maxWeightPerOrderGrams: { type: Number, default: 0, min: 0 },

    showEstimatedDelivery: { type: Boolean, default: false },
    defaultEstimatedDeliveryDaysMin: { type: Number, default: null, min: 0 },
    defaultEstimatedDeliveryDaysMax: { type: Number, default: null, min: 0 },

    codEnabled: { type: Boolean, default: false },
    codMaxOrderPaise: { type: Number, default: null, min: 0 },
    codHandlingPaise: { type: Number, default: 0, min: 0 },

    taxEnabled: { type: Boolean, default: false },
    taxInclusive: { type: Boolean, default: true },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },

    allowCancellation: { type: Boolean, default: true },
    cancelWindowHours: { type: Number, default: 24, min: 0 },
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

  // Shipping stays honestly OFF until an admin configures real origin + charges.
  serviceabilityMode: 'DISABLED',
  serviceablePincodes: [],
  blockedPincodes: [],

  shippingDisabledMessage:
    'Online ordering is being set up. Please check back shortly or use the contact page to reach us.',
  unserviceableMessage: 'We are not able to deliver to that PIN code at the moment.',
  unknownPincodeMessage:
    'We could not confirm this PIN code. Please continue with your order — we will contact you if there is a problem.',
  shippingPolicyNote: '',

  shippingEnabled: false,
  flatShippingPaise: 0,
  freeShippingEnabled: false,
  freeShippingThresholdPaise: null,
  weightBasedShipping: false,
  weightRatePaisePerKg: 0,
  handlingPaise: 0,
  maxWeightPerOrderGrams: 0,

  // Delivery dates are never fabricated.
  showEstimatedDelivery: false,
  defaultEstimatedDeliveryDaysMin: null,
  defaultEstimatedDeliveryDaysMax: null,

  codEnabled: false,
  codMaxOrderPaise: null,
  codHandlingPaise: 0,

  taxEnabled: false,
  taxInclusive: true,
  taxPercent: 0,

  allowCancellation: true,
  cancelWindowHours: 24,
};

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
  }
  cached = { value: doc, at: Date.now() };
  return doc;
}

export function invalidateShippingConfigCache(): void {
  cached = null;
}
