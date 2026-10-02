import { Schema, model, models, type Model, type Types } from 'mongoose';
import { MediaSchema } from './media';
import type { MediaRef } from '../types';

export interface BundleLine {
  productId: Types.ObjectId;
  variantId: Types.ObjectId | null;
  qty: number;
}

export interface BundleDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  image: MediaRef | null;

  lines: BundleLine[];

  /**
   * Configured bundle price in paise. `savingsPaise` is NEVER stored — it is
   * derived at read time from `sum(line selling prices) - bundlePrice`, so the
   * "Save ₹X" claim can only ever appear when it is arithmetically true.
   */
  bundlePricePaise: number;
  compareAtPaise: number | null;

  isActive: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  createdAt: Date;
  updatedAt: Date;
}

const BundleLineSchema = new Schema<BundleLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', default: null },
    qty: { type: Number, required: true, min: 1, max: 20, default: 1 },
  },
  { _id: false },
);

const BundleSchema = new Schema<BundleDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 180 },
    description: { type: String, default: '', trim: true },
    shortDescription: { type: String, required: true, trim: true, maxlength: 320 },
    image: { type: MediaSchema, default: null },

    lines: {
      type: [BundleLineSchema],
      required: true,
      validate: {
        validator: (v: BundleLine[]) => Array.isArray(v) && v.length > 0,
        message: 'A bundle must contain at least one product.',
      },
    },

    bundlePricePaise: { type: Number, required: true, min: 0 },
    compareAtPaise: { type: Number, default: null, min: 0 },

    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    seoTitle: { type: String, default: '', trim: true, maxlength: 180 },
    seoDescription: { type: String, default: '', trim: true, maxlength: 320 },
  },
  { timestamps: true, collection: 'bundles' },
);

BundleSchema.index({ slug: 1 }, { unique: true });
BundleSchema.index({ isActive: 1, sortOrder: 1 });

export const Bundle = (models.Bundle as Model<BundleDoc>) || model<BundleDoc>('Bundle', BundleSchema);

export interface BundleSavings {
  /** Sum of individual selling prices for the bundle lines, in paise. */
  individualTotalPaise: number;
  bundlePricePaise: number;
  /** Only non-zero when bundlePrice < individualTotal. */
  savingsPaise: number;
  savingsPercent: number;
  hasGenuineDiscount: boolean;
}

export function computeBundleSavings(
  individualTotalPaise: number,
  bundlePricePaise: number,
): BundleSavings {
  const individual = Math.max(0, Math.round(individualTotalPaise || 0));
  const bundle = Math.max(0, Math.round(bundlePricePaise || 0));
  const savingsPaise = individual > bundle ? individual - bundle : 0;
  return {
    individualTotalPaise: individual,
    bundlePricePaise: bundle,
    savingsPaise,
    savingsPercent: savingsPaise > 0 && individual > 0 ? Math.round((savingsPaise / individual) * 100) : 0,
    hasGenuineDiscount: savingsPaise > 0,
  };
}
