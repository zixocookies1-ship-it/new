export interface AdminOrderRow {
  id: string;
  orderId: string;
  reference: string;
  customerName: string;
  phone: string;
  email: string | null;
  city: string;
  pincode: string;
  itemSummary: string;
  itemCount: number;
  totalPaise: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  razorpayPaymentId: string | null;
  shippingStatus: string;
  syncStatus: string;
  syncError: string | null;
  waybill: string | null;
  hasRefund: boolean;
  createdAt: string;
}

export interface AdminOrderDetail {
  _id: string;
  orderId: string;
  reference: string;
  email: string | null;
  phone: string;
  items: Array<{
    name: string;
    slug: string;
    flavour: string;
    sku: string;
    weightLabel: string;
    imageUrl: string | null;
    unitPricePaise: number;
    mrpPaise: number | null;
    qty: number;
    lineTotalPaise: number;
    bundleName: string | null;
  }>;
  subtotalPaise: number;
  mrpTotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  shippingChargedPaise: number;
  taxPaise: number;
  totalPaise: number;
  amountRefundedPaise: number;
  couponCode: string | null;
  couponDiscountPaise: number | null;
  customerNote: string;
  adminNote: string;
  cancelReason: string | null;
  cancelledAt: string | null;
  deliveredAt: string | null;
  status: string;
  statusHistory: Array<{ status: string; at: string; source: string; note?: string }>;
  payment: {
    method: string;
    status: string;
    amount: number;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    signatureVerified: boolean;
    method_: string | null;
    bank?: string | null;
    cardLast4?: string | null;
    failureReason: string | null;
    failureDescription: string | null;
    refundId: string | null;
    refundAmount: number | null;
    refundedAt: string | null;
  };
  shipping: {
    status: string;
    carrier: string;
    syncStatus: string;
    waybill: string | null;
    delhiveryRefNo: string | null;
    awbGenerated: boolean;
    lastStatusText: string | null;
    syncError: string | null;
    syncAttempts: number;
    estimatedDeliveryDays: number | null;
    courierCharges: number | null;
    codAmount: number | null;
    statusHistory: Array<{ status: string; at: string; source: string; note?: string }>;
  };
  address: {
    name: string;
    phone: string;
    email?: string;
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    serviceability: string;
  };
  shippingAddress: AdminOrderDetail['address'];
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface OverviewResponse {
  stats: {
    totalOrders: number;
    paidOrders: number;
    pendingPayment: number;
    failedShippingSync: number;
    deliveredOrders: number;
    revenuePaise: number;
    revenueLast30Paise: number;
    revenueLast7Paise: number;
    averageOrderValuePaise: number;
  };
  catalogue: {
    products: number;
    activeProducts: number;
    unverifiedProducts: number;
    bundles: number;
    faqs: number;
    recipes: number;
    contentDocs: number;
    contentKeysTotal: number;
    unverifiedContentKeys: string[];
    coupons: number;
    activeCoupons: number;
    lowStock: Array<{
      id: string;
      sku: string;
      weightLabel: string;
      inventory: number;
      lowStockThreshold: number;
      productName: string;
    }>;
  };
  moderation: {
    reviewsPending: number;
    reviewsApproved: number;
    contactMessagesNew: number;
  };
  chart: Array<{ date: string; revenuePaise: number }>;
  topProducts: Array<{ _id: string; name: string; qty: number; revenuePaise: number }>;
  recentOrders: Array<{
    orderId: string;
    customer: string;
    totalPaise: number;
    status: string;
    paymentStatus: string;
    shippingStatus: string;
    syncStatus: string;
    createdAt: string;
  }>;
  capabilities: {
    onlinePayments: boolean;
    cod: boolean;
    liveTracking: boolean;
    images: boolean;
  };
  integrations: any[];
  setupTasks: Array<{
    id: string;
    label: string;
    detail: string;
    severity: 'blocking' | 'important' | 'optional';
    href: string;
  }>;
}

export type PillTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

/** Order status tones mapped from ORDER_TONE definitions. */
export const ORDER_TONE: Record<string, PillTone> = {
  ORDER_PLACED: 'info',
  PAYMENT_PENDING: 'warn',
  PAID: 'good',
  PROCESSING: 'good',
  SHIPPED: 'warn',
  IN_TRANSIT: 'warn',
  OUT_FOR_DELIVERY: 'warn',
  DELIVERED: 'good',
  CANCELLED: 'bad',
  REFUNDED: 'neutral',
};

/** Payment status tones. */
export const PAYMENT_TONE: Record<string, PillTone> = {
  PENDING: 'warn',
  PAID: 'good',
  FAILED: 'bad',
  REFUNDED: 'neutral',
};