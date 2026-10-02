import { Types } from 'mongoose';

import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { ok, fail, handleRouteError, noStore } from '@/lib/http';
import { adminListQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/** Escape a user-supplied search term before using it in a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(ESCAPE, '\\$&');
}

export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(req.url);
    const query = adminListQuerySchema.parse({
      q: url.searchParams.get('q') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      paymentStatus: url.searchParams.get('paymentStatus') ?? undefined,
      shippingStatus: url.searchParams.get('shippingStatus') ?? undefined,
      syncStatus: url.searchParams.get('syncStatus') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    await connectDb();

    const filter: Record<string, unknown> = {};
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    if (query.paymentStatus && query.paymentStatus !== 'ALL') {
      filter['payment.status'] = query.paymentStatus;
    }
    if (query.shippingStatus && query.shippingStatus !== 'ALL') {
      filter['shipping.status'] = query.shippingStatus;
    }
    if (query.syncStatus && query.syncStatus !== 'ALL') {
      filter['shipping.syncStatus'] = query.syncStatus;
    }
    if (query.q) {
      const rx = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [{ orderId: rx }, { reference: rx }, { phone: rx }, { email: rx }];
    }

    const skip = (query.page - 1) * query.limit;
    const [rows, total, revenueAgg, pendingAgg, failedSyncAgg] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean().exec(),
      Order.countDocuments(filter).exec(),
      Order.aggregate<{ _id: null; total: number }>([
        { $match: { 'payment.status': 'PAID', ...(query.q ? filter : {}) } },
        { $group: { _id: null, total: { $sum: '$totalPaise' } } },
      ]).exec(),
      Order.countDocuments({ 'payment.status': 'PENDING' }).exec(),
      Order.countDocuments({ 'shipping.syncStatus': 'FAILED' }).exec(),
    ]);

    return ok(
      {
        orders: rows.map((o) => ({
          id: String(o._id),
          orderId: o.orderId,
          reference: o.reference,
          customerName: o.shippingAddress?.name ?? '',
          phone: o.phone,
          email: o.email,
          city: o.shippingAddress?.city ?? '',
          pincode: o.shippingAddress?.pincode ?? '',
          itemSummary: o.items.map((i) => `${i.name} (${i.weightLabel}) × ${i.qty}`).join(', '),
          itemCount: o.items.reduce((s, i) => s + i.qty, 0),
          totalPaise: o.totalPaise,
          status: o.status,
          paymentStatus: o.payment.status,
          paymentMethod: o.payment.method,
          razorpayPaymentId: o.payment.razorpayPaymentId,
          shippingStatus: o.shipping.status,
          syncStatus: o.shipping.syncStatus,
          syncError: o.shipping.syncStatus === 'FAILED' ? o.shipping.syncError : null,
          waybill: o.shipping.waybill,
          hasRefund: Boolean(o.payment.refundId),
          createdAt: new Date(o.createdAt).toISOString(),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.max(1, Math.ceil(total / query.limit)),
        },
        stats: {
          // Paise, summed only over PAID orders matching the current filter.
          revenuePaise: revenueAgg[0]?.total ?? 0,
          pendingPaymentCount: pendingAgg,
          failedShippingSyncCount: failedSyncAgg,
        },
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Full order detail for the admin drawer, including full address + timeline. */
export async function POST(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(req.url);
    const orderId = (url.searchParams.get('orderId') ?? '').trim().toUpperCase();
    if (!orderId) return fail('An orderId is required.', { status: 422, code: 'VALIDATION_ERROR' });

    await connectDb();
    const order = await Order.findOne({ orderId }).lean().exec();
    if (!order) return fail('Order not found.', { status: 404, code: 'NOT_FOUND' });

    return ok({ order }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Deep-link helper: resolve an internal Mongo id to its orderId (for the UI). */
export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') ?? '';
    if (!Types.ObjectId.isValid(id)) {
      return fail('A valid id is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }
    await connectDb();
    const order = await Order.findById(id).select('orderId').lean().exec();
    if (!order) return fail('Order not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ orderId: order.orderId }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}