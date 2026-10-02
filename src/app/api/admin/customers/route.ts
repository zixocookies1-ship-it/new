import { guardAdmin, ELEVATED_ROLES } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { User } from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import {
  adminListQuerySchema,
  userUpsertSchema,
  userPasswordResetSchema,
} from '@/lib/validation';
import type { UserRole } from '@/lib/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * Customer list.
 *
 * Customers are *derived from orders* rather than a separate table, because
 * there is no forced account creation at checkout. Staff accounts come from the
 * `users` collection and are listed separately so an admin cannot mistake a
 * shop admin for a shopper.
 */
export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(req.url);
    const query = adminListQuerySchema.parse({
      q: url.searchParams.get('q') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    await connectDb();

    const match: Record<string, unknown> = {};
    if (query.q) {
      const rx = new RegExp(query.q.replace(ESCAPE, '\\$&'), 'i');
      match.$or = [{ phone: rx }, { email: rx }, { 'shippingAddress.name': rx }];
    }

    const skip = (query.page - 1) * query.limit;

    // Group orders by a stable customer key.
    const [rows, total, staff] = await Promise.all([
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: { phone: '$phone', email: '$email' },
            name: { $last: '$shippingAddress.name' },
            phone: { $first: '$phone' },
            email: { $first: '$email' },
            orderCount: { $sum: 1 },
            totalPaise: { $sum: '$totalPaise' },
            paidPaise: {
              $sum: { $cond: [{ $eq: ['$payment.status', 'PAID'] }, '$totalPaise', 0] },
            },
            lastOrderAt: { $max: '$createdAt' },
            cities: { $addToSet: '$shippingAddress.city' },
          },
        },
        { $sort: { lastOrderAt: -1 } },
        { $skip: skip },
        { $limit: query.limit },
      ]).exec(),
      Order.aggregate([{ $match: match }, { $group: { _id: { phone: '$phone', email: '$email' } } }])
        .exec()
        .then((r) => r.length),
      User.find({}).select('name email role isActive lastLoginAt createdAt').sort({ createdAt: 1 }).lean().exec(),
    ]);

    return ok(
      {
        customers: rows.map((r) => ({
          key: `${r._id.phone}|${r._id.email ?? ''}`,
          name: r.name || '',
          phone: r.phone,
          email: r.email,
          orderCount: r.orderCount,
          totalPaise: r.totalPaise,
          paidPaise: r.paidPaise,
          lastOrderAt: new Date(r.lastOrderAt).toISOString(),
          cities: (r.cities ?? []).filter(Boolean).slice(0, 4),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.max(1, Math.ceil(total / query.limit)),
        },
        staff: staff.map((u) => ({
          id: String(u._id),
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
          createdAt: new Date(u.createdAt).toISOString(),
        })),
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Create or update a staff account. ADMIN-only. */
export async function PUT(req: Request) {
  const guard = await guardAdmin(ELEVATED_ROLES);
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 16 * 1024)) as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id : null;
    const body = userUpsertSchema.parse({ ...raw, id: undefined });

    await connectDb();

    const email = body.email.toLowerCase();
    const existing = await User.findOne({ email }).exec();
    if (existing && String(existing._id) !== id) {
      return fail('An account with that email already exists.', {
        status: 409,
        code: 'EMAIL_TAKEN',
      });
    }

    if (id) {
      const user = await User.findById(id).exec();
      if (!user) return fail('Account not found.', { status: 404, code: 'NOT_FOUND' });
      user.name = body.name;
      user.email = email;
      user.role = body.role as UserRole;
      user.isActive = body.isActive;
      if (body.password) user.passwordHash = await hashPassword(body.password);
      await user.save();
      return ok(
        { id: String(user._id), email: user.email, role: user.role, isActive: user.isActive },
        { headers: noStore },
      );
    }

    if (!body.password) {
      return fail('A password is required when creating an account.', {
        status: 422,
        code: 'VALIDATION_ERROR',
      });
    }

    const created = await User.create({
      name: body.name,
      email,
      role: body.role as UserRole,
      isActive: body.isActive,
      passwordHash: await hashPassword(body.password),
    });

    return ok(
      { id: String(created._id), email: created.email, role: created.role },
      { status: 201, headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Reset a staff password. ADMIN-only. */
export async function PATCH(req: Request) {
  const guard = await guardAdmin(ELEVATED_ROLES);
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 8 * 1024)) as { id?: string; password?: string };
    const body = userPasswordResetSchema.parse({ password: raw.password });

    const id = raw.id;
    if (!id) return fail('An account id is required.', { status: 422, code: 'VALIDATION_ERROR' });

    await connectDb();
    const user = await User.findById(id).exec();
    if (!user) return fail('Account not found.', { status: 404, code: 'NOT_FOUND' });

    user.passwordHash = await hashPassword(body.password);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    return ok({ id: String(user._id), passwordUpdated: true }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Deactivate an account. Refuses to remove the last active admin. */
export async function DELETE(req: Request) {
  const guard = await guardAdmin(ELEVATED_ROLES);
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!id) return fail('An account id is required.', { status: 422, code: 'VALIDATION_ERROR' });

    if (id === guard.session.sub) {
      return fail('You cannot deactivate your own account while signed in.', {
        status: 409,
        code: 'SELF_DISABLE',
      });
    }

    await connectDb();
    const user = await User.findById(id).exec();
    if (!user) return fail('Account not found.', { status: 404, code: 'NOT_FOUND' });

    if (user.role === 'ADMIN' && user.isActive) {
      const otherAdmins = await User.countDocuments({
        _id: { $ne: id },
        role: 'ADMIN',
        isActive: true,
      }).exec();
      if (otherAdmins === 0) {
        return fail('This is the last active admin account. Create another admin before disabling it.', {
          status: 409,
          code: 'LAST_ADMIN',
        });
      }
    }

    user.isActive = false;
    await user.save();
    return ok({ id, isActive: false }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}