import { CustomersClient } from '@/components/admin/CustomersClient';

export const metadata = { title: 'Customers' };

interface SearchParams {
  q?: string;
}

/**
 * Search terms arrive as props so the panel can deep-link from an order to that
 * customer's full history without a client-side `useSearchParams` read.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return <CustomersClient initial={{ q: typeof params.q === 'string' ? params.q : undefined }} />;
}