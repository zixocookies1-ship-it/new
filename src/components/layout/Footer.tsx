import Link from 'next/link';
import clsx from 'clsx';

import { Logo } from '@/components/brand/Logo';
import { FOOTER_NAV, BRAND } from '@/lib/site';
import type { BusinessSettingsDoc } from '@/lib/models/BusinessSettings';
import type { ShippingConfigurationDoc } from '@/lib/models/ShippingConfiguration';
import type { IntegrationHealth } from './SiteShell';
import type { MediaRef } from '@/lib/types';

/**
 * Footer.
 *
 * Everything printed here is conditional on a value actually existing in
 * BusinessSettings. No address, phone, GSTIN, FSSAI number or social link is
 * ever invented — if a field is empty, that line simply is not rendered.
 */
export function Footer({
  settings,
  shipping,
  health,
}: {
  settings: BusinessSettingsDoc;
  shipping: ShippingConfigurationDoc;
  health: IntegrationHealth;
}) {
  const year = new Date().getFullYear();

  const addressLines = [
    settings.businessAddressLine1,
    settings.businessAddressLine2,
    [settings.businessCity, settings.businessState, settings.businessPincode]
      .filter(Boolean)
      .join(', '),
    settings.businessCountry,
  ].filter(Boolean);

  const social = [
    { key: 'instagram', label: 'Instagram', href: settings.social?.instagram },
    { key: 'facebook', label: 'Facebook', href: settings.social?.facebook },
    { key: 'youtube', label: 'YouTube', href: settings.social?.youtube },
    { key: 'x', label: 'X', href: settings.social?.x },
    { key: 'linkedin', label: 'LinkedIn', href: settings.social?.linkedin },
  ].filter((s) => Boolean(s.href));

  const hasContact = Boolean(
    settings.supportPhone || settings.supportEmail || settings.whatsappNumber || addressLines.length,
  );

  // Capability statements are derived from configuration, never asserted.
  const capabilities: string[] = [];
  if (shipping.shippingEnabled) capabilities.push('Shipping across India');
  if (settings.onlinePaymentEnabled && health.razorpay === 'configured')
    capabilities.push('Secure online payments');
  if (shipping.codEnabled) capabilities.push('Cash on delivery available');
  if (shipping.freeShippingEnabled && shipping.freeShippingThresholdPaise)
    capabilities.push('Free shipping above a threshold');
  if (health.delhivery === 'configured') capabilities.push('Tracked delivery');

  return (
    <footer className="mt-20 bg-jaggery-700 text-cream-200 lg:mt-28">
      <div className="nc-container py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Logo logo={settings.logo as MediaRef | null} variant="dark" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream-200/80">
              {settings.description ||
                'Pure jaggery with a chocolatey twist — made for the modern Indian home.'}
            </p>

            {capabilities.length > 0 ? (
              <ul className="mt-5 space-y-1.5">
                {capabilities.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-[0.8125rem] text-cream-200/80">
                    <svg
                      viewBox="0 0 16 16"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ginger-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {c}
                  </li>
                ))}
              </ul>
            ) : null}

            {social.length > 0 ? (
              <ul className="mt-6 flex flex-wrap gap-2">
                {social.map((s) => (
                  <li key={s.key}>
                    <a
                      href={s.href!}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream-200/20 text-cream-200 transition-colors hover:border-ginger-400 hover:bg-cream-50/10"
                      aria-label={s.label}
                    >
                      <SocialIcon name={s.key} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Nav columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-5 lg:gap-6">
            <FooterColumn title="Shop" links={FOOTER_NAV.shop} />
            <FooterColumn title="Learn" links={FOOTER_NAV.learn} />
            {FOOTER_NAV.policies.length > 0 && (
              <div className="col-span-2 sm:col-span-1">
                <FooterColumn title="Policies" links={FOOTER_NAV.policies} />
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h2 className="font-display text-base text-cream-50">Contact</h2>
            {hasContact ? (
              <address className="mt-4 space-y-3 not-italic text-sm text-cream-200/80">
                {settings.supportPhone ? (
                  <p>
                    <a
                      href={`tel:${settings.supportPhone.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-2 transition-colors hover:text-cream-50"
                    >
                      <FooterIcon name="phone" />
                      {settings.supportPhone}
                    </a>
                  </p>
                ) : null}

                {settings.supportEmail ? (
                  <p>
                    <a
                      href={`mailto:${settings.supportEmail}`}
                      className="inline-flex items-center gap-2 break-all transition-colors hover:text-cream-50"
                    >
                      <FooterIcon name="mail" />
                      {settings.supportEmail}
                    </a>
                  </p>
                ) : null}

                {settings.whatsappNumber ? (
                  <p>
                    <a
                      href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 transition-colors hover:text-cream-50"
                    >
                      <FooterIcon name="whatsapp" />
                      WhatsApp {settings.whatsappNumber}
                    </a>
                  </p>
                ) : null}

                {addressLines.length > 0 ? (
                  <p className="flex gap-2 leading-relaxed">
                    <span className="mt-0.5 shrink-0">
                      <FooterIcon name="pin" />
                    </span>
                    <span>
                      {addressLines.map((l) => (
                        <span key={l} className="block">
                          {l}
                        </span>
                      ))}
                    </span>
                  </p>
                ) : null}

                {settings.businessHours ? (
                  <p className="text-cream-200/70">{settings.businessHours}</p>
                ) : null}
              </address>
            ) : (
              <p className="mt-4 text-sm text-cream-200/70">
                Contact details are being published shortly.
              </p>
            )}

            <Link href="/contact" className="nc-btn-outline nc-btn-sm mt-5 border-cream-200/25 text-cream-50 hover:border-cream-50/50 hover:bg-cream-50/10">
              Contact us
            </Link>
          </div>
        </div>

        {/* Legal / registration — only when actually configured */}
        {settings.legalName || settings.fssaiNumber || settings.gstNumber || settings.cinNumber ? (
          <div className="mt-12 border-t border-cream-200/12 pt-8">
            <h2 className="sr-only">Legal &amp; registration details</h2>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {settings.legalName ? <LegalItem label="Legal name" value={settings.legalName} /> : null}
              {settings.gstNumber ? <LegalItem label="GSTIN" value={settings.gstNumber} /> : null}
              {settings.fssaiNumber ? (
                <LegalItem label="FSSAI Lic. No." value={settings.fssaiNumber} />
              ) : null}
              {settings.cinNumber ? <LegalItem label="CIN" value={settings.cinNumber} /> : null}
            </dl>
          </div>
        ) : null}
      </div>

      <div className="border-t border-cream-200/12">
        <div className="nc-container flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-cream-200/60">
            © {year} {settings.legalName || settings.brandName || BRAND.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h2 className="font-display text-base text-cream-50">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-cream-200/75 transition-colors hover:text-cream-50"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LegalItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-eyebrow text-cream-200/50">{label}</dt>
      <dd className="mt-1 text-[0.8125rem] text-cream-100/90">{value}</dd>
    </div>
  );
}

function FooterIcon({ name }: { name: 'phone' | 'mail' | 'whatsapp' | 'pin' }) {
  const cls = 'h-4 w-4 shrink-0 text-ginger-300';
  const paths = {
    phone: 'M2.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.7 1.5C8.4 18.5 5.5 15.6 4 8.7A1.5 1.5 0 0 1 5.5 7',
    mail: 'M2 4.5h20v15H2zM2 5l10 7.5L22 5',
    whatsapp: 'M2.5 17.5 4 12.8a7.5 7.5 0 1 1 3 2.9l-4.5 1.8ZM9 9.5c0 3 2.5 5.5 5.5 5.5.6 0 1.2-.4 1.4-1l.1-.5-2-.8-.8.8a5.6 5.6 0 0 1-2.2-2.2l.8-.8-.8-2-.5.1c-.6.2-1 .8-1 1.4Z',
    pin: 'M10 18s6-5.2 6-9.5a6 6 0 1 0-12 0C4 12.8 10 18 10 18Zm0-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  };
  return (
    <svg viewBox="0 0 20 20" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SocialIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    instagram:
      'M7.5 3.5h-2A3.5 3.5 0 0 0 2 7v6a3.5 3.5 0 0 0 3.5 3.5h5A3.5 3.5 0 0 0 14 13V7a3.5 3.5 0 0 0-3.5-3.5h-2M7.5 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm3.5-.5h.01',
    facebook: 'M11 17v-6h2.2l.3-2.5H11V7.2c0-.7.2-1.2 1.2-1.2h1.3V3.8c-.2 0-1-.1-1.9-.1-1.9 0-3.1 1.1-3.1 3.2v1.6H6.3V11h2.2v6H11Z',
    youtube:
      'M17.5 7.5a2 2 0 0 0-1.4-1.4C14.8 5.8 10 5.8 10 5.8s-4.8 0-6.1.3A2 2 0 0 0 2.5 7.5C2.2 8.8 2.2 12 2.2 12s0 3.2.3 4.5a2 2 0 0 0 1.4 1.4c1.3.3 6.1.3 6.1.3s4.8 0 6.1-.3a2 2 0 0 0 1.4-1.4c.3-1.3.3-4.5.3-4.5s0-3.2-.3-4.5ZM8.7 14.3V9.7L13.3 12l-4.6 2.3Z',
    x: 'M3.5 3.5h4l3.4 4.6 3.9-4.6h2.2l-5 5.8 5.3 6.2h-4l-3.6-4.9-4.2 4.9H3.7l5.4-6.2-5.6-5.8Z',
    linkedin:
      'M4.5 3.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM3 8h3v8.5H3V8Zm5.5 0H11v1.2c.4-.7 1.3-1.4 2.7-1.4 2.4 0 3.3 1.5 3.3 3.9v4.8h-3v-4.3c0-1.2-.4-2-1.5-2-1 0-1.5.7-1.5 2v4.3h-3V8Z',
  };
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
      <path d={paths[name] ?? paths.x} />
    </svg>
  );
}

export { clsx };
