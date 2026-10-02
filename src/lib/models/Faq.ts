import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface FaqDoc {
  _id: Types.ObjectId;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  helpfulCount: number;
  notHelpfulCount: number;
  /** Optional product scoping for product-page FAQs. */
  productId: Schema.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const FaqSchema = new Schema<FaqDoc>(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, trim: true, maxlength: 6000 },
    category: {
      type: String,
      required: true,
      trim: true,
      default: 'General',
      maxlength: 80,
    },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    helpfulCount: { type: Number, default: 0, min: 0 },
    notHelpfulCount: { type: Number, default: 0, min: 0 },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null, index: true, sparse: true },
  },
  { timestamps: true, collection: 'faqs' },
);

FaqSchema.index({ isActive: 1, category: 1, order: 1 });

export const Faq = (models.Faq as Model<FaqDoc>) || model<FaqDoc>('Faq', FaqSchema);
