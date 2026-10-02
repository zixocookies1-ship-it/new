import { OrdersClient } from '@/components/admin/OrdersClient';

export const metadata = { title: 'Orders' };

interface SearchParams {
  q?: string;
  status?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  syncStatus?: string;
}

/**
 * Read filters on the server so the dashboard can deep-link straight into
 * "the orders that failed to ship" without a client-side searchParams read
 * (which would force a Suspense boundary).
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <OrdersClient
      initial={{
        q: typeof params.q === 'string' ? params.q : undefined,
        status: typeof params.status === 'string' ? params.status : undefined,
        paymentStatus: typeof params.paymentStatus === 'string' ? params.paymentStatus : undefined,
        shippingStatus: typeof params.shippingStatus === 'string' ? params.shippingStatus : undefined,
        syncStatus: typeof params.syncStatus === 'string' ? params.syncStatus : undefined,
      }}
    />
  );
}