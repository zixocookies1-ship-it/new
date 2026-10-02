'use client';

import { useEffect, useState } from 'react';

import { adminFetch } from './api';
import { ImageField } from './ImageField';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  AdminInput,
  AdminTextarea,
  AdminToggle,
  Btn,
  InlineAlert,
  Loading,
  PageHeader,
  Panel,
  Pill,
} from './ui';
import type { AdminBusinessSettings } from './types';

interface SettingsResponse {
  settings: AdminBusinessSettings;
  capability: {
    razorpayConfigured: boolean;
    delhiveryConfigured: boolean;
    cloudinaryConfigured: boolean;
    onlinePaymentEffective: boolean;
    blockers: string[];
  };
}

/**
 * Business settings.
 *
 * Everything on this screen is a *fact the merchant owns*, so the panel never
 * fills it in on their behalf. Empty stays empty and the storefront renders a
 * neutral state rather than a fabricated address, licence number or biography.
 * Capability flags (online payment, notification channels) are gated on the
 * server actually being configured, so a toggle here can never advertise
 * something that cannot complete.
 */
export function SettingsClient() {
  const { data, error, loading, reload } = useAdminData<SettingsResponse>('/api/admin/settings');
  const [form, setForm] = useState<AdminBusinessSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const action = useAdminAction();

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const patch = <K extends keyof AdminBusinessSettings>(
    key: K,
    value: AdminBusinessSettings[K],
  ) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const patchSocial = (key: keyof AdminBusinessSettings['social'], value: string) =>
    setForm((f) => (f ? { ...f, social: { ...f.social, [key]: value } } : f));
  const patchNotifications = (
    key: keyof AdminBusinessSettings['notifications'],
    value: AdminBusinessSettings['notifications'][keyof AdminBusinessSettings['notifications']],
  ) => setForm((f) => (f ? { ...f, notifications: { ...f.notifications, [key]: value } } : f));

  async function save() {
    if (!form) return;
    const res = await action.run(() =>
      adminFetch<{ settings: AdminBusinessSettings }>('/api/admin/settings', {
        method: 'PATCH',
        body: form,
      }),
    );
    if (res) {
      setForm(res.settings);
      setSaved(true);
      reload();
    }
  }

  if (loading && !form) return <Loading label="Loading business settings…" />;
  if (error && !form) {
    return (
      <InlineAlert tone="bad" title="Could not load settings">
        {error}
      </InlineAlert>
    );
  }
  if (!form) return null;

  const dirty = JSON.stringify(form) !== JSON.stringify(data?.settings);
  const cap = data?.capability;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Business identity, contact details, registrations and capability switches."
        action={
          <Btn variant="primary" onClick={() => void save()} disabled={action.busy || !dirty}>
            {action.busy ? 'Saving…' : 'Save settings'}
          </Btn>
        }
      />

      {action.error ? (
        <div className="mb-4">
          <InlineAlert tone="bad" title="Could not save">
            {action.error}
          </InlineAlert>
        </div>
      ) : null}
      {saved && !action.error ? (
        <div className="mb-4">
          <InlineAlert tone="good">Settings saved. The storefront picks these up immediately.</InlineAlert>
        </div>
      ) : null}
      {cap?.blockers.length ? (
        <div className="mb-4">
          <InlineAlert tone="warn" title="Not ready for launch">
            <ul className="list-disc pl-4">
              {cap.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </InlineAlert>
        </div>
      ) : null}

      <div className="space-y-4">
        {/* --------------------------------------------------------------- */}
        <Panel
          title="Brand"
          description="Shown in the header, footer, browser tab and structured data."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInput
              label="Brand name"
              value={form.brandName}
              onChange={(e) => patch('brandName', e.target.value)}
              required
            />
            <AdminInput
              label="Tagline"
              value={form.tagline}
              onChange={(e) => patch('tagline', e.target.value)}
            />
            <div className="sm:col-span-2">
              <AdminTextarea
                label="One-line description"
                rows={3}
                value={form.description}
                onChange={(e) => patch('description', e.target.value)}
                hint="Used for the default meta description. Keep it factual — no health claims."
              />
            </div>
          </div>

          <div className="mt-4 border-t border-cream-200 pt-4">
            <ImageField
              label="Logo / wordmark"
              hint="Optional. Without one, the header renders the brand name in the display typeface. Stored on Cloudinary."
              value={form.logo}
              onChange={(v) => patch('logo', v)}
              roles={['logo', 'gallery']}
              folder="natures-choice/brand"
            />
          </div>
        </Panel>

        {/* --------------------------------------------------------------- */}
        <Panel
          title="Contact"
          description="Each field is optional and only rendered where it has a value."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AdminInput
              label="Support phone"
              type="tel"
              value={form.supportPhone}
              onChange={(e) => patch('supportPhone', e.target.value)}
              placeholder="98765 43210"
            />
            <AdminInput
              label="Support email"
              type="email"
              value={form.supportEmail}
              onChange={(e) => patch('supportEmail', e.target.value)}
              placeholder="support@example.com"
            />
            <AdminInput
              label="WhatsApp number"
              type="tel"
              value={form.whatsappNumber}
              onChange={(e) => patch('whatsappNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
              hint="Digits only, with country code. Blank = no WhatsApp button."
            />
            <AdminInput
              label="Business hours"
              value={form.businessHours}
              onChange={(e) => patch('businessHours', e.target.value)}
              placeholder="Mon–Sat, 10am – 7pm IST"
            />
          </div>
        </Panel>

        {/* --------------------------------------------------------------- */}
        <Panel
          title="Registered address"
          description="Appears on policy pages and in structured data. Nothing here is invented for you."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-2">
              <AdminInput
                label="Address line 1"
                value={form.businessAddressLine1}
                onChange={(e) => patch('businessAddressLine1', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <AdminInput
                label="Address line 2"
                value={form.businessAddressLine2}
                onChange={(e) => patch('businessAddressLine2', e.target.value)}
              />
            </div>
            <AdminInput
              label="City"
              value={form.businessCity}
              onChange={(e) => patch('businessCity', e.target.value)}
            />
            <AdminInput
              label="State"
              value={form.businessState}
              onChange={(e) => patch('businessState', e.target.value)}
            />
            <AdminInput
              label="PIN code"
              inputMode="numeric"
              maxLength={6}
              value={form.businessPincode}
              onChange={(e) => patch('businessPincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <AdminInput
              label="Country"
              value={form.businessCountry}
              onChange={(e) => patch('businessCountry', e.target.value)}
            />
          </div>
        </Panel>

        {/* --------------------------------------------------------------- */}
        <Panel
          title="Registrations"
          description="Food licence, GST and company registration. Blank fields are simply not printed anywhere."
          action={
            <Pill tone={form.isVerified ? 'good' : 'warn'}>
              {form.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
            </Pill>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminInput
              label="FSSAI number"
              value={form.fssaiNumber}
              onChange={(e) => patch('fssaiNumber', e.target.value.toUpperCase())}
            />
            <AdminInput
              label="GST number"
              value={form.gstNumber}
              onChange={(e) => patch('gstNumber', e.target.value.toUpperCase())}
            />
            <AdminInput
              label="CIN / registration number"
              value={form.cinNumber}
              onChange={(e) => patch('cinNumber', e.target.value.toUpperCase())}
              hint="Leave blank if not registered as a company."
            />
          </div>

          <div className="mt-4">
            <AdminToggle
              tone="warning"
              label="I have checked these details against my actual documents"
              description="Until this is on, the storefront will not print registration numbers or a legal business address anywhere. This exists so a placeholder never masquerades as a real licence."
              checked={form.isVerified}
              onChange={(v) => patch('isVerified', v)}
            />
          </div>
        </Panel>

        {/* --------------------------------------------------------------- */}
        <Panel
          title="Payments"
          description="Online payment can only be switched on when Razorpay keys are present on the server."
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={cap?.razorpayConfigured ? 'good' : 'bad'}>
                Razorpay {cap?.razorpayConfigured ? 'CONNECTED' : 'NOT CONNECTED'}
              </Pill>
              <Pill tone={cap?.onlinePaymentEffective ? 'good' : 'warn'}>
                Pay online {cap?.onlinePaymentEffective ? 'LIVE' : 'OFF'}
              </Pill>
            </div>

            <AdminToggle
              tone="warning"
              label="Accept online payment"
              description="Turn on only once Razorpay is connected and you have tested a real payment."
              checked={form.onlinePaymentEnabled}
              onChange={(v) => patch('onlinePaymentEnabled', v)}
              disabled={!cap?.razorpayConfigured}
            />

            {!cap?.razorpayConfigured ? (
              <InlineAlert tone="warn">
                Set <code className="font-mono">RAZORPAY_KEY_ID</code>,{' '}
                <code className="font-mono">RAZORPAY_KEY_SECRET</code> and{' '}
                <code className="font-mono">NEXT_PUBLIC_RAZORPAY_KEY_ID</code> in{' '}
                <code className="font-mono">.env.local</code>, then restart the server. Until then
                checkout shows a clear &ldquo;payments are being set up&rdquo; state rather than a
                button that cannot work.
              </InlineAlert>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput
                label="Gateway name shown to customers"
                value={form.razorpayDisplayName}
                onChange={(e) => patch('razorpayDisplayName', e.target.value)}
                placeholder="Leave blank to use the generic 'secure payment' wording"
              />
            </div>

            <p className="text-xs text-ink-muted">
              Cash on delivery lives under <strong>Shipping</strong>, because it needs an order limit
              and a working courier to be safe.
            </p>
          </div>
        </Panel>

        {/* --------------------------------------------------------------- */}
        <Panel
          title="Storefront chrome"
          description="The thin announcement strip above the header."
        >
          <AdminInput
            label="Announcement bar"
            value={form.announcement}
            onChange={(e) => patch('announcement', e.target.value)}
            maxLength={200}
            hint="Separate items with | . Do not put offers, countdowns or free-shipping claims here — nothing in the storefront supports them automatically."
          />
        </Panel>

        {/* --------------------------------------------------------------- */}
        <Panel
          title="Social profiles"
          description="Empty fields are hidden from the footer entirely."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AdminInput
              label="Instagram"
              type="url"
              value={form.social.instagram}
              onChange={(e) => patchSocial('instagram', e.target.value)}
              placeholder="https://instagram.com/…"
            />
            <AdminInput
              label="Facebook"
              type="url"
              value={form.social.facebook}
              onChange={(e) => patchSocial('facebook', e.target.value)}
            />
            <AdminInput
              label="YouTube"
              type="url"
              value={form.social.youtube}
              onChange={(e) => patchSocial('youtube', e.target.value)}
            />
            <AdminInput
              label="X"
              type="url"
              value={form.social.x}
              onChange={(e) => patchSocial('x', e.target.value)}
            />
            <AdminInput
              label="LinkedIn"
              type="url"
              value={form.social.linkedin}
              onChange={(e) => patchSocial('linkedin', e.target.value)}
            />
            <AdminInput
              label="Instagram handle"
              value={form.instagramHandle}
              onChange={(e) => patch('instagramHandle', e.target.value)}
              placeholder="@naturechoice"
            />
            <AdminInput
              label="X / Twitter handle"
              value={form.twitterHandle}
              onChange={(e) => patch('twitterHandle', e.target.value)}
              placeholder="@naturechoice"
            />
          </div>
        </Panel>

        {/* --------------------------------------------------------------- */}
        <Panel
          title="Notifications"
          description="Capability flags. A channel is only advertised when it is actually connected."
          action={<Pill tone={cap?.cloudinaryConfigured ? 'good' : 'warn'}>Media {cap?.cloudinaryConfigured ? 'ON' : 'OFF'}</Pill>}
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <AdminToggle
                label="Email"
                checked={form.notifications.emailEnabled}
                onChange={(v) => patchNotifications('emailEnabled', v)}
              />
              <AdminToggle
                label="SMS"
                checked={form.notifications.smsEnabled}
                onChange={(v) => patchNotifications('smsEnabled', v)}
              />
              <AdminToggle
                label="WhatsApp"
                checked={form.notifications.whatsappEnabled}
                onChange={(v) => patchNotifications('whatsappEnabled', v)}
              />
            </div>

            {form.notifications.emailEnabled ? (
              <div className="grid gap-3 border-t border-cream-200 pt-3 sm:grid-cols-2">
                <AdminInput
                  label="From address"
                  type="email"
                  value={form.notifications.emailFrom}
                  onChange={(e) => patchNotifications('emailFrom', e.target.value)}
                />
                <AdminInput
                  label="From name"
                  value={form.notifications.emailFromName}
                  onChange={(e) => patchNotifications('emailFromName', e.target.value)}
                />
              </div>
            ) : null}

            {form.notifications.smsEnabled ? (
              <div className="grid gap-3 border-t border-cream-200 pt-3 sm:grid-cols-2">
                <AdminInput
                  label="SMS provider"
                  value={form.notifications.smsProvider}
                  onChange={(e) => patchNotifications('smsProvider', e.target.value)}
                />
                <AdminInput
                  label="WhatsApp number"
                  value={form.notifications.whatsappNumber}
                  onChange={(e) => patchNotifications('whatsappNumber', e.target.value)}
                />
              </div>
            ) : null}

            <InlineAlert tone="info" title="These switches record intent">
              No email or SMS provider SDK is wired into this build. Leaving these on will not
              silently send anything, and the storefront will not promise a confirmation message it
              cannot deliver. Connect a provider before turning them on.
            </InlineAlert>
          </div>
        </Panel>

        {/* --------------------------------------------------------------- */}
        <Panel
          title="SEO defaults"
          description="Used for pages that have no page-specific title or description."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInput
              label="Default social share image URL"
              type="url"
              value={form.defaultOgImageUrl}
              onChange={(e) => patch('defaultOgImageUrl', e.target.value)}
              hint="Leave blank to fall back to the site default. Upload a proper 1200×630 image under Media instead of a hotlink."
            />
          </div>
        </Panel>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-cream-300 bg-cream-50 py-3">
          <p className="text-xs text-ink-muted">
            {dirty ? 'Unsaved changes.' : 'No changes since last save.'}
          </p>
          <Btn variant="primary" onClick={() => void save()} disabled={action.busy || !dirty}>
            {action.busy ? 'Saving…' : 'Save settings'}
          </Btn>
        </div>
      </div>
    </>
  );
}