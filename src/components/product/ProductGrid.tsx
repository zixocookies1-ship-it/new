import clsx from 'clsx';

import { ProductCard } from './ProductCard';
import { EmptyState } from '@/components/ui/StateBlocks';
import type { ProductVM } from '@/lib/catalog';

/**
 * Product grid.
 *
 * Mobile: two columns with a comfortable 44px+ tap target, which is what Indian
 * phone users actually shop with. Desktop: three or four.
 */
export function ProductGrid({
  products,
  columns = 3,
  className = '',
  emptyTitle = 'No products yet',
  emptyMessage = 'Our products are being prepared. Please check back shortly.',
}: {
  products: ProductVM[];
  columns?: 2 | 3 | 4;
  className?: string;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (!products.length) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        action={{ label: 'Browse all products', href: '/shop' }}
        className={className}
      />
    );
  }

  const cols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  }[columns];

  return (
    <div className={clsx('grid gap-4 sm:gap-6', cols, className)}>
      {products.map((p, i) => (
        <ProductCard
          key={p.id}
          product={p}
          compact={columns === 4}
          priority={i < 2}
        />
      ))}
    </div>
  );
}