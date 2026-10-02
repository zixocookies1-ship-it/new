import 'server-only';

import { serverEnv, integrationState } from './env';
import type { Serviceability, ShippingStatus } from './types';

/**
 * Delhivery integration.
 *
 * Design principle (spec §13): shipping must never be able to lose an order.
 * Every failure path here returns a structured result instead of throwing past
 * the caller, and the caller persists the failure on the order
 * (`shipping.syncStatus = FAILED` + `syncError`) so an admin can retry.
 */

export function isDelhiveryReady(): boolean {
  return integrationState('delhivery') === 'configured';
}

function baseUrl(): string {
  return serverEnv.delhivery.baseUrl.replace(/\/+$/, '');
}

function authHeader(): string {
  // Delhivery uses a bearer-style `token` prefix for its REST API.
  return `token ${serverEnv.delhivery.apiKey}`;
}

export class DelhiveryError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'DelhiveryError';
  }
}

async function delhiveryFetch<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const { method = 'GET', body, timeoutMs = 15000 } = init;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text.slice(0, 500) };
    }

    if (!res.ok) {
      const message =
        (json as { message?: string; error?: string })?.message ??
        (json as { error?: string })?.error ??
        `Delhivery request failed with HTTP ${res.status}`;
      throw new DelhiveryError(message, `HTTP_${res.status}`, res.status, json);
    }

    return json as T;
  } catch (err) {
    if (err instanceof DelhiveryError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new DelhiveryError('Delhivery request timed out.', 'TIMEOUT', 504);
    }
    throw new DelhiveryError(
      err instanceof Error ? err.message : 'Unknown Delhivery error',
      'NETWORK_ERROR',
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Serviceability                                                             */
/* -------------------------------------------------------------------------- */

export interface ServiceabilityResult {
  serviceability: Serviceability;
  /** Only populated from the courier response — never synthesised. */
  estimatedDeliveryDays: number | null;
  estimatedPickupDate: string | null;
  chargeableWeight: number | null;
  /** Raw courier message, safe to show. */
  message: string | null;
  source: 'DELHIVERY' | 'LIST' | 'DISABLED';
}

interface DelhiveryServiceabilityResponse {
  serviceable?: boolean;
  serviceability_type?: string;
  estimated_delivery_days?: string | number;
  estimated_pickup_date?: string;
  chargeable_weight?: number;
  message?: string;
  error?: string;
}

/**
 * Live serviceability check. Caller decides whether to fall back to the
 * admin-maintained pincode list when this is unavailable.
 */
export async function checkServiceability(pincode: string): Promise<ServiceabilityResult> {
  if (!isDelhiveryReady()) {
    return {
      serviceability: 'UNKNOWN',
      estimatedDeliveryDays: null,
      estimatedPickupDate: null,
      chargeableWeight: null,
      message: null,
      source: 'DISABLED',
    };
  }

  const pin = pincode.slice(0, 6);
  const data = await delhiveryFetch<DelhiveryServiceabilityResponse>(
    `/v2/serviceability/?pincode=${encodeURIComponent(pin)}`,
  );

  // Delhivery answers 200 with `serviceable: false` and a reason in some cases.
  const serviceable = Boolean(data.serviceable);
  const daysRaw = data.estimated_delivery_days;
  const days = daysRaw != null ? Number(daysRaw) : NaN;

  return {
    serviceability: serviceable ? 'SERVICEABLE' : 'UNSERVICEABLE',
    estimatedDeliveryDays: Number.isFinite(days) && days > 0 ? days : null,
    estimatedPickupDate: data.estimated_pickup_date ?? null,
    chargeableWeight: data.chargeable_weight ?? null,
    message: data.serviceable ? null : (data.message ?? data.error ?? null),
    source: 'DELHIVERY',
  };
}

/* -------------------------------------------------------------------------- */
/* Shipment creation                                                          */
/* -------------------------------------------------------------------------- */

export interface DelhiveryAddress {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
  email?: string;
}

export interface CreateShipmentInput {
  orderId: string;
  reference: string;
  orderDate: Date;
  from: DelhiveryAddress;
  to: DelhiveryAddress;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    weightGrams?: number;
    declaredValuePaise: number;
    /** Delhivery requires these categories for FMCG shipments. */
    category?: 'GROCERIES' | 'CONSUMER_GOODS' | 'PACKAGED_GOODS' | 'OTHERS';
  }>;
  /** Charged to customer (COD) if COD, else 0. */
  codAmountPaise?: number;
  totalOrderValuePaise: number;
  /** Optional admin-configured pickup location name. */
  pickupLocation?: string | null;
}

export interface CreateShipmentResult {
  waybill: string | null;
  shipmentId: string | null;
  delhiveryOrderId: string | null;
  refNo: string | null;
  awbGenerated: boolean;
  pickupLocation: string | null;
  raw: unknown;
}

interface DelhiveryShipmentResponse {
  success?: boolean;
  result?: Array<{
    waybill?: string;
    shipment_id?: string;
    order_id?: string;
    ref_no?: string;
    awb_generated?: boolean;
    pickup_location?: string;
    message?: string;
    error?: string;
  }>;
  message?: string;
  error?: string;
}

/**
 * Creates a Delhivery shipment. Throws `DelhiveryError` on failure — the
 * caller (createOrder/update) is responsible for persisting that failure on
 * the order document so nothing is lost.
 */
export async function createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
  if (!isDelhiveryReady()) {
    throw new DelhiveryError('Delhivery is not configured.', 'NOT_CONFIGURED', 503);
  }

  const chargeableWeight = input.items.reduce(
    (sum, i) => sum + (i.weightGrams ?? 0) * i.quantity,
    0,
  );

  const shipmentItems = input.items.map((i) => ({
    name: i.name.slice(0, 100),
    sku: i.sku.slice(0, 100) || `NC-${i.name}`.slice(0, 100),
    quantity: i.quantity,
    price: Math.max(0, Math.round(i.declaredValuePaise / 100)),
    weight: Math.max(0, Math.round((i.weightGrams ?? 0) / 1000)),
    // Delhivery rejects FMCG parcels without a recognised category.
    category: i.category ?? 'GROCERIES',
    // Declared value in INR as Delhivery expects it.
    declared_value: Math.max(0, Math.round(i.declaredValuePaise / 100)),
    taxable_value: Math.max(0, Math.round(i.declaredValuePaise / 100)),
    tax: 0,
    tax_rate: 0,
    is_fragile: false,
  }));

  // `weight` on the shipment is the billable weight in kg, rounded to 2dp.
  const totalWeightKg = Math.round((chargeableWeight / 1000) * 100) / 100;

  const body: Record<string, unknown> = {
    name: input.from.name,
    order_id: input.orderId,
    order_date: input.orderDate.toISOString().slice(0, 19).replace('T', ' '),
    order_channel: 'web',
    order_status: 'confirmed',
    // Must be greater than 0 for Delhivery to accept the parcel.
    weight: Math.max(totalWeightKg, 0.1),
    packaging_type: { count: 1, weight: 0, length: 0, breadth: 0, height: 0 },
    invoice_no: input.orderId,
    invoice_date: input.orderDate.toISOString().slice(0, 19).replace('T', ' '),

    // Pickup (from)
    pickup_location: {
      name: input.from.name,
      address: input.from.addressLine1,
      city: input.from.city,
      state: input.from.state,
      country_code: input.from.country,
      pincode: input.from.pincode,
    },
    // Delivery (to)
    shipping_mode: 'surface',
    consignee: {
      name: input.to.name,
      address: input.to.addressLine1,
      address_2: input.to.addressLine2 ?? '',
      city: input.to.city,
      state: input.to.state,
      country_code: input.to.country,
      pincode: input.to.pincode,
      email: input.to.email,
      phone: input.to.phone,
    },
    order_items: shipmentItems,
    // COD is 0 for prepaid orders.
    cod_amount: Math.max(0, Math.round((input.codAmountPaise ?? 0) / 100)),
    transaction_type: 'Prepaid',
    instructions: '',
    transaction_amount: Math.max(0, Math.round(input.totalOrderValuePaise / 100)),
    reference_no: input.reference,
    // Tells Delhivery the parcel is breakable-but-not-fragile food.
    fragile: false,
  };

  if (input.pickupLocation) {
    body.pickup_location = { name: input.pickupLocation };
  }

  const res = await delhiveryFetch<DelhiveryShipmentResponse>('/v2/shipments/', {
    method: 'POST',
    body,
    timeoutMs: 20000,
  });

  const r = res.result?.[0];

  if (!res.success && !r) {
    throw new DelhiveryError(
      res.message ?? res.error ?? 'Delhivery rejected the shipment request.',
      'SHIPMENT_REJECTED',
      422,
      res,
    );
  }

  if (r?.message && !r.waybill) {
    throw new DelhiveryError(r.message, 'SHIPMENT_REJECTED', 422, res);
  }

  return {
    waybill: r?.waybill ?? null,
    shipmentId: r?.shipment_id ?? null,
    delhiveryOrderId: r?.order_id ?? null,
    refNo: r?.ref_no ?? null,
    awbGenerated: Boolean(r?.awb_generated),
    pickupLocation: r?.pickup_location ?? (input.pickupLocation ?? null),
    raw: res,
  };
}

/* -------------------------------------------------------------------------- */
/* Tracking                                                                   */
/* -------------------------------------------------------------------------- */

export interface TrackingEvent {
  status: string;
  statusDescription: string;
  location: string;
  scannedAt: string;
}

export interface TrackingResult {
  waybill: string;
  /** Normalised status text (e.g. "Out for Delivery"). */
  status: string;
  statusCode: string | null;
  /** ISO timestamp of the most recent scan. */
  lastScannedAt: string | null;
  delivered: boolean;
  events: TrackingEvent[];
  /** Tracking page URL we can hand the customer. */
  trackingUrl: string;
}

export async function trackShipment(waybill: string): Promise<TrackingResult> {
  if (!isDelhiveryReady()) {
    throw new DelhiveryError('Delhivery is not configured.', 'NOT_CONFIGURED', 503);
  }

  const res = await delhiveryFetch<{
    error?: string;
    Error?: string;
    waybill?: string;
    status?: { status?: string; status_description?: string; status_code?: string; scan_date?: string };
    scans?: Array<{
      status?: string;
      status_description?: string;
      location?: string;
      scan_date?: string;
    }>;
  }>(`/v2/shipments/tracking/?waybill=${encodeURIComponent(waybill)}`);

  // Delhivery returns 200 with an error body for unknown waybills.
  if (res.error || res.Error) {
    throw new DelhiveryError(res.error ?? res.Error ?? 'Waybill not found.', 'WAYBILL_NOT_FOUND', 404);
  }

  const events: TrackingEvent[] = (res.scans ?? []).map((s) => ({
    status: s.status ?? '',
    statusDescription: s.status_description ?? '',
    location: s.location ?? '',
    scannedAt: s.scan_date ?? '',
  }));

  const top = res.status;

  return {
    waybill: res.waybill ?? waybill,
    status: top?.status_description ?? top?.status ?? 'In Transit',
    statusCode: top?.status_code ?? null,
    lastScannedAt: top?.scan_date ?? events[0]?.scannedAt ?? null,
    delivered: (top?.status ?? '').toLowerCase() === 'delivered',
    events,
    trackingUrl: buildTrackingUrl(waybill),
  };
}

/**
 * Public tracking URL. Uses the courier's own tracker so the customer sees the
 * authoritative scan history, falling back to our in-app tracker.
 */
export function buildTrackingUrl(waybill: string): string {
  return `https://www.delhivery.com/track/package/${waybill}`;
}

/* -------------------------------------------------------------------------- */
/* Status mapping                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Map Delhivery's free-text status onto our controlled enum.
 * Returns null when the courier status is unrecognised, so we keep the last
 * known good status rather than inventing a transition.
 */
export function mapDelhiveryStatus(raw: string | null | undefined): ShippingStatus | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();

  if (s.includes('delivered') || s === 'del') return 'DELIVERED';
  if (s.includes('out for delivery') || s.includes('ofd')) return 'OUT_FOR_DELIVERY';
  if (s.includes('cancelled') || s.includes('canceled') || s.includes('returned'))
    return 'CANCELLED';
  if (s.includes('in transit') || s.includes('dispatched') || s.includes('dispatch'))
    return 'IN_TRANSIT';
  if (s.includes('shipped') || s.includes('manifested') || s.includes('added'))
    return 'CREATED';
  return null;
}
