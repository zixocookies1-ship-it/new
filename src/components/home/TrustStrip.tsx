import { Reveal } from '@/components/ui/Reveal';
import { PlaceholderNote } from '@/components/ui/PlaceholderNote';
import { readCards } from '@/lib/content';
import type { ContentDoc } from '@/lib/models/Content';
import type { StoreCapabilities } from '@/lib/integrations';
import type { ShippingConfigurationDoc } from '@/lib/models/ShippingConfiguration';

/**
 * Section 2 — Trust strip.
 *
 * The only assertions permitted here are ones the server can verify: which
 * payment methods are live, whether shipping is switched on, and merchant copy
 * an admin has written. Nothing here is decorative reassurance.
 */
export function TrustStrip({
  content,
  capabilities,
  shipping,
}: {
  content: ContentDoc | null;
  capabilities: StoreCapabilities;
  shipping: ShippingConfigurationDoc;
}) {
  const cards = readCards(content?.items);

  // Capability facts are appended after merchant copy so the strip can never be
  // empty on a live store, and never claims something that is switched off.
  const facts: Array<{ title: string; text: string }> = [];
  if (capabilities.onlinePayments) {
    facts.push({
      title: 'Secure online payment',
      text: 'Payments are processed by Razorpay. We never see or store your card or UPI credentials.',
    });
  }
  if (shipping.shippingEnabled) {
    facts.push({
      title: 'Tracked delivery',
      text: 'Orders are handed to our courier partner and you receive a waybill to follow.',
    });
  }
  if (capabilities.cod) {
    facts.push({
      title: 'Pay on delivery',
      text: 'Cash on delivery is available on eligible PIN codes.',
    });
  }

  const items = [...cards, ...facts];

  return (
    <section className="border-y border-leaf-200/70 bg-leaf-50" aria-labelledby="trust-heading">
      <div className="nc-container py-8 sm:py-10">
        <h2 id="trust-heading" className="sr-only">
          Why customers can order with confidence
        </h2>

        {content?.title?.trim() ? (
          <p className="mb-6 text-center font-display text-xl text-leaf-600 sm:text-2xl">
            {content.title}
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="flex justify-center">
            <PlaceholderNote label="Service details are being confirmed and will appear here shortly." />
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, 6).map((item, i) => (
              <Reveal as="li" key={`${item.title}-${i}`} delay={i * 70} className="flex gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-500/10 text-leaf-600"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M10 2.8 4 5.2v4.3c0 3.4 2.5 6.5 6 7.7 3.5-1.2 6-4.3 6-7.7V5.2L10 2.8Z" strokeLinejoin="round" />
                    <path d="M7.6 10 9.4 11.8 12.8 8.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="min-w-0">
                  {item.title ? (
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                  ) : null}
                  {item.text ? (
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">{item.text}</p>
                  ) : null}
                </div>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}