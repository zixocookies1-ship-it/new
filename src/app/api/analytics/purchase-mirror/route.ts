import crypto from 'node:crypto';

import { connectDb } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { ok, fail, handleRouteError, noStore, rateLimited } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { getBusinessSettings } from '@/lib/models/BusinessSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-side Meta Conversions API mirror for `purchase`.
 *
 * The browser Pixel event can be blocked by an ad blocker, so a matching
 * server-side event is sent for reliable attribution. The dedupe is enforced
 * here against the database (`analyticsPurchaseSentAt`), not just in
 * localStorage, so a retry cannot double-count revenue.
 *
 * We deliberately do NOT invent a pixel id or access token. If the brand has
 * not configured them, this returns a clear "not configured" result rather than
 * pretending the mirror succeeded.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('capi:mirror', RATE_LIMITS.adminWrite.limit, RATE_LIMITS.adminWrite.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = (await req.json()) as {
      orderId?: unknown;
      value?: unknown;
    };

    const orderId = typeof body.orderId === 'string' ? body.orderId.trim().toUpperCase() : '';
    if (!orderId || orderId.length > 40) {
      return fail('An order ID is required.', { status: 422, code: 'VALIDATION_ERROR' });
    }

    await connectDb();

    // Atomic claim: only the first caller wins.
    const claimed = await Order.findOneAndUpdate(
      { orderId, analyticsPurchaseSentAt: null, 'payment.status': 'PAID' },
      { $set: { analyticsPurchaseSentAt: new Date() } },
      { new: true },
    ).exec();

    if (!claimed) {
      return ok(
        { mirrored: false, reason: 'Already mirrored or not a paid order.' },
        { headers: noStore },
      );
    }

    const settings = await getBusinessSettings({ fresh: true });
    const capi = process.env.META_CAPI_ACCESS_TOKEN;
    const pixelId = process.env.META_PIXEL_ID ?? '';

    if (!capi || !pixelId) {
      // Release the claim so the event can be retried once configured.
      await Order.updateOne(
        { orderId, analyticsPurchaseSentAt: claimed.analyticsPurchaseSentAt },
        { $set: { analyticsPurchaseSentAt: null } },
      ).exec();

      return fail('Conversions API is not configured on this server.', {
        status: 503,
        code: 'CAPI_NOT_CONFIGURED',
      });
    }

    const eventName = `Purchase_${orderId}`;
    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(claimed.createdAt.getTime() / 1000),
          event_id: orderId,
          action_source: 'website',
          event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/order/${orderId}`,
          user_data: {
            // SHA256 of normalised identifiers, as Meta requires.
            em: claimed.email ? [crypto.createHash('sha256').update(claimed.email.trim().toLowerCase()).digest('hex')] : [],
            ph: claimed.phone
              ? [crypto.createHash('sha256').update(normalisePhone(claimed.phone)).digest('hex')]
              : [],
            client_ip_address: ip,
          },
          custom_data: {
            currency: 'INR',
            value: claimed.totalPaise / 100,
            content_ids: claimed.items.map((i) => i.sku).filter(Boolean),
            content_type: 'product',
            num_items: claimed.items.reduce((s, i) => s + i.qty, 0),
          },
        },
      ],
      // Lets Meta dedupe against the browser Pixel event.
      access_token: capi,
    };

    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as {
      events_received?: number;
      error?: { message?: string };
    };

    if (!res.ok || json.error) {
      await Order.updateOne(
        { orderId, analyticsPurchaseSentAt: claimed.analyticsPurchaseSentAt },
        { $set: { analyticsPurchaseSentAt: null } },
      ).exec();
      console.error('[capi] mirror failed', json.error ?? res.status);
      return fail('Conversions API rejected the event.', {
        status: 502,
        code: 'CAPI_REJECTED',
      });
    }

    return ok({ mirrored: true, eventName, eventsReceived: json.events_received ?? 0 }, { headers: noStore });
  } catch (err) {
    return handleRouteError(err);
  }
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Strip +91 / spaces / dashes so phone hashes match Meta's expectations. */
function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}