import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { BusinessSettings, getBusinessSettings, invalidateSettingsCache } from '@/lib/models/BusinessSettings';
import { isRazorpayReady } from '@/lib/razorpay';
import { isDelhiveryReady } from '@/lib/delhivery';
import { integrationState } from '@/lib/env';
import { ok, fail, handleRouteError, noStore, readJson } from '@/lib/http';
import { settingsUpdateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const settings = await getBusinessSettings({ fresh: true });
    const razorpayKeys = integrationState('razorpay') === 'configured';

    return ok(
      {
        settings,
        /**
         * Capability warnings the admin MUST see before enabling anything.
         * `onlinePaymentEnabled` is force-disabled in the response when the
         * Razorpay keys are absent, so the toggle can never advertise a payment
         * option that cannot complete.
         */
        capability: {
          razorpayConfigured: razorpayKeys,
          delhiveryConfigured: isDelhiveryReady(),
          cloudinaryConfigured: integrationState('cloudinary') === 'configured',
          onlinePaymentEffective: razorpayKeys && settings.onlinePaymentEnabled,
          blockers: [
            ...(razorpayKeys
              ? []
              : ['RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set. Online payments cannot be enabled.']),
            ...(isDelhiveryReady()
              ? []
              : ['DELHIVERY_API_KEY is not set. Shipping and tracking stay unavailable.']),
            ...(settings.isVerified
              ? []
              : ['Business details are still marked unverified. Legal / registration values will not be published.']),
          ],
        },
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Partial settings update.
 *
 * Merges onto the stored document rather than replacing it, so a form that
 * submits one field cannot blank out the rest of the business profile.
 */
export async function PATCH(req: Request) {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = settingsUpdateSchema.parse(await readJson(req, 64 * 1024));

    await connectDb();
    const current = await BusinessSettings.findOne({}).exec();
    if (!current) {
      return fail('Settings document not found.', { status: 404, code: 'NOT_FOUND' });
    }

    // Never let online payments be switched on without real Razorpay keys.
    if (body.onlinePaymentEnabled === true && !isRazorpayReady()) {
      return fail(
        'Razorpay is not configured on this server, so online payments cannot be enabled yet.',
        { status: 409, code: 'RAZORPAY_NOT_CONFIGURED' },
      );
    }

    current.set(body as never);
    await current.save();
    invalidateSettingsCache();

    const fresh = await getBusinessSettings({ fresh: true });
    return ok(
      { settings: fresh, onlinePaymentEffective: isRazorpayReady() && fresh.onlinePaymentEnabled },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}