import { OrdersClient } from '@/components/admin/OrdersClient';

export const metadata = { title: 'Orders' };

export default function AdminOrdersPage() {
  return <OrdersClient initial={{ q: undefined, status: undefined, paymentStatus: undefined, shippingStatus: undefined, syncStatus: undefined }} />;
}