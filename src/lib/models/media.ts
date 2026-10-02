import { Schema, model, models, type Model, type Types } from 'mongoose';
import { MEDIA_ROLES, type MediaRef, type MediaRole } from '../types';

/**
 * Cloudinary media sub-document.
 * Stores only references — never binary image data.
 */
const MediaSchema = new Schema<MediaRef>(
  {
    publicId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    secureUrl: { type: String, trim: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    format: { type: String, trim: true },
    bytes: { type: Number, min: 0 },
    role: { type: String, enum: MEDIA_ROLES, default: 'gallery' },
    alt: { type: String, required: true, trim: true, maxlength: 240 },
    order: { type: Number, default: 1, min: 1 },
    blurDataUrl: { type: String },
  },
  { _id: false },
);

export { MediaSchema };

export function primaryMedia(images?: MediaRef[]): MediaRef | undefined {
  if (!images?.length) return undefined;
  return [...images].sort((a, b) => a.order - b.order)[0];
}

export function mediaForRole(images: MediaRef[] | undefined, role: MediaRole): MediaRef | undefined {
  if (!images?.length) return undefined;
  const matches = images.filter((i) => i.role === role).sort((a, b) => a.order - b.order);
  return matches[0];
}

export type MediaDoc = MediaRef;
export type MediaModel = Model<MediaRef>;
export const Media = (models.Media as MediaModel) || model<MediaRef>('Media', MediaSchema);

/** Narrow helper used across the app. */
export type MediaList = Array<MediaRef & { _id?: Types.ObjectId }>;
