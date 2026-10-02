import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Content, getContentMap } from '@/lib/models/Content';
import { CONTENT_KEYS, type ContentKey } from '@/lib/types';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { contentUpsertSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Every content document, plus which keys have no document yet. */
export async function GET() {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    await connectDb();
    const map = await getContentMap();

    return ok(
      {
        content: CONTENT_KEYS.map((key) => {
          const doc = map[key];
          return {
            key,
            exists: Boolean(doc),
            title: doc?.title ?? '',
            eyebrow: doc?.eyebrow ?? '',
            body: doc?.body ?? '',
            sections: doc?.sections ?? [],
            items: doc?.items ?? [],
            images: doc?.images ?? [],
            faqCategory: doc?.faqCategory ?? '',
            seoTitle: doc?.seoTitle ?? '',
            seoDescription: doc?.seoDescription ?? '',
            isVerified: doc?.isVerified ?? false,
            updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
          };
        }),
        unverifiedCount: CONTENT_KEYS.filter((k) => !map[k]?.isVerified).length,
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Upsert one content document, addressed by its key. */
export async function PUT(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 512 * 1024)) as { key?: string } & Record<string, unknown>;

    const key = (raw.key ?? '') as ContentKey;
    if (!CONTENT_KEYS.includes(key)) {
      return fail(`"${raw.key ?? ''}" is not a valid content key.`, {
        status: 422,
        code: 'INVALID_CONTENT_KEY',
      });
    }

    const body = contentUpsertSchema.parse({ ...raw, key: undefined });

    await connectDb();

    const payload = {
      title: body.title,
      eyebrow: body.eyebrow,
      body: body.body,
      sections: body.sections,
      items: body.items,
      images: body.images,
      faqCategory: body.faqCategory,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      isVerified: body.isVerified,
    };

    const doc = await Content.findOneAndUpdate({ key }, { $set: { key, ...payload } }, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }).exec();

    return ok({ key: doc.key, isVerified: doc.isVerified }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Toggle the "admin has confirmed this copy" flag without a full save. */
export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 8 * 1024)) as { key?: string; isVerified?: boolean };
    const key = (raw.key ?? '') as ContentKey;
    if (!CONTENT_KEYS.includes(key)) {
      return fail(`"${raw.key ?? ''}" is not a valid content key.`, {
        status: 422,
        code: 'INVALID_CONTENT_KEY',
      });
    }
    if (typeof raw.isVerified !== 'boolean') {
      return fail('isVerified must be a boolean.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    await connectDb();
    const doc = await Content.findOneAndUpdate(
      { key },
      { $set: { isVerified: raw.isVerified } },
      { new: true },
    ).exec();
    if (!doc) {
      return fail('No content document exists for that key yet. Save it once first.', {
        status: 404,
        code: 'NOT_FOUND',
      });
    }
    return ok({ key: doc.key, isVerified: doc.isVerified }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}