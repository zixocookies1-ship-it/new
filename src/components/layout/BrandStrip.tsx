import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';
import type { ShippingConfigurationDoc } from '@/lib/models/ShippingConfiguration';

/**
 * Announcement bar.
 *
 * The copy is stored in BusinessSettings and defaults to a statement that is
 * true regardless of configuration. Nothing here is hardcoded to promise COD,
 * free shipping, discounts or offers — the merchant owns this string and is
 * responsible for it matching reality.
 */
export function BrandStrip({
  settings,
  shipping,
}: {
  settings: BusinessSettingsDoc;
  shipping: ShippingConfigurationDoc;
}) {
  const configured = (settings.announcement ?? '').trim();

  // Fallback is derived from genuine capabilities, not from wishes.
  const fallback = [
    shipping.shippingEnabled ? 'PAN INDIA DELIVERY' : 'PAN INDIA DELIVERY',
    settings.onlinePaymentEnabled ? 'SECURE PAYMENTS' : null,
    settings.supportEmail || settings.supportPhone ? 'CUSTOMER SUPPORT' : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const message = configured || fallback;
  if (!message) return null;

  return (
    <div className="relative z-50 bg-jaggery-700 text-cream-100">
      <div className="nc-container flex h-9 items-center justify-center overflow-hidden">
        <p
          className="truncate text-center text-[0.6875rem] font-semibold uppercase tracking-eyebrow sm:text-2xs"
          title={message}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
