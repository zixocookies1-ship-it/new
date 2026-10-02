import { Types } from 'mongoose';

import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Review } from '@/lib/models/Review';
import { Product } from '@/lib/models/Product';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { reviewModerationSchema, adminListQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Moderation queue. Newest first, filterable by status. */
export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(req.url);
    const query = adminListQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    await connectDb();

    const filter: Record<string, unknown> = {};
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    if (query.q) {
      const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ authorName: rx }, { body: rx }, { title: rx }];
    }

    const skip = (query.page - 1) * query.limit;
    const [rows, total, pendingCount] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean().exec(),
      Review.countDocuments(filter).exec(),
      Review.countDocuments({ status: 'PENDING' }).exec(),
    ]);

    const productIds = [...new Set(rows.map((r) => String(r.productId)))];
    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds.map((id) => new Types.ObjectId(id)) } })
          .select('name slug flavour')
          .lean()
          .exec()
      : [];
    const productById = new Map(products.map((p) => [String(p._id), p]));

    return ok(
      {
        reviews: rows.map((r) => {
          const p = productById.get(String(r.productId));
          return {
            id: String(r._id),
            productId: String(r.productId),
            productName: p?.name ?? '(deleted product)',
            productSlug: p?.slug ?? '',
            orderId: r.orderId ? String(r.orderId) : null,
            authorName: r.authorName,
            authorLocation: r.authorLocation,
            rating: r.rating,
            title: r.title,
            body: r.body,
            status: r.status,
            isVerifiedPurchase: r.isVerifiedPurchase,
            permissionConfirmed: r.permissionConfirmed,
            moderationNote: r.moderationNote,
            createdAt: new Date(r.createdAt).toISOString(),
          };
        }),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.max(1, Math.ceil(total / query.limit)),
        },
        pendingCount,
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Moderate a review.
 *
 * A review only reaches the storefront when BOTH `status === 'APPROVED'` and
 * `permissionConfirmed` is true — so approving a review does not silently
 * publish customer content without a human confirming permission to do so.
 */
export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = reviewModerationSchema.parse(await readJson(req, 8 * 1024));
    const url = new URL(req.url);
    const id = url.searchParams.get('id') ?? '';

    if (!Types.ObjectId.isValid(id)) {
      return fail('A valid review id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    await connectDb();
    const set: Record<string, unknown> = {
      status: body.status,
      moderationNote: body.moderationNote ?? '',
      // Record who moderated it — an audit trail, not a hidden edit.
      moderatedBy: guard.session.email,
      moderatedAt: new Date(),
    };
    if (typeof body.permissionConfirmed === 'boolean') {
      set.permissionConfirmed = body.permissionConfirmed;
    }
    // Verified-purchase status can be *downgraded* by a human, never upgraded
    // by the client, so only accept an explicit false here.
    if (body.isVerifiedPurchase === false) set.isVerifiedPurchase = false;

    const review = await Review.findByIdAndUpdate(id, { $set: set }, { new: true }).exec();
    if (!review) return fail('Review not found.', { status: 404, code: 'NOT_FOUND' });

    return ok(
      {
        id: String(review._id),
        status: review.status,
        isVerifiedPurchase: review.isVerifiedPurchase,
        permissionConfirmed: review.permissionConfirmed,
      },
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
    const url = new URL(req.url);
    const id = url.searchParams.get('id') ?? '';
    if (!Types.ObjectId.isValid(id)) {
      return fail('A valid review id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }
    await connectDb();
    const res = await Review.findByIdAndDelete(id).exec();
    if (!res) return fail('Review not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ deleted: true, id }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}