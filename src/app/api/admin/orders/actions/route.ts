import { guardAdmin, ELEVATED_ROLES } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { updateOrderStatus } from '@/lib/orders';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { orderStatusUpdateSchema } from '@/lib/validation';
import type { OrderStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin status transition.
 *
 * Rules enforced inside `updateOrderStatus` (not here, so there is one source of
 * truth): DELIVERED and SHIPPED both require a Delhivery waybill, cancelling or
 * refunding releases reserved stock, and an already-paid order is never
 * silently downgraded.
 */
export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = orderStatusUpdateSchema.parse(await readJson(req, 8 * 1024));

    const result = await updateOrderStatus({
      orderId: body.orderId.toUpperCase(),
      next: body.status as OrderStatus,
      note: body.note,
      adminEmail: guard.session.email,
    });

    if (!result.ok) {
      return fail(result.error, { status: result.status, code: 'TRANSITION_REJECTED' });
    }

    return ok(
      {
        orderId: result.order.orderId,
        status: result.order.status,
        shippingStatus: result.order.shipping.status,
        releasedStock: result.releasedStock,
        deliveredAt: result.order.deliveredAt
          ? new Date(result.order.deliveredAt).toISOString()
          : null,
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Persist an internal note without changing status. */
export async function PUT(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 8 * 1024)) as { orderId?: string; adminNote?: string };
    const orderId = (raw.orderId ?? '').trim().toUpperCase();
    if (!orderId) return fail('An orderId is required.', { status: 422, code: 'VALIDATION_ERROR' });

    await connectDb();
    const order = await Order.findOneAndUpdate(
      { orderId },
      { $set: { adminNote: (raw.adminNote ?? '').slice(0, 1000) } },
      { new: true },
    )
      .select('orderId adminNote')
      .exec();

    if (!order) return fail('Order not found.', { status: 404, code: 'NOT_FOUND' });
    return ok({ orderId: order.orderId, adminNote: order.adminNote }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Full refund through Razorpay.
 *
 * ADMIN-only, and refuses to run when Razorpay is unconfigured rather than
 * marking the order refunded locally and hiding the fact that no money moved.
 */
export async function POST(req: Request) {
  const guard = await guardAdmin(ELEVATED_ROLES);
  if (!guard.ok) return guard.response;

  try {
    const raw = (await readJson(req, 8 * 1024)) as {
      orderId?: string;
      amountPaise?: number;
      reason?: string;
    };

    const orderId = (raw.orderId ?? '').trim().toUpperCase();
    const amountPaise = Number(raw.amountPaise);
    if (!orderId || !Number.isFinite(amountPaise) || amountPaise <= 0) {
      return fail('An orderId and a positive refund amount (in paise) are required.', {
        status: 422,
        code: 'VALIDATION_ERROR',
      });
    }

    await connectDb();
    const order = await Order.findOne({ orderId }).exec();
    if (!order) return fail('Order not found.', { status: 404, code: 'NOT_FOUND' });

    if (order.payment.status !== 'PAID') {
      return fail(
        `This order is not in a paid state (currently ${order.payment.status}). Refund is not available.`,
        { status: 409, code: 'NOT_PAID' },
      );
    }
    if (!order.payment.razorpayPaymentId) {
      return fail('No Razorpay payment id is stored for this order.', {
        status: 409,
        code: 'NO_PAYMENT_ID',
      });
    }

    const already = order.payment.refundAmount ?? 0;
    const remaining = order.totalPaise - already;
    if (amountPaise > remaining) {
      return fail(
        `The refund cannot exceed ${remaining} paise (the remaining balance of this order).`,
        { status: 422, code: 'REFUND_TOO_LARGE' },
      );
    }

    const { refundPayment, isRazorpayReady } = await import('@/lib/razorpay');
    if (!isRazorpayReady()) {
      return fail('Razorpay is not configured on this server, so the refund cannot be issued.', {
        status: 503,
        code: 'RAZORPAY_NOT_CONFIGURED',
      });
    }

    const refund = await refundPayment({
      paymentId: order.payment.razorpayPaymentId,
      amountPaise,
      notes: {
        orderId: order.orderId,
        reason: (raw.reason ?? 'Customer request').slice(0, 200),
        admin: guard.session.email,
      },
    });

    const newTotal = already + amountPaise;
    order.payment.refundId = refund.refundId;
    order.payment.refundAmount = newTotal;
    order.payment.refundedAt = new Date();
    order.amountRefundedPaise = newTotal;
    if (newTotal >= order.totalPaise) {
      order.payment.status = 'REFUNDED';
      order.status = 'REFUNDED';
      order.statusHistory.push({
        status: 'REFUNDED',
        at: new Date(),
        source: 'ADMIN',
        note: `Full refund ${refund.refundId} issued by ${guard.session.email}`,
      });
    }
    order.statusHistory.push({
      status: order.status,
      at: new Date(),
      source: 'ADMIN',
      note: `Partial refund ${refund.refundId} (${amountPaise} paise) issued by ${guard.session.email}`,
    });
    await order.save();

    return ok(
      {
        refundId: refund.refundId,
        status: refund.status,
        refundedPaise: newTotal,
        orderStatus: order.status,
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}