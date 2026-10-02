import { Types } from 'mongoose';

import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { ContactMessage } from '@/lib/models/ContactMessage';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { contactStatusSchema, adminListQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Contact-form inbox. */
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
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { subject: rx }, { message: rx }];
    }

    const skip = (query.page - 1) * query.limit;
    const [rows, total, newCount] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean().exec(),
      ContactMessage.countDocuments(filter).exec(),
      ContactMessage.countDocuments({ status: 'NEW' }).exec(),
    ]);

    return ok(
      {
        messages: rows.map((m) => ({
          id: String(m._id),
          name: m.name,
          email: m.email,
          phone: m.phone,
          subject: m.subject,
          message: m.message,
          source: m.source,
          status: m.status,
          adminReply: m.adminReply,
          createdAt: new Date(m.createdAt).toISOString(),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.max(1, Math.ceil(total / query.limit)),
        },
        newCount,
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 16 * 1024)) as { id?: string };
    const url = new URL(req.url);
    const id = url.searchParams.get('id') ?? raw.id ?? '';

    if (!Types.ObjectId.isValid(id)) {
      return fail('A valid message id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    const body = contactStatusSchema.parse({ ...raw, id: undefined });

    await connectDb();
    const doc = await ContactMessage.findByIdAndUpdate(
      id,
      { $set: { status: body.status, adminReply: body.adminReply ?? '' } },
      { new: true },
    ).exec();

    if (!doc) return fail('Message not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ id: String(doc._id), status: doc.status }, { headers: noStore });
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
      return fail('A valid message id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }
    await connectDb();
    const doc = await ContactMessage.findByIdAndDelete(id).exec();
    if (!doc) return fail('Message not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ deleted: true, id }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}