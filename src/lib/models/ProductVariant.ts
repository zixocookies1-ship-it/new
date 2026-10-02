import { Schema, model, models, type Model, type Types } from 'mongoose';
import { PRODUCT_FLAVOURS, type ProductFlavour } from '../types';

/**
 * A sellable size of a product (weight / pack format).
 * Kept in its own collection so inventory and SKU can be edited and indexed
 * independently, and so an order line can reference a durable variant id.
 *
 * All money fields are integer paise.
 */
export interface ProductVariantDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  sku: string;
  weightLabel: string;
  weightGrams?: number;
  packCount?: number;
  pricePaise: number;
  mrpPaise?: number | null;
  inventory: number;
  lowStockThreshold: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<ProductVariantDoc>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 64 },
    weightLabel: { type: String, required: true, trim: true, maxlength: 64 },
    weightGrams: { type: Number, min: 1 },
    packCount: { type: Number, min: 1, default: 1 },
    /** Selling price in paise. 0 is allowed and renders as "Price on request". */
    pricePaise: { type: Number, required: true, min: 0, default: 0 },
    mrpPaise: { type: Number, min: 0, default: null },
    inventory: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'productvariants' },
);

ProductVariantSchema.index({ productId: 1, sortOrder: 1 });
ProductVariantSchema.index({ isActive: 1, productId: 1 });

export const ProductVariant =
  (models.ProductVariant as Model<ProductVariantDoc>) ||
  model<ProductVariantDoc>('ProductVariant', ProductVariantSchema);

export type { ProductFlavour };
export { PRODUCT_FLAVOURS };
