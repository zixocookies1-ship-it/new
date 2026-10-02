import { Schema, model, models, type Model, type Types } from 'mongoose';
import { MediaSchema } from './media';
import { REVIEW_STATUS, type MediaRef, type ReviewStatus } from '../types';
import { connectDb } from '../db';

export interface ReviewDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  /** Null until an admin links the review to a genuinely paid order. */
  orderId: Types.ObjectId | null;

  authorName: string;
  authorLocation: string;
  /** Customer-supplied media. Only rendered when the brand has permission. */
  images: MediaRef[];
  videoUrl: string | null;

  rating: number;
  title: string;
  body: string;

  /** Only ever true when a PAID order for that product was matched. */
  isVerifiedPurchase: boolean;
  /** Proof recorded by the moderator, kept separate from verified-purchase. */
  permissionConfirmed: boolean;

  status: ReviewStatus;
  moderationNote: string;
  moderatedBy: string;
  moderatedAt: Date | null;

  /**
   * sha256(authorName.toLowerCase() + productId). Used to block one person
   * from reviewing the same product many times under spelling variants.
   * Set by the API only — never accepted from the client.
   */
  fingerprint: string;

  helpfulCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<ReviewDoc>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null, index: true, sparse: true },

    authorName: { type: String, required: true, trim: true, maxlength: 100 },
    authorLocation: { type: String, default: '', trim: true, maxlength: 120 },
    images: { type: [MediaSchema], default: [] },
    videoUrl: { type: String, default: null, trim: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: '', trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 3000 },

    isVerifiedPurchase: { type: Boolean, default: false, index: true },
    permissionConfirmed: { type: Boolean, default: false },

    status: { type: String, enum: REVIEW_STATUS, default: 'PENDING', index: true },
    moderationNote: { type: String, default: '', maxlength: 500 },
    moderatedBy: { type: String, default: '', trim: true, maxlength: 160 },
    moderatedAt: { type: Date, default: null },

    fingerprint: { type: String, default: '', index: true, sparse: true },
    helpfulCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'reviews' },
);

// Storefront: approved reviews for a product, newest first
ReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
// Admin moderation queue
ReviewSchema.index({ status: 1, createdAt: -1 });
// One review per (product, reviewer fingerprint)
ReviewSchema.index({ productId: 1, fingerprint: 1 }, { unique: true, sparse: true });

export const Review = (models.Review as Model<ReviewDoc>) || model<ReviewDoc>('Review', ReviewSchema);

export interface RatingSummary {
  average: number;
  count: number;
  /** Counts keyed 1..5. Only includes buckets that have at least one review. */
  distribution: Record<number, number>;
}

/**
 * Aggregation that derives a rating summary from APPROVED reviews only.
 * Never returns a synthesised average — a product with no reviews gets
 * `count: 0` and the UI hides the rating block entirely.
 */
export async function getRatingSummary(
  productIds: Types.ObjectId[] | string[],
): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  if (!productIds.length) return out;

  await connectDb();

  // Imported lazily to keep model files free of cross-dependency cycles.
  const rows = await Review.aggregate<{
    _id: string;
    avg: number;
    count: number;
  }>([
    { $match: { productId: { $in: productIds }, status: 'APPROVED' } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  for (const r of rows) {
    out.set(String(r._id), {
      average: Math.round(r.avg * 10) / 10,
      count: r.count,
      distribution: {},
    });
  }
  return out;
}
