'use client';

import { useEffect, useState } from 'react';

import { adminFetch } from './api';
import { useAdminAction, useAdminData } from './useAdminData';
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
  Btn,
  ChipListInput,
  InlineAlert,
  Loading,
  MoneyInput,
  PageHeader,
  Panel,
  Pill,
} from './ui';
import type { AdminShippingConfig } from './types';
import { formatINR } from '@/lib/money';

interface ShippingResponse {
  config: AdminShippingConfig;
  blockers: string[];
}

/**
 * Shipping, tax and serviceability.
 *
 * This screen is where the store decides what it may promise. Shipping ships
 * disabled until a real pickup address exists; cash on delivery needs a limit;
 * delivery estimates need a serviceability source. Those rules are enforced
 * again on the server, so the UI here explains rather than merely warns.
 */
export function ShippingClient() {
  const { data, error, loading, reload } = useAdminData<ShippingResponse>('/api/admin/shipping');
  const [form, setForm] = useState<AdminShippingConfig | null>(null);
  const action = useAdminAction();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.config) setForm(data.config);
  }, [data]);

  const patch = <K extends keyof AdminShippingConfig>(key: K, value: AdminShippingConfig[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  async function save() {
    if (!form) return;
    const res = await action.run(() =>
      adminFetch<{ config: AdminShippingConfig }>('/api/admin/shipping', {
        method: 'PATCH',
        body: form,
      }),
    );
    if (res) {
      setSaved(true);
      setForm(res.config);
      reload();
    }
  }

  async function checkCourier() {
    const res = await action.run(() =>
      adminFetch<{ blockers: string[]; delhiveryConfigured: boolean; shippingEnabled: boolean }>(
        '/api/admin/orders/shipping?action=config-check',
        { method: 'POST', body: {} },
      ),
    );
    if (res) {
      window.alert(
        res.blockers.length
          ? `Not ready to ship:\n\n- ${res.blockers.join('\n- ')}`
          : 'Delhivery is configured, the pickup address is complete and shipping is on.',
      );
    }
  }

  if (loading && !form) return <Loading label="Loading shipping configuration…" />;
  if (error && !form) {
    return (
      <InlineAlert tone="bad" title="Could not load shipping configuration">
        {error}
      </InlineAlert>
    );
  }
  if (!form) return null;

  const dirty = JSON.stringify(form) !== JSON.stringify(data?.config);
  const originComplete = Boolean(
    form.pickupName && form.pickupAddressLine1 && form.pickupCity && form.pickupPincode,
  );

  return (
    <>
      <PageHeader
        title="Shipping"
        description="Charges, serviceability and the promises the storefront is allowed to make."
        action={
          <div className="flex gap-2">
            <Btn onClick={() => void checkCourier()} disabled={action.busy}>
              Test courier setup
            </Btn>
            <Btn variant="primary" onClick={() => void save()} disabled={action.busy || !dirty}>
              {action.busy ? 'Saving…' : 'Save changes'}
            </Btn>
          </div>
        }
      />

      {action.error ? (
        <div className="mb-4">
          <InlineAlert tone="bad">{action.error}</InlineAlert>
        </div>
      ) : null}
      {saved && !action.error ? (
        <div className="mb-4">
          <InlineAlert tone="good">Shipping configuration saved.</InlineAlert>
        </div>
      ) : null}
      {data?.blockers.length ? (
        <div className="mb-4">
          <InlineAlert tone="warn" title="Before any order can ship">
            <ul className="list-disc pl-4">
              {data.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </InlineAlert>
        </div>
      ) : null}
      {!form.shippingEnabled ? (
        <div className="mb-4">
          <InlineAlert tone="warn" title="Shipping is switched off">
            Checkout is disabled for customers. The storefront says so honestly rather than
            pretending orders can be placed.
          </InlineAlert>
        </div>
      ) : null}

      <div className="space-y-4">
        <Panel
          title="Pickup address"
          description="Where Delhivery collects from. Shipping cannot be enabled without this."
          action={<Pill tone={originComplete ? 'good' : 'bad'}>{originComplete ? 'Complete' : 'Incomplete'}</Pill>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInput
              label="Business name"
              value={form.pickupName}
              onChange={(e) => patch('pickupName', e.target.value)}
            />
            <AdminInput
              label="Contact name"
              value={form.pickupContactName}
              onChange={(e) => patch('pickupContactName', e.target.value)}
            />
            <AdminInput
              label="Address line 1"
              value={form.pickupAddressLine1}
              onChange={(e) => patch('pickupAddressLine1', e.target.value)}
            />
            <AdminInput
              label="Address line 2"
              value={form.pickupAddressLine2}
              onChange={(e) => patch('pickupAddressLine2', e.target.value)}
            />
            <AdminInput
              label="City"
              value={form.pickupCity}
              onChange={(e) => patch('pickupCity', e.target.value)}
            />
            <AdminInput
              label="State"
              value={form.pickupState}
              onChange={(e) => patch('pickupState', e.target.value)}
            />
            <AdminInput
              label="PIN code"
              inputMode="numeric"
              maxLength={6}
              value={form.pickupPincode}
              onChange={(e) => patch('pickupPincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <AdminInput
              label="Country"
              value={form.pickupCountry}
              onChange={(e) => patch('pickupCountry', e.target.value)}
            />
            <AdminInput
              label="Contact phone"
              value={form.pickupContactPhone}
              onChange={(e) => patch('pickupContactPhone', e.target.value)}
              hint="The courier calls this number if the parcel cannot be delivered."
            />
            <AdminInput
              label="Email"
              type="email"
              value={form.pickupEmail}
              onChange={(e) => patch('pickupEmail', e.target.value)}
            />
          </div>
        </Panel>

        <Panel
          title="Enable shipping"
          description="The master switch. Off means no checkout — deliberately, not by accident."
        >
          <AdminToggle
            tone="warning"
            label="Shipping is switched on"
            description="Turn this on only when the pickup address above is complete and you can actually dispatch."
            checked={form.shippingEnabled}
            onChange={(v) => patch('shippingEnabled', v)}
            disabled={!originComplete}
          />
        </Panel>

        <Panel title="Charges">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MoneyInput
              label="Flat shipping charge (₹)"
              paise={form.flatShippingPaise}
              onChange={(v) => patch('flatShippingPaise', v ?? 0)}
            />
            <MoneyInput
              label="Handling fee (₹)"
              paise={form.handlingPaise}
              onChange={(v) => patch('handlingPaise', v ?? 0)}
            />
            <MoneyInput
              label="Rate per kg (₹)"
              paise={form.weightRatePaisePerKg}
              onChange={(v) => patch('weightRatePaisePerKg', v ?? 0)}
              hint="Only used when weight-based shipping is on."
            />
            <AdminInput
              label="Max weight per order (g)"
              type="number"
              min={0}
              value={form.maxWeightPerOrderGrams}
              onChange={(e) => patch('maxWeightPerOrderGrams', Number(e.target.value))}
              hint="0 = no limit."
            />
            <AdminToggle
              label="Charge by weight"
              description="Use the pack's declared weight instead of a flat fee."
              checked={form.weightBasedShipping}
              onChange={(v) => patch('weightBasedShipping', v)}
            />
            <div className="flex items-end">
              <AdminToggle
                label="Free shipping threshold"
                description="Never shown unless enabled AND a threshold is set."
                checked={form.freeShippingEnabled}
                onChange={(v) => patch('freeShippingEnabled', v)}
              />
            </div>
            <MoneyInput
              label="Free shipping above (₹)"
              paise={form.freeShippingThresholdPaise}
              onChange={(v) => patch('freeShippingThresholdPaise', v)}
              allowBlank
              disabled={!form.freeShippingEnabled}
            />
          </div>
        </Panel>

        <Panel
          title="Serviceability"
          description="How a PIN code is checked at checkout."
        >
          <div className="space-y-4">
            <AdminSelect
              label="Method"
              value={form.serviceabilityMode}
              onChange={(e) =>
                patch('serviceabilityMode', e.target.value as AdminShippingConfig['serviceabilityMode'])
              }
              hint="DISABLED means we never claim a PIN is deliverable."
            >
              <option value="DELHIVERY_API">Ask Delhivery in real time</option>
              <option value="LIST">Use my own PIN code list</option>
              <option value="DISABLED">Do not check — allow the order to proceed</option>
            </AdminSelect>

            {form.serviceabilityMode === 'LIST' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <ChipListInput
                  label="Serviceable PIN codes"
                  values={form.serviceablePincodes}
                  onChange={(v) => patch('serviceablePincodes', v)}
                />
                <ChipListInput
                  label="Blocked PIN codes"
                  values={form.blockedPincodes}
                  onChange={(v) => patch('blockedPincodes', v)}
                  hint="Always rejected, even if the courier would accept them."
                />
              </div>
            ) : null}

            <div className="space-y-3 border-t border-cream-200 pt-4">
              <AdminToggle
                label="Show estimated delivery dates"
                description="Requires a working serviceability source. We never show a made-up date."
                checked={form.showEstimatedDelivery}
                onChange={(v) => patch('showEstimatedDelivery', v)}
              />
              {form.showEstimatedDelivery ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminInput
                    label="Minimum days"
                    type="number"
                    min={0}
                    value={form.defaultEstimatedDeliveryDaysMin ?? ''}
                    onChange={(e) =>
                      patch(
                        'defaultEstimatedDeliveryDaysMin',
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  />
                  <AdminInput
                    label="Maximum days"
                    type="number"
                    min={0}
                    value={form.defaultEstimatedDeliveryDaysMax ?? ''}
                    onChange={(e) =>
                      patch(
                        'defaultEstimatedDeliveryDaysMax',
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel
          title="Cash on delivery"
          description="Off by default. Turning it on requires an order limit, because COD carries collection risk."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AdminToggle
              label="Offer cash on delivery"
              checked={form.codEnabled}
              onChange={(v) => patch('codEnabled', v)}
            />
            <MoneyInput
              label="Maximum COD order (₹)"
              paise={form.codMaxOrderPaise}
              onChange={(v) => patch('codMaxOrderPaise', v)}
              allowBlank
              disabled={!form.codEnabled}
              hint="Required before COD can be enabled."
            />
            <MoneyInput
              label="COD handling fee (₹)"
              paise={form.codHandlingPaise}
              onChange={(v) => patch('codHandlingPaise', v ?? 0)}
              disabled={!form.codEnabled}
            />
          </div>
        </Panel>

        <Panel title="Tax">
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminToggle
              label="Apply tax"
              checked={form.taxEnabled}
              onChange={(v) => patch('taxEnabled', v)}
            />
            <AdminToggle
              label="Prices already include tax"
              description="On = GST is shown inside the displayed price. Off = tax is added at checkout."
              checked={form.taxInclusive}
              onChange={(v) => patch('taxInclusive', v)}
              disabled={!form.taxEnabled}
            />
            <AdminInput
              label="Tax rate (%)"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.taxPercent}
              onChange={(e) => patch('taxPercent', Number(e.target.value))}
              disabled={!form.taxEnabled}
            />
          </div>
        </Panel>

        <Panel title="Cancellations">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminToggle
              label="Let customers cancel online"
              description="Self-service cancellation on the order page, within the window below."
              checked={form.allowCancellation}
              onChange={(v) => patch('allowCancellation', v)}
            />
            <AdminInput
              label="Cancellation window (hours)"
              type="number"
              min={0}
              max={720}
              value={form.cancelWindowHours}
              onChange={(e) => patch('cancelWindowHours', Number(e.target.value))}
              hint="After this, cancellations are handled by support."
            />
          </div>
        </Panel>

        <Panel title="Customer-facing messages" description="Exactly what a customer reads when something goes wrong.">
          <div className="space-y-3">
            <AdminTextarea
              label="When shipping is switched off"
              rows={2}
              value={form.shippingDisabledMessage}
              onChange={(e) => patch('shippingDisabledMessage', e.target.value)}
            />
            <AdminTextarea
              label="When a PIN code is undeliverable"
              rows={2}
              value={form.unserviceableMessage}
              onChange={(e) => patch('unserviceableMessage', e.target.value)}
            />
            <AdminTextarea
              label="When we could not confirm the PIN code"
              rows={2}
              value={form.unknownPincodeMessage}
              onChange={(e) => patch('unknownPincodeMessage', e.target.value)}
            />
            <AdminTextarea
              label="Shipping policy note"
              rows={5}
              value={form.shippingPolicyNote}
              onChange={(e) => patch('shippingPolicyNote', e.target.value)}
              hint="Leave empty and the shipping policy page shows a clear 'not written yet' state."
            />
          </div>
        </Panel>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-cream-300 bg-cream-50 py-3">
          <p className="text-xs text-ink-muted">
            {dirty ? 'Unsaved changes.' : 'No changes since last save.'} Flat rate today:{' '}
            {formatINR(form.flatShippingPaise)}
            {form.freeShippingEnabled && form.freeShippingThresholdPaise
              ? ` · free above ${formatINR(form.freeShippingThresholdPaise)}`
              : ''}
          </p>
          <Btn variant="primary" onClick={() => void save()} disabled={action.busy || !dirty}>
            {action.busy ? 'Saving…' : 'Save changes'}
          </Btn>
        </div>
      </div>
    </>
  );
}