import { guardAdmin } from '@/lib/admin';
import { connectDb } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Product } from '@/lib/models/Product';
import { Review } from '@/lib/models/Review';
import { ContactMessage } from '@/lib/models/ContactMessage';
import { Faq } from '@/lib/models/Faq';
import { Recipe } from '@/lib/models/Recipe';
import { Content } from '@/lib/models/Content';
import { Coupon } from '@/lib/models/Coupon';
import { Bundle } from '@/lib/models/Bundle';
import { getShippingConfig } from '@/lib/models/ShippingConfiguration';
import { getBusinessSettings } from '@/lib/models/BusinessSettings';
import { getIntegrationChecklist } from '@/lib/integrations';
import { getStoreCapabilities } from '@/lib/integrations';
import { CONTENT_KEYS } from '@/lib/types';
import { ok, handleRouteError, noStore } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Admin dashboard.
 *
 * Every number here is derived from the database at request time. Nothing is
 * seeded, sampled or estimated — an empty store shows zeros, not a demo graph.
 */
export async function GET() {
  const guard = await guardAdmin();
  if (!guard.ok) return guard.response;

  try {
    await connectDb();

    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * DAY_MS);
    const last7 = new Date(now.getTime() - 7 * DAY_MS);

    const [
      totalOrders,
      paidOrders,
      pendingPayment,
      failedShippingSync,
      deliveredOrders,
      revenueAgg,
      last30Revenue,
      last7Revenue,
      productCount,
      activeProductCount,
      unverifiedProductCount,
      reviewPending,
      reviewApproved,
      messagesNew,
      faqCount,
      recipeCount,
      contentDocs,
      unverifiedContentKeys,
      couponCount,
      activeCouponCount,
      bundleCount,
      recentOrders,
      revenueByDay,
      topProducts,
      lowStock,
    ] = await Promise.all([
      Order.countDocuments().exec(),
      Order.countDocuments({ 'payment.status': 'PAID' }).exec(),
      Order.countDocuments({ 'payment.status': 'PENDING' }).exec(),
      Order.countDocuments({ 'shipping.syncStatus': 'FAILED' }).exec(),
      Order.countDocuments({ status: 'DELIVERED' }).exec(),
      Order.aggregate<{ _id: null; total: number }>([
        { $match: { 'payment.status': 'PAID' } },
        { $group: { _id: null, total: { $sum: '$totalPaise' } } },
      ]).exec(),
      Order.aggregate<{ _id: null; total: number }>([
        { $match: { 'payment.status': 'PAID', createdAt: { $gte: last30 } } },
        { $group: { _id: null, total: { $sum: '$totalPaise' } } },
      ]).exec(),
      Order.aggregate<{ _id: null; total: number }>([
        { $match: { 'payment.status': 'PAID', createdAt: { $gte: last7 } } },
        { $group: { _id: null, total: { $sum: '$totalPaise' } } },
      ]).exec(),
      Product.countDocuments().exec(),
      Product.countDocuments({ isActive: true }).exec(),
      Product.countDocuments({ isVerified: false }).exec(),
      Review.countDocuments({ status: 'PENDING' }).exec(),
      Review.countDocuments({ status: 'APPROVED' }).exec(),
      ContactMessage.countDocuments({ status: 'NEW' }).exec(),
      Faq.countDocuments({ isActive: true }).exec(),
      Recipe.countDocuments({ isActive: true }).exec(),
      Content.countDocuments().exec(),
      Content.find({ isVerified: false }).select('key').lean().exec(),
      Coupon.countDocuments().exec(),
      Coupon.countDocuments({ isActive: true }).exec(),
      Bundle.countDocuments({ isActive: true }).exec(),
      Order.find({}).sort({ createdAt: -1 }).limit(8).lean().exec(),
      Order.aggregate<{ _id: string; total: number }>([
        { $match: { 'payment.status': 'PAID', createdAt: { $gte: last30 } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: '$totalPaise' },
          },
        },
        { $sort: { _id: 1 } },
      ]).exec(),
      Order.aggregate<{ _id: string; name: string; qty: number; revenuePaise: number }>([
        { $match: { 'payment.status': 'PAID' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.sku',
            name: { $first: '$items.name' },
            qty: { $sum: '$items.qty' },
            revenuePaise: { $sum: '$items.lineTotalPaise' },
          },
        },
        { $sort: { qty: -1 } },
        { $limit: 6 },
      ]).exec(),
      fetchLowStock(),
    ]);

    const settings = await getBusinessSettings({ fresh: true });
    const shipping = await getShippingConfig({ fresh: true });
    const capabilities = await getStoreCapabilities({
      onlinePaymentEnabled: settings.onlinePaymentEnabled,
      codEnabled: shipping.codEnabled,
    });

    const revenueByDayMap = new Map(revenueByDay.map((d) => [d._id, d.total]));
    const chart: Array<{ date: string; revenuePaise: number }> = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * DAY_MS);
      const key = d.toISOString().slice(0, 10);
      chart.push({ date: key, revenuePaise: revenueByDayMap.get(key) ?? 0 });
    }

    return ok(
      {
        stats: {
          totalOrders,
          paidOrders,
          pendingPayment,
          failedShippingSync,
          deliveredOrders,
          revenuePaise: revenueAgg[0]?.total ?? 0,
          revenueLast30Paise: last30Revenue[0]?.total ?? 0,
          revenueLast7Paise: last7Revenue[0]?.total ?? 0,
          averageOrderValuePaise:
            paidOrders > 0 ? Math.round((revenueAgg[0]?.total ?? 0) / paidOrders) : 0,
        },
        catalogue: {
          products: productCount,
          activeProducts: activeProductCount,
          unverifiedProducts: unverifiedProductCount,
          bundles: bundleCount,
          faqs: faqCount,
          recipes: recipeCount,
          contentDocs,
          unverifiedContentKeys: unverifiedContentKeys.map((c) => c.key),
          contentKeysTotal: CONTENT_KEYS.length,
          coupons: couponCount,
          activeCoupons: activeCouponCount,
          lowStock,
        },
        moderation: {
          reviewsPending: reviewPending,
          reviewsApproved: reviewApproved,
          contactMessagesNew: messagesNew,
        },
        chart,
        topProducts,
        recentOrders: recentOrders.map((o) => ({
          orderId: o.orderId,
          customer: o.shippingAddress?.name ?? '',
          totalPaise: o.totalPaise,
          status: o.status,
          paymentStatus: o.payment.status,
          shippingStatus: o.shipping.status,
          syncStatus: o.shipping.syncStatus,
          createdAt: new Date(o.createdAt).toISOString(),
        })),
        capabilities,
        integrations: getIntegrationChecklist(),
        /** Actionable setup gaps, in priority order. */
        setupTasks: buildSetupTasks({
          integrations: getIntegrationChecklist(),
          settings,
          shipping,
          unverifiedProducts: unverifiedProductCount,
          unverifiedContentKeys: unverifiedContentKeys.map((c) => c.key),
          activeProducts: activeProductCount,
          reviewPending,
          failedShippingSync,
        }),
      },
      { headers: noStore },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Variants at or below their low-stock threshold. */
async function fetchLowStock() {
  await connectDb();
  const { ProductVariant } = await import('@/lib/models/ProductVariant');
  const { Product } = await import('@/lib/models/Product');
  const variants = await ProductVariant.find({ isActive: true })
    .select('sku weightLabel inventory lowStockThreshold productId')
    .lean()
    .exec();
  const low = variants.filter((v) => v.inventory <= v.lowStockThreshold);
  if (!low.length) return [];
  const products = await Product.find({
    _id: { $in: low.map((v) => v.productId) },
  })
    .select('name slug')
    .lean()
    .exec();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return low.slice(0, 20).map((v) => ({
    id: String(v._id),
    sku: v.sku,
    weightLabel: v.weightLabel,
    inventory: v.inventory,
    lowStockThreshold: v.lowStockThreshold,
    productName: byId.get(String(v.productId))?.name ?? '',
  }));
}

interface SetupTask {
  id: string;
  label: string;
  detail: string;
  severity: 'blocking' | 'important' | 'optional';
  href: string;
}

function buildSetupTasks(input: {
  integrations: ReturnType<typeof getIntegrationChecklist>;
  settings: Awaited<ReturnType<typeof getBusinessSettings>>;
  shipping: Awaited<ReturnType<typeof getShippingConfig>>;
  unverifiedProducts: number;
  unverifiedContentKeys: string[];
  activeProducts: number;
  reviewPending: number;
  failedShippingSync: number;
}): SetupTask[] {
  const tasks: SetupTask[] = [];

  for (const i of input.integrations) {
    if (i.state === 'missing') {
      tasks.push({
        id: `integration-${i.key}`,
        label: `Configure ${i.label}`,
        detail: i.hint,
        severity: i.key === 'mongo' ? 'blocking' : 'important',
        href: '/admin/settings',
      });
    }
  }

  if (input.settings.isVerified === false) {
    tasks.push({
      id: 'settings-verified',
      label: 'Confirm business and registration details',
      detail:
        'Legal name, FSSAI / GST numbers and contact details are blank or unverified, so they are not published on the storefront.',
      severity: 'important',
      href: '/admin/settings',
    });
  }

  if (!input.shipping.shippingEnabled) {
    tasks.push({
      id: 'shipping-enabled',
      label: 'Complete shipping and switch it on',
      detail:
        'Checkout is disabled until a pickup address, charges and a serviceability source are configured.',
      severity: 'blocking',
      href: '/admin/shipping',
    });
  }

  if (input.activeProducts === 0) {
    tasks.push({
      id: 'no-products',
      label: 'Add your first product',
      detail: 'The shop has no active products, so the storefront cannot sell anything yet.',
      severity: 'blocking',
      href: '/admin/products',
    });
  }

  if (input.unverifiedProducts > 0) {
    tasks.push({
      id: 'products-unverified',
      label: `${input.unverifiedProducts} product(s) still marked unverified`,
      detail:
        'Price, ingredients, nutrition and legal details have not been confirmed. Unverified claims are not surfaced as fact.',
      severity: 'important',
      href: '/admin/products',
    });
  }

  if (input.unverifiedContentKeys.length) {
    tasks.push({
      id: 'content-unverified',
      label: `${input.unverifiedContentKeys.length} content section(s) still marked unverified`,
      detail: `Pending keys: ${input.unverifiedContentKeys.slice(0, 6).join(', ')}${input.unverifiedContentKeys.length > 6 ? '…' : ''}`,
      severity: 'important',
      href: '/admin/content',
    });
  }

  if (input.reviewPending > 0) {
    tasks.push({
      id: 'reviews-pending',
      label: `${input.reviewPending} review(s) awaiting moderation`,
      detail: 'Reviews stay hidden from the storefront until a human approves them.',
      severity: 'optional',
      href: '/admin/reviews',
    });
  }

  if (input.failedShippingSync > 0) {
    tasks.push({
      id: 'shipping-sync-failed',
      label: `${input.failedShippingSync} order(s) failed to create a shipment`,
      detail: 'These paid orders have no waybill. Retry the Delhivery sync from the orders table.',
      severity: 'blocking',
      href: '/admin/orders?syncStatus=FAILED',
    });
  }

  return tasks;
}