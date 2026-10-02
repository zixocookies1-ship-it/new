import { Schema, model, models, type Model, type Types } from 'mongoose';
import { MediaSchema } from './media';
import { CONTENT_KEYS, type ContentKey, type MediaRef } from '../types';
import { connectDb } from '../db';

export interface ContentSection {
  heading: string;
  body: string;
  bullet?: string;
  image?: MediaRef | null;
  /**
   * `false` means the copy is a clearly-marked editable placeholder that an
   * admin still has to confirm (e.g. founder biography, process detail).
   * The storefront renders it, the admin surfaces it in the setup checklist,
   * and it is never presented as a verified business fact.
   */
  verified: boolean;
}

export interface ContentDoc {
  _id: Types.ObjectId;
  key: ContentKey;
  title: string;
  eyebrow: string;
  body: string;
  sections: ContentSection[];
  items: Array<Record<string, unknown>>;
  images: MediaRef[];
  /** References an FAQ category for pages that render a live FAQ list. */
  faqCategory: string;
  seoTitle: string;
  seoDescription: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContentSectionSchema = new Schema<ContentSection>(
  {
    heading: { type: String, default: '', trim: true, maxlength: 240 },
    body: { type: String, default: '', trim: true, maxlength: 4000 },
    bullet: { type: String, default: '', trim: true, maxlength: 240 },
    image: { type: MediaSchema, default: null },
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

const ContentSchema = new Schema<ContentDoc>(
  {
    key: { type: String, enum: CONTENT_KEYS, required: true },
    title: { type: String, default: '', trim: true, maxlength: 240 },
    eyebrow: { type: String, default: '', trim: true, maxlength: 120 },
    body: { type: String, default: '', trim: true },
    sections: { type: [ContentSectionSchema], default: [] },
    /** Free-form structured payload (process steps, UGC tiles, trust items...). */
    // Mixed array: the shape of each item is owned by the specific content key.
    items: { type: [Schema.Types.Mixed], default: [] } as never,
    images: { type: [MediaSchema], default: [] },
    faqCategory: { type: String, default: '', trim: true, maxlength: 80 },
    seoTitle: { type: String, default: '', trim: true, maxlength: 180 },
    seoDescription: { type: String, default: '', trim: true, maxlength: 320 },
    isVerified: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'contents' },
);

ContentSchema.index({ key: 1 }, { unique: true });

export const Content =
  (models.Content as Model<ContentDoc>) || model<ContentDoc>('Content', ContentSchema);

/** Bulk fetch every content document in one query (single round-trip). */
export async function getContentMap(): Promise<Partial<Record<ContentKey, ContentDoc>>> {
  await connectDb();
  const docs = await Content.find({}).lean().exec();
  const map: Partial<Record<ContentKey, ContentDoc>> = {};
  for (const d of docs) map[d.key as ContentKey] = d as ContentDoc;
  return map;
}

export async function getContent(key: ContentKey): Promise<ContentDoc | null> {
  await connectDb();
  return Content.findOne({ key }).lean().exec();
}
