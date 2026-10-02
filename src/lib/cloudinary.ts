import 'server-only';

import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { serverEnv, integrationState } from './env';

/**
 * Cloudinary is the image system of record.
 *
 * Hard rules enforced here:
 *  - image bytes are NEVER stored in MongoDB; only publicId + delivery URL
 *  - uploads are signed server-side, so the API secret never reaches a browser
 *  - every delivery URL is transformed (f_auto → AVIF/WebP, q_auto) rather
 *    than serving the original asset
 */

let configured = false;

export function initCloudinary(): boolean {
  if (configured) return true;
  if (integrationState('cloudinary') !== 'configured') return false;

  cloudinary.config({
    cloud_name: serverEnv.cloudinary.cloudName,
    api_key: serverEnv.cloudinary.apiKey,
    api_secret: serverEnv.cloudinary.apiSecret,
    secure: true,
  });
  configured = true;
  return true;
}

export const CLOUDINARY_FOLDER = 'natures-choice';

export interface UploadedAsset {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  blurDataUrl?: string;
}

export interface UploadOptions {
  folder?: string;
  /** Semantic tag so admin folders stay navigable. */
  tags?: string[];
  /** Overwrite a previous asset for the same product slot. */
  publicId?: string;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Server-side upload used by admin (images, UGC, recipes, founder, process).
 * Incoming image bytes are capped and re-encoded during upload so the
 * original oversize asset is never what ends up in production.
 */
export async function uploadImage(
  buffer: Buffer | string,
  options: UploadOptions = {},
): Promise<UploadedAsset> {
  if (!initCloudinary()) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_* env variables.');
  }

  const {
    folder = CLOUDINARY_FOLDER,
    tags = [],
    publicId,
    maxWidth = 2400,
    maxHeight = 2400,
  } = options;

  const transformation: Record<string, unknown>[] = [
    { width: maxWidth, height: maxHeight, crop: 'limit' },
    // Trim metadata: strips EXIF (including GPS) from customer UGC.
    { fetch_format: 'auto' },
    { quality: 'auto:good' },
  ];

  const uploadOptions: Record<string, unknown> = {
    folder,
    tags: ['natures-choice', ...tags],
    resource_type: 'image',
    overwrite: Boolean(publicId),
    invalidate: Boolean(publicId),
    transformation,
    // Guards the admin upload endpoint against oversized payloads.
    max_file_size: 12 * 1024 * 1024,
  };
  if (publicId) uploadOptions.public_id = publicId;

  const result =
    typeof buffer === 'string'
      ? ((await cloudinary.uploader.upload(buffer, uploadOptions)) as UploadApiResponse)
      : await new Promise<UploadApiResponse>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, res) => {
            if (err || !res) reject(err ?? new Error('Cloudinary upload failed.'));
            else resolve(res);
          });
          stream.end(buffer);
        });

  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
    blurDataUrl: result.eager?.[0]?.secure_url,
  };
}

/** Removes an asset from Cloudinary. Failures are non-fatal by design. */
export async function deleteImage(publicId: string): Promise<boolean> {
  if (!initCloudinary() || !publicId) return false;
  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return res.result === 'ok' || res.result === 'not found';
  } catch {
    return false;
  }
}

/**
 * Short-lived upload signature so a browser can upload straight to
 * Cloudinary without our server proxying the bytes. The API secret is used
 * here on the server and only the derived signature is returned.
 */
export async function createUploadSignature(params: {
  folder?: string;
  tags?: string[];
  timestamp?: number;
}): Promise<{ signature: string; apiKey: string; cloudName: string; folder: string; timestamp: number }> {
  if (!initCloudinary()) {
    throw new Error('Cloudinary is not configured.');
  }
  const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000);
  const folder = params.folder ?? CLOUDINARY_FOLDER;
  const tags = ['natures-choice', ...(params.tags ?? [])];

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, tags },
    serverEnv.cloudinary.apiSecret,
  );

  return {
    signature,
    apiKey: serverEnv.cloudinary.apiKey,
    cloudName: serverEnv.cloudinary.cloudName,
    folder,
    timestamp,
  };
}
