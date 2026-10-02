import { guardAdmin } from '@/lib/admin';
import { uploadImage, createUploadSignature, deleteImage } from '@/lib/cloudinary';
import { integrationState } from '@/lib/env';
import { ok, fail, handleRouteError, noStore } from '@/lib/http';
import { mediaUploadMetaSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Signed parameters for direct browser → Cloudinary upload. */
export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  if (integrationState('cloudinary') !== 'configured') {
    return fail('Cloudinary is not configured. Set CLOUDINARY_* env variables.', {
      status: 503,
      code: 'CLOUDINARY_NOT_CONFIGURED',
    });
  }

  try {
    const url = new URL(req.url);
    const meta = mediaUploadMetaSchema.parse({
      role: url.searchParams.get('role') ?? 'gallery',
      folder: url.searchParams.get('folder') ?? '',
    });

    const signed = await createUploadSignature({
      folder: meta.folder || undefined,
      tags: [meta.role],
    });

    return ok({ ...signed, role: meta.role }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Server-proxied upload (multipart).
 *
 * Provided so uploads still work when a browser blocks direct-to-Cloudinary
 * requests. The file is validated by content type *and* magic bytes, capped in
 * size, and re-encoded by Cloudinary — nothing untrusted reaches the database.
 */
export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  if (integrationState('cloudinary') !== 'configured') {
    return fail('Cloudinary is not configured. Set CLOUDINARY_* env variables.', {
      status: 503,
      code: 'CLOUDINARY_NOT_CONFIGURED',
    });
  }

  try {
    const MAX_BYTES = 10 * 1024 * 1024;
    const form = await req.formData().catch(() => null);
    if (!form) return fail('Expected a multipart form upload.', { status: 400, code: 'BAD_REQUEST' });

    const file = form.get('file');
    if (!(file instanceof File)) {
      return fail('No file was uploaded.', { status: 400, code: 'NO_FILE' });
    }
    if (file.size === 0) {
      return fail('That file is empty.', { status: 400, code: 'EMPTY_FILE' });
    }
    if (file.size > MAX_BYTES) {
      return fail('That image is larger than 10 MB. Please upload a smaller file.', {
        status: 413,
        code: 'FILE_TOO_LARGE',
      });
    }

    const meta = mediaUploadMetaSchema.parse({
      role: String(form.get('role') ?? 'gallery'),
      alt: String(form.get('alt') ?? ''),
      folder: String(form.get('folder') ?? ''),
    });

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!looksLikeImage(bytes)) {
      return fail('That file is not a JPEG, PNG, WebP, AVIF or GIF image.', {
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }

    const asset = await uploadImage(bytes, {
      folder: meta.folder || undefined,
      tags: [meta.role],
    });

    return ok(
      {
        publicId: asset.publicId,
        url: asset.secureUrl,
        width: asset.width,
        height: asset.height,
        format: asset.format,
        bytes: asset.bytes,
        role: meta.role,
        alt: meta.alt,
      },
      { status: 201, headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Delete a Cloudinary asset. Mongo records referencing it are not touched. */
export async function DELETE(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(req.url);
    const publicId = (url.searchParams.get('publicId') ?? '').trim();
    if (!publicId || publicId.length > 300) {
      return fail('A publicId is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }
    const removed = await deleteImage(publicId);
    return ok({ removed, publicId }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Magic-byte sniffing — the declared Content-Type is never trusted. */
function looksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return true;
  }
  // GIF
  if (buf.subarray(0, 6).toString('latin1').startsWith('GIF87a')) return true;
  if (buf.subarray(0, 6).toString('latin1').startsWith('GIF89a')) return true;
  // RIFF (WebP)
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF') {
    return buf.subarray(8, 12).toString('latin1') === 'WEBP';
  }
  // ISO-BMFF (AVIF / HEIC)
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    return ['avif', 'avis', 'heic', 'heix', 'mif1'].includes(brand);
  }
  return false;
}