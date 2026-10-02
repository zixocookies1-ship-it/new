/**
 * Customer-facing order projection.
 *
 * This is the exact shape returned by `POST /api/track`. It is deliberately
 * redacted (masked contact details, no internal notes, no full address) so it
 * can be rendered on a public page without leaking anything a customer would
 * not already know about their own parcel.
 */
export interface PublicOrderView {
  orderId: string;
  reference: string;
  status: string;
  placedAt: string;
  shipTo: {
    name: string;
    city: string;
    state: string;
    pincode: string;
    phone: string | null;
    email: string | null;
  };
  items: Array<{
    name: string;
    weightLabel: string;
    qty: number;
    imageUrl: string | null;
  }>;
  payment: {
    method: string;
    status: string;
    amountPaise: number;
    refundId: string | null;
  };
  shipping: {
    status: string;
    carrier: string;
    waybill: string | null;
    trackingUrl: string | null;
    lastStatusText: string;
    lastSyncedAt: string | null;
    syncStatus: string;
    syncError: string | null;
    history: Array<{ status: string; at: string; note: string | null }>;
  };
  timeline: Array<{ status: string; at: string; note: string | null }>;
}

export const ORDER_STATUS_TONE: Record<
  string,
  'neutral' | 'ginger' | 'leaf' | 'jaggery' | 'warning' | 'danger' | 'info'
> = {
  ORDER_PLACED: 'info',
  PAYMENT_PENDING: 'warning',
  PAID: 'jaggery',
  PROCESSING: 'jaggery',
  SHIPPED: 'ginger',
  IN_TRANSIT: 'ginger',
  OUT_FOR_DELIVERY: 'ginger',
  DELIVERED: 'leaf',
  CANCELLED: 'danger',
  REFUNDED: 'neutral',
};

/** "OUT_FOR_DELIVERY" -> "Out for delivery". */
export function humanStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * What the customer is told about the order right now, derived only from
 * persisted fields. No estimated delivery date is produced here — those come
 * from the courier or from admin-configured settings, never from optimism.
 */
export function orderHeadline(order: PublicOrderView): {
  title: string;
  body: string;
} {
  switch (order.status) {
    case 'ORDER_PLACED':
      return {
        title: 'Order received',
        body:
          order.payment.method === 'COD'
            ? 'We have your order and it is being prepared for dispatch.'
            : 'We have your order. Complete the payment to move it into packing.',
      };
    case 'PAYMENT_PENDING':
      return {
        title: 'Waiting on payment',
        body: 'Your order is saved. Complete the payment and it will move into packing straight away.',
      };
    case 'PAID':
    case 'PROCESSING':
      return {
        title: 'We are packing your order',
        body: 'Payment is confirmed. You will see a tracking number here as soon as the courier collects it.',
      };
    case 'SHIPPED':
    case 'IN_TRANSIT':
      return {
        title: 'On its way',
        body: 'The parcel has been picked up and is moving through the courier network.',
      };
    case 'OUT_FOR_DELIVERY':
      return {
        title: 'Out for delivery today',
        body: 'The courier has it out for delivery. Keep your phone handy.',
      };
    case 'DELIVERED':
      return {
        title: 'Delivered',
        body: 'This order was delivered. We hope it tastes the way you remember.',
      };
    case 'CANCELLED':
      return {
        title: 'Order cancelled',
        body: 'This order was cancelled and any payment is being returned by the payment gateway.',
      };
    case 'REFUNDED':
      return {
        title: 'Refund processed',
        body: 'The payment gateway has confirmed this refund. Bank timelines vary by a few working days.',
      };
    default:
      return {
        title: humanStatus(order.status),
        body: 'We are keeping this page updated as the order progresses.',
      };
  }
}
