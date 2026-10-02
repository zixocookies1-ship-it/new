import { Types } from 'mongoose';

import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Recipe } from '@/lib/models/Recipe';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { recipeUpsertSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    await connectDb();
    const includeInactive = new URL(req.url).searchParams.get('all') === '1';
    const recipes = await Recipe.find(includeInactive ? {} : { isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();

    return ok(
      {
        recipes: recipes.map((r) => ({
          id: String(r._id),
          title: r.title,
          slug: r.slug,
          excerpt: r.excerpt,
          category: r.category,
          servings: r.servings,
          prepMinutes: r.prepMinutes,
          cookMinutes: r.cookMinutes,
          difficulty: r.difficulty,
          steps: r.steps,
          ingredients: r.ingredients,
          relatedProductIds: r.relatedProductIds.map((id) => String(id)),
          image: r.image,
          order: r.order,
          isActive: r.isActive,
          seoTitle: r.seoTitle,
          seoDescription: r.seoDescription,
        })),
        categories: [...new Set(recipes.map((r) => r.category))].sort(),
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
    const raw = (await readJson(req, 128 * 1024)) as Record<string, unknown>;
    const id = typeof raw.id === 'string' && Types.ObjectId.isValid(raw.id) ? raw.id : null;
    const body = recipeUpsertSchema.parse({ ...raw, id: undefined });

    await connectDb();

    const slugTaken = await Recipe.findOne({ slug: body.slug }).lean().exec();
    if (slugTaken && String(slugTaken._id) !== id) {
      return fail('That recipe slug is already in use.', { status: 409, code: 'SLUG_TAKEN' });
    }

    const payload = {
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt,
      body: body.body,
      image: body.image ?? null,
      category: body.category,
      servings: body.servings,
      prepMinutes: body.prepMinutes,
      cookMinutes: body.cookMinutes,
      difficulty: body.difficulty,
      steps: body.steps,
      ingredients: body.ingredients,
      relatedProductIds: body.relatedProductIds,
      order: body.order,
      isActive: body.isActive,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
    };

    const doc = id
      ? await Recipe.findByIdAndUpdate(id, { $set: payload }, { new: true }).exec()
      : await Recipe.create(payload);

    if (!doc) return fail('Recipe not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ id: String(doc._id), slug: doc.slug }, { headers: noStore });
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
      order?: number;
    };
    if (!raw.id || !Types.ObjectId.isValid(raw.id)) {
      return fail('A valid recipe id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    const set: Record<string, unknown> = {};
    if (typeof raw.isActive === 'boolean') set.isActive = raw.isActive;
    if (typeof raw.order === 'number') set.order = raw.order;
    if (!Object.keys(set).length) {
      return fail('Nothing to update.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    await connectDb();
    const doc = await Recipe.findByIdAndUpdate(raw.id, { $set: set }, { new: true }).exec();
    if (!doc) return fail('Recipe not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ id: String(doc._id), isActive: doc.isActive, order: doc.order }, { headers: noStore });
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
      return fail('A valid recipe id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }
    await connectDb();
    const doc = await Recipe.findByIdAndDelete(id).exec();
    if (!doc) return fail('Recipe not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ deleted: true, id }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}