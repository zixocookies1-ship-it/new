import crypto from 'node:crypto';

import { connectDb } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Product } from '@/lib/models/Product';
import { Review } from '@/lib/models/Review';
import { ok, fail, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { reviewSubmitSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Review submission.
 *
 * Anti-scam rules baked into the endpoint, not just the UI:
 *
 *  - Every review starts as `PENDING` with `permissionConfirmed: false`. It is
 *    invisible on the storefront until a human approves it.
 *  - `isVerifiedPurchase` is only ever true when we match the supplied order ID
 *    (or contact detail) to a PAID order that actually contained the product.
 *    There is no way for a client to set that flag.
 *  - A fingerprint of the reviewer prevents the same person from reviewing the
 *    same product twice.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('reviews', RATE_LIMITS.review.limit, RATE_LIMITS.review.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = reviewSubmitSchema.parse(await req.json());

    // Honeypot — accept silently so bots do not learn.
    if (body.website) {
      return ok({ submitted: true, pendingModeration: true }, { headers: noStore });
    }

    await connectDb();

    const product = await Product.findById(body.productId).exec();
    if (!product || !product.isActive) {
      return fail('That product could not be found.', { status: 404, code: 'NOT_FOUND' });
    }

    /* --- Verified purchase determination --------------------------------- */
    let matchedOrder = null;
    if (body.orderId) {
      const order = await Order.findOne({ orderId: body.orderId.toUpperCase() }).exec();
      if (
        order &&
        order.payment.status === 'PAID' &&
        order.items.some((i) => String(i.productId ?? '') === String(product._id))
      ) {
        // If a contact was supplied it must match the order.
        const contactOk =
          !body.contact ||
          (!!order.email && order.email.toLowerCase() === body.contact.toLowerCase()) ||
          order.phone === body.contact;
        if (contactOk) matchedOrder = order;
      }
    } else if (body.contact) {
      const orders = await Order.find({
        'payment.status': 'PAID',
        $or: [{ email: body.contact.toLowerCase() }, { phone: body.contact }],
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .exec();
      matchedOrder =
        orders.find((o) => o.items.some((i) => String(i.productId ?? '') === String(product._id))) ?? null;
    }

    /* --- One review per person per product -------------------------------- */
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${body.authorName.trim().toLowerCase()}|${product._id}`)
      .digest('hex');

    const duplicate = await Review.findOne({
      productId: product._id,
      fingerprint,
    }).exec();
    if (duplicate) {
      return fail('You have already shared a review for this product.', {
        status: 409,
        code: 'DUPLICATE_REVIEW',
      });
    }

    await Review.create({
      productId: product._id,
      orderId: matchedOrder?._id ?? null,
      authorName: body.authorName.trim(),
      authorLocation: (body.authorLocation ?? '').trim(),
      images: [],
      videoUrl: null,
      rating: body.rating,
      title: (body.title ?? '').trim(),
      body: body.body.trim(),
      isVerifiedPurchase: Boolean(matchedOrder),
      permissionConfirmed: false,
      status: 'PENDING',
      fingerprint,
    });

    return ok(
      {
        submitted: true,
        pendingModeration: true,
        verifiedPurchase: Boolean(matchedOrder),
        message: matchedOrder
          ? 'Thanks! Your review is verified against a paid order and will appear once our team has read it.'
          : 'Thanks! Your review will appear once our team has read it.',
      },
      { status: 201, headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}