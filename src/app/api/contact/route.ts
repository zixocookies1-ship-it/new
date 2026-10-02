import { connectDb } from '@/lib/db';
import { ContactMessage } from '@/lib/models/ContactMessage';
import { getBusinessSettings } from '@/lib/models/BusinessSettings';
import { ok, handleRouteError, noStore, rateLimited, fail } from '@/lib/http';
import { clientIp, hit, RATE_LIMITS } from '@/lib/rate-limit';
import { contactSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Contact form.
 *
 * - Honeypot: `website` must be empty. A filled hidden field is treated as a bot
 *   and silently accepted (no error) so the bot does not learn to retry.
 * - Rate limited per IP.
 * - Stores the enquiry in MongoDB for the admin inbox. There is no email
 *   provider wired up, so the response tells the customer exactly what happens
 *   next rather than promising a reply time we cannot keep.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req.headers);
    const rl = hit('contact', RATE_LIMITS.contact.limit, RATE_LIMITS.contact.windowMs, ip);
    if (!rl.ok) return rateLimited(rl.retryAfterSeconds);

    const body = contactSchema.parse(await req.json());

    // Honeypot tripped — pretend success, do not persist.
    if (body.website) {
      return ok(
        { received: true, message: 'Thanks — your message has been received.' },
        { headers: noStore },
      );
    }

    await connectDb();

    const settings = await getBusinessSettings();

    // Do not let one person flood the inbox by varying the subject line.
    const recentCount = await ContactMessage.countDocuments({
      email: body.email.toLowerCase(),
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    }).exec();
    if (recentCount >= 3) {
      return fail('You have already sent several messages recently. Please give us a moment to reply.', {
        status: 429,
        code: 'TOO_MANY_MESSAGES',
      });
    }

    await ContactMessage.create({
      name: body.name,
      email: body.email,
      phone: body.phone,
      subject: body.subject,
      message: body.message,
      source: body.subject.toLowerCase().includes('order') ? 'contact:order' : 'contact',
      status: 'NEW',
      ip: ip.slice(0, 64),
      userAgent: (req.headers.get('user-agent') ?? '').slice(0, 300),
    });

    return ok(
      {
        received: true,
        // Only name a channel we have actually configured.
        message: settings.supportEmail
          ? 'Thanks — your message has been received. We will reply by email at the address you provided.'
          : 'Thanks — your message has been received. Our team will get back to you by phone or email.',
      },
      { status: 201, headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}