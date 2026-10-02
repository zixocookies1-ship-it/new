import { Types } from 'mongoose';

import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Faq } from '@/lib/models/Faq';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { faqUpsertSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    await connectDb();
    const includeInactive = new URL(req.url).searchParams.get('all') === '1';
    const filter = includeInactive ? {} : { isActive: true };

    const faqs = await Faq.find(filter).sort({ category: 1, order: 1, createdAt: 1 }).lean().exec();

    const categories = [...new Set(faqs.map((f) => f.category))].sort();

    return ok(
      {
        faqs: faqs.map((f) => ({
          id: String(f._id),
          question: f.question,
          answer: f.answer,
          category: f.category,
          order: f.order,
          isActive: f.isActive,
          isFeatured: f.isFeatured,
          productId: f.productId ? String(f.productId) : null,
        })),
        categories,
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 32 * 1024)) as Record<string, unknown>;
    const id = typeof raw.id === 'string' && Types.ObjectId.isValid(raw.id) ? raw.id : null;
    const body = faqUpsertSchema.parse({ ...raw, id: undefined });

    await connectDb();

    if (body.productId && !Types.ObjectId.isValid(body.productId)) {
      return fail('Invalid product reference.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    const payload = {
      question: body.question,
      answer: body.answer,
      category: body.category,
      order: body.order,
      isActive: body.isActive,
      isFeatured: body.isFeatured,
      productId: body.productId ?? null,
    };

    const doc = id
      ? await Faq.findByIdAndUpdate(id, { $set: payload }, { new: true }).exec()
      : await Faq.create(payload);

    if (!doc) return fail('FAQ not found.', { status: 404, code: 'NOT_FOUND' });

    return ok({ id: String(doc._id), question: doc.question }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 8 * 1024)) as {
      id?: string;
      isActive?: boolean;
      isFeatured?: boolean;
      order?: number;
    };
    if (!raw.id || !Types.ObjectId.isValid(raw.id)) {
      return fail('A valid FAQ id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    const set: Record<string, unknown> = {};
    if (typeof raw.isActive === 'boolean') set.isActive = raw.isActive;
    if (typeof raw.isFeatured === 'boolean') set.isFeatured = raw.isFeatured;
    if (typeof raw.order === 'number') set.order = raw.order;
    if (!Object.keys(set).length) {
      return fail('Nothing to update.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    await connectDb();
    const doc = await Faq.findByIdAndUpdate(raw.id, { $set: set }, { new: true }).exec();
    if (!doc) return fail('FAQ not found.', { status: 404, code: 'NOT_FOUND' });
    return ok(
      { id: String(doc._id), isActive: doc.isActive, isFeatured: doc.isFeatured, order: doc.order },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!Types.ObjectId.isValid(id)) {
      return fail('A valid FAQ id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }
    await connectDb();
    const doc = await Faq.findByIdAndDelete(id).exec();
    if (!doc) return fail('FAQ not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ deleted: true, id }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}