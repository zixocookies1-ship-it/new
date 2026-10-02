import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Coupon } from '@/lib/models/Coupon';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { couponUpsertSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    await connectDb();
    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean().exec();
    const now = new Date();

    return ok(
      {
        coupons: coupons.map((c) => ({
          id: String(c._id),
          code: c.code,
          description: c.description,
          type: c.type,
          value: c.value,
          maxDiscountPaise: c.maxDiscountPaise,
          minOrderPaise: c.minOrderPaise,
          maxDiscountPercentCap: c.maxDiscountPercentCap,
          startsAt: c.startsAt ? new Date(c.startsAt).toISOString() : null,
          expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
          usageLimit: c.usageLimit,
          perUserLimit: c.perUserLimit,
          usageCount: c.usageCount,
          applicableProductIds: c.applicableProductIds.map(String),
          isActive: c.isActive,
          /** Derived, so the admin sees the real state without guessing. */
          liveState: !c.isActive
            ? 'INACTIVE'
            : c.startsAt && c.startsAt > now
              ? 'SCHEDULED'
              : c.expiresAt && c.expiresAt < now
                ? 'EXPIRED'
                : c.usageLimit !== null && c.usageCount >= c.usageLimit
                  ? 'LIMIT_REACHED'
                  : 'LIVE',
        })),
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
    const body = couponUpsertSchema.parse(await readJson(req, 16 * 1024));

    // Guard the two rules that would make a coupon nonsensical or exploitable.
    if (body.type === 'PERCENTAGE' && (body.value <= 0 || body.value > 100)) {
      return fail('A percentage coupon must be between 1 and 100.', {
        status: 422,
        code: 'VALIDATION_ERROR',
      });
    }
    if (body.startsAt && body.expiresAt && new Date(body.startsAt) >= new Date(body.expiresAt)) {
      return fail('The start date must be before the expiry date.', {
        status: 422,
        code: 'VALIDATION_ERROR',
      });
    }

    await connectDb();

    const payload = {
      code: body.code,
      description: body.description,
      type: body.type,
      value: body.value,
      maxDiscountPaise: body.maxDiscountPaise ?? null,
      minOrderPaise: body.minOrderPaise,
      maxDiscountPercentCap: body.maxDiscountPercentCap ?? null,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      usageLimit: body.usageLimit ?? null,
      perUserLimit: body.perUserLimit ?? null,
      applicableProductIds: body.applicableProductIds,
      isActive: body.isActive,
    };

    // Upsert by code — the code is the customer-facing identity.
    const doc = await Coupon.findOneAndUpdate({ code: body.code }, { $set: payload }, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }).exec();

    return ok({ id: String(doc._id), code: doc.code }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 8 * 1024)) as { code?: string; isActive?: boolean };
    const code = (raw.code ?? '').trim().toUpperCase();
    if (!code || typeof raw.isActive !== 'boolean') {
      return fail('A coupon code and isActive flag are required.', {
        status: 422,
        code: 'VALIDATION_ERROR',
      });
    }

    await connectDb();
    const doc = await Coupon.findOneAndUpdate({ code }, { $set: { isActive: raw.isActive } }, { new: true }).exec();
    if (!doc) return fail('Coupon not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ code: doc.code, isActive: doc.isActive }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const code = (new URL(req.url).searchParams.get('code') ?? '').trim().toUpperCase();
    if (!code) return fail('A coupon code is required.', { status: 422, code: 'VALIDATION_ERROR' });

    await connectDb();
    const doc = await Coupon.findOneAndDelete({ code }).exec();
    if (!doc) return fail('Coupon not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ deleted: true, code }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}