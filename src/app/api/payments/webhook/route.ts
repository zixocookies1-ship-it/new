import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { verifyWebhookSignature, fetchPayment } from '@/lib/razorpay';
import { connectDb } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { applySuccessfulPayment, refreshOrderTracking } from '@/lib/orders';
import { isDelhiveryReady } from '@/lib/delhivery';
import { safeCompare } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Razorpay webhook receiver.
 *
 * Two properties matter more than anything else here:
 *
 *  1. The signature is verified against the RAW request body using a dedicated
 *     `RAZORPAY_WEBHOOK_SECRET`. If that secret is missing the check returns
 *     false and we accept nothing — an unverified event is never processed.
 *  2. Every event is idempotent by event id, stored on the order. A retry from
 *     Razorpay, a duplicate delivery, and a race with the browser callback all
 *     converge on exactly one state transition.
 */

/** Stable id per (event name, raw body) so retries collapse into one write. */
function eventFingerprint(eventName: string, rawBody: string): string {
  return crypto
    .createHash('sha256')
    .update(`${eventName}:${rawBody}`)
    .digest('hex')
    .slice(0, 24);
}

interface WebhookEntity {
  id?: string;
  order_id?: string;
  payment_id?: string;
  amount?: number;
  amount_paid?: number;
  notes?: Record<string, string>;
  error_description?: string;
  status?: string;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    // 401 tells Razorpay the delivery was not accepted.
    return NextResponse.json(
      { ok: false, error: 'Invalid webhook signature.' },
      { status: 401 },
    );
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: WebhookEntity };
      order?: { entity?: WebhookEntity };
      refund?: { entity?: WebhookEntity };
    };
  };

  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  const eventName = event.event ?? 'unknown';
  const eventId = eventFingerprint(eventName, rawBody);

  try {
    await connectDb();

    /* ------------------------------------------------------------------ */
    /* payment.captured / payment.failed                                   */
    /* ------------------------------------------------------------------ */
    if (eventName === 'payment.captured' || eventName === 'payment.failed') {
      const entity = event.payload?.payment?.entity ?? {};
      const paymentId = entity.id;
      if (!paymentId) return NextResponse.json({ ok: false, error: 'Missing payment id.' }, { status: 400 });

      const internalId = entity.notes?.internalOrderId;
      const order = internalId
        ? await Order.findById(internalId).exec()
        : await Order.findOne({ 'payment.razorpayOrderId': entity.order_id ?? '' }).exec();

      if (!order) {
        // Acknowledge so Razorpay stops retrying, but log loudly — this means
        // our order lookup is broken, not that the event is junk.
        console.warn(
          `[razorpay:webhook] no order matched payment ${paymentId} / ${entity.order_id}`,
        );
        return NextResponse.json({ ok: true, ignored: true });
      }

      if (order.payment.webhookEvents?.includes(eventId)) {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      if (eventName === 'payment.captured') {
        // Re-fetch from Razorpay rather than trusting the webhook payload:
        // the signature proves origin, the fetch proves the money moved.
        const payment = await fetchPayment(paymentId);

        if (payment.orderId !== order.payment.razorpayOrderId) {
          console.warn(
            `[razorpay:webhook] payment ${paymentId} belongs to ${payment.orderId}, not ${order.payment.razorpayOrderId}`,
          );
          return NextResponse.json({ ok: false, error: 'Payment/order mismatch.' }, { status: 400 });
        }
        if (payment.amount !== order.totalPaise) {
          console.warn(
            `[razorpay:webhook] amount mismatch on ${order.orderId}: ${payment.amount} vs ${order.totalPaise}`,
          );
          return NextResponse.json({ ok: false, error: 'Amount mismatch.' }, { status: 400 });
        }

        const { applied } = await applySuccessfulPayment(order._id, payment, 'webhook');
        await Order.updateOne(
          { _id: order._id },
          { $addToSet: { 'payment.webhookEvents': eventId } },
        ).exec();

        return NextResponse.json({ ok: true, applied });
      }

      // payment.failed — never downgrade an order that is already paid.
      if (order.payment.status !== 'PAID') {
        order.payment.status = 'FAILED';
        order.payment.failureCode = 'GATEWAY_FAILED';
        order.payment.failureDescription =
          entity.error_description ?? 'Payment failed at the gateway.';
        order.payment.razorpayPaymentId = paymentId;
        await order.save();
      }
      await Order.updateOne(
        { _id: order._id },
        { $addToSet: { 'payment.webhookEvents': eventId } },
      ).exec();

      return NextResponse.json({ ok: true, failed: true });
    }

    /* ------------------------------------------------------------------ */
    /* refund.processed / payment.refunded                                 */
    /* ------------------------------------------------------------------ */
    if (eventName === 'payment.refunded' || eventName === 'refund.processed') {
      const entity = event.payload?.refund?.entity ?? event.payload?.payment?.entity ?? {};
      const paymentId = entity.payment_id;
      if (!paymentId) return NextResponse.json({ ok: true, ignored: true });

      const order = await Order.findOne({ 'payment.razorpayPaymentId': paymentId }).exec();
      if (!order) return NextResponse.json({ ok: true, ignored: true });
      if (order.payment.webhookEvents?.includes(eventId)) {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      if (order.payment.status === 'PAID') {
        order.payment.status = 'REFUNDED';
        order.payment.refundId = entity.id ?? null;
        order.payment.refundAmount = entity.amount ?? order.totalPaise;
        order.payment.refundedAt = new Date();
        order.status = 'REFUNDED';
        order.statusHistory.push({
          status: 'REFUNDED',
          at: new Date(),
          source: 'WEBHOOK',
          note: `Refund ${entity.id ?? ''} processed by Razorpay`.trim(),
        });
        await order.save();
      }

      await Order.updateOne(
        { _id: order._id },
        { $addToSet: { 'payment.webhookEvents': eventId } },
      ).exec();
      return NextResponse.json({ ok: true, refunded: true });
    }

    /* ------------------------------------------------------------------ */
    /* order.paid — backup confirmation path                               */
    /* ------------------------------------------------------------------ */
    if (eventName === 'order.paid') {
      const entity = event.payload?.order?.entity ?? {};
      const order = entity.notes?.internalOrderId
        ? await Order.findById(entity.notes.internalOrderId).exec()
        : await Order.findOne({ 'payment.razorpayOrderId': entity.id ?? '' }).exec();

      if (!order || order.payment.status === 'PAID') {
        return NextResponse.json({ ok: true, ignored: true });
      }
      // `order.paid` carries no payment id, so we cannot capture here. The
      // browser callback and `payment.captured` are the authoritative paths.
      console.warn(`[razorpay:webhook] order.paid for ${order.orderId} — awaiting payment.captured`);
      return NextResponse.json({ ok: true, awaitingCapture: true });
    }

    /* ------------------------------------------------------------------ */
    /* Anything else — acknowledged, not processed. Shipment status is      */
    /* authoritative from our own polling of the courier.                   */
    /* ------------------------------------------------------------------ */
    return NextResponse.json({ ok: true, received: eventName });
  } catch (err) {
    // 500 makes Razorpay retry — correct behaviour for a transient failure.
    console.error('[razorpay:webhook] handler error', err);
    return NextResponse.json({ ok: false, error: 'Webhook processing failed.' }, { status: 500 });
  }
}

/**
 * Background refresh endpoint.
 *
 * Pulls the current courier status for one order, or for a batch of in-flight
 * orders. Not called by the browser; intended for a cron job / Vercel Cron so
 * tracking stays fresh without a customer waiting on a live courier call.
 */
export async function GET(req: Request) {
  const secret = process.env.INTERNAL_API_KEY;
  const provided = req.headers.get('x-internal-key');

  if (!secret || !provided || !safeCompare(provided, secret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }
  if (!isDelhiveryReady()) {
    return NextResponse.json({ ok: false, error: 'Delhivery is not configured.' }, { status: 503 });
  }

  await connectDb();

  const orderId = (new URL(req.url).searchParams.get('orderId') ?? '').trim();

  if (orderId) {
    const order = await Order.findOne({ orderId }).exec();
    if (!order) return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    const res = await refreshOrderTracking(orderId);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      changed: res.changed,
      status: res.order.shipping.status,
    });
  }

  // Batch mode — only orders that already have a waybill are refreshable.
  const orders = await Order.find({
    'shipping.waybill': { $ne: null },
    status: { $in: ['PAID', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('orderId')
    .exec();

  let updated = 0;
  const failed: string[] = [];
  for (const order of orders) {
    try {
      const res = await refreshOrderTracking(order.orderId);
      if (!res.ok) failed.push(`${order.orderId}: ${res.error}`);
      else if (res.changed) updated += 1;
    } catch {
      // One bad waybill must not abort the batch.
      failed.push(`${order.orderId}: courier lookup threw`);
    }
  }

  return NextResponse.json({
    ok: true,
    mode: 'batch',
    scanned: orders.length,
    updated,
    ...(failed.length ? { failed } : {}),
  });
}