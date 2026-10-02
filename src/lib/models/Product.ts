import { Schema, model, models, type Model } from 'mongoose';
import { MediaSchema, primaryMedia } from './media';
import { PRODUCT_FLAVOURS, type MediaRef, type ProductFlavour } from '../types';

export interface NutritionFact {
  label: string;
  per100g?: string;
  perServing?: string;
}

export interface ProductDoc {
  _id: any;
  name: string;
  slug: string;
  flavour: ProductFlavour;
  tagline: string;
  shortDescription: string;
  description: string;

  ingredients: string[];
  allergens: string[];
  nutrition: NutritionFact[];
  nutritionPer: { amount: number; unit: string; label: string };
  storage: string;
  shelfLife: string;
  howToUse: string[];
  fssaiNote: string;

  images: MediaRef[];
  /** Social share image override; falls back to the primary product image. */
  ogImage: MediaRef | null;

  /**
   * Where else this product can be bought.
   *
   * Recorded so the merchant has one place to see every channel and so the
   * URLs are never retyped by hand. Nothing is rendered from these fields on
   * the storefront — our own checkout stays the only buy path, and Amazon
   * listing prices can change without anyone here noticing.
   */
  marketplace: {
    /** Amazon.in ASIN, e.g. `B0HKFQKT6F`. */
    asin: string | null;
    /** Canonical Amazon product URL. */
    url: string | null;
    /** Amazon's "ask a question" deep link for this listing. */
    questionsUrl: string | null;
  };

  isActive: boolean;
  isFeatured: boolean;
  /** Set while admin still has to confirm price / legal / nutrition values. */
  isVerified: boolean;

  sortOrder: number;
  seoTitle: string;
  seoDescription: string;

  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<ProductDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    // Uniqueness is declared once, below, alongside the other §30 indexes.
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 180 },
    flavour: { type: String, enum: PRODUCT_FLAVOURS, required: true },

    tagline: { type: String, trim: true, maxlength: 200, default: '' },
    shortDescription: { type: String, required: true, trim: true, maxlength: 320 },
    description: { type: String, required: true, trim: true },

    ingredients: { type: [String], default: [] },
    allergens: { type: [String], default: [] },
    nutrition: {
      type: [
        new Schema<NutritionFact>(
          {
            label: { type: String, required: true, trim: true },
            per100g: { type: String, trim: true },
            perServing: { type: String, trim: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    nutritionPer: {
      amount: { type: Number, default: 100 },
      unit: { type: String, default: 'g' },
      label: { type: String, default: 'Per 100g' },
    },
    storage: { type: String, default: '', trim: true },
    shelfLife: { type: String, default: '', trim: true },
    howToUse: { type: [String], default: [] },
    fssaiNote: { type: String, default: '', trim: true },

    images: { type: [MediaSchema], default: [] },
    ogImage: { type: MediaSchema, default: null },

    marketplace: {
      asin: { type: String, trim: true, uppercase: true, maxlength: 16, default: null },
      url: { type: String, trim: true, maxlength: 500, default: null },
      questionsUrl: { type: String, trim: true, maxlength: 500, default: null },
    },

    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },

    sortOrder: { type: Number, default: 0 },

    seoTitle: { type: String, default: '', trim: true, maxlength: 180 },
    seoDescription: { type: String, default: '', trim: true, maxlength: 320 },
  },
  { timestamps: true, collection: 'products' },
);

// Primary lookup path for /products/[slug]
ProductSchema.index({ slug: 1 }, { unique: true });
// Admin list filtering + deterministic storefront ordering
ProductSchema.index({ isActive: 1, sortOrder: 1 });
ProductSchema.index({ flavour: 1, isActive: 1 });
// Text search for admin product search
ProductSchema.index({ name: 'text', tagline: 'text', shortDescription: 'text' });

ProductSchema.virtual('primaryImage').get(function (this: ProductDoc) {
  return primaryMedia(this.images);
});

ProductSchema.set('toJSON', { virtuals: true });

export const Product =
  (models.Product as Model<ProductDoc>) || model<ProductDoc>('Product', ProductSchema);
