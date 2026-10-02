import { Schema, model, models, type Model, type Types } from 'mongoose';
import { MediaSchema } from './media';
import type { MediaRef } from '../types';

export interface RecipeStep {
  instruction: string;
  durationMinutes?: number;
  image?: MediaRef | null;
}

export interface RecipeDoc {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  /** Markdown-lite body; rendered with a safe, link-sanitising renderer. */
  body: string;
  image: MediaRef | null;

  /** e.g. "Breakfast", "Desserts", "Drinks" — all serving ideas, no health claims. */
  category: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: 'Easy' | 'Medium';
  steps: RecipeStep[];
  ingredients: string[];

  /** Links the recipe to products it pairs with (upsell, not a hard claim). */
  relatedProductIds: Types.ObjectId[];

  order: number;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecipeStepSchema = new Schema<RecipeStep>(
  {
    instruction: { type: String, required: true, trim: true, maxlength: 1000 },
    durationMinutes: { type: Number, min: 0 },
    image: { type: MediaSchema, default: null },
  },
  { _id: false },
);

const RecipeSchema = new Schema<RecipeDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 220 },
    excerpt: { type: String, required: true, trim: true, maxlength: 400 },
    body: { type: String, default: '', trim: true },
    image: { type: MediaSchema, default: null },

    category: { type: String, required: true, trim: true, default: 'Ways to enjoy', maxlength: 80 },
    servings: { type: Number, min: 1, max: 50, default: 2 },
    prepMinutes: { type: Number, min: 0, default: 5 },
    cookMinutes: { type: Number, min: 0, default: 5 },
    difficulty: { type: String, enum: ['Easy', 'Medium'], default: 'Easy' },
    steps: { type: [RecipeStepSchema], default: [] },
    ingredients: { type: [String], default: [] },

    relatedProductIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
      default: [],
    },

    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    seoTitle: { type: String, default: '', trim: true, maxlength: 180 },
    seoDescription: { type: String, default: '', trim: true, maxlength: 320 },
  },
  { timestamps: true, collection: 'recipes' },
);

RecipeSchema.index({ slug: 1 }, { unique: true });
RecipeSchema.index({ isActive: 1, order: 1 });

export const Recipe =
  (models.Recipe as Model<RecipeDoc>) || model<RecipeDoc>('Recipe', RecipeSchema);
