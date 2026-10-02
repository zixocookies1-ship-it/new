'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

/** Paths the operator touches daily come first; configuration is last. */
const GROUPS: NavGroup[] = [
  {
    heading: 'Selling',
    items: [
      { label: 'Overview', href: '/admin', icon: 'M3 10.5 10 4l7 6.5M5 9.5V16h10V9.5' },
      { label: 'Orders', href: '/admin/orders', icon: 'M4 5h12v11H4zM4 8h12M7 11.5h6' },
      { label: 'Products', href: '/admin/products', icon: 'M4 6l6-2 6 2v8l-6 2-6-2zM4 6l6 2 6-2M10 8v8' },
      { label: 'Reviews', href: '/admin/reviews', icon: 'M10 3l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4L5.5 16.7l.9-5L2.8 8.2l5-.7z' },
      { label: 'Messages', href: '/admin/messages', icon: 'M3 5h14v9H8l-4 3v-3H3z' },
    ],
  },
  {
    heading: 'Catalogue',
    items: [
      { label: 'Bundles', href: '/admin/bundles', icon: 'M4 6h4v4H4zM12 6h4v4h-4zM8 12h4v4H8z' },
      { label: 'Coupons', href: '/admin/coupons', icon: 'M3 7h14v6H3zM12 9.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2' },
      { label: 'Recipes', href: '/admin/recipes', icon: 'M5 4h10v12H5zM7.5 8h5M7.5 11h5' },
      { label: 'FAQ', href: '/admin/faqs', icon: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M8.4 8a1.7 1.7 0 1 1 2.2 2v1.2M10 13.6v.2' },
      { label: 'Media', href: '/admin/media', icon: 'M3 5h14v10H3zM3 12l4-4 3 3 2-2 5 5' },
    ],
  },
  {
    heading: 'Site',
    items: [
      { label: 'Content', href: '/admin/content', icon: 'M4 4h12v12H4zM6.5 7.5h7M6.5 10.5h7M6.5 13.5h4' },
      { label: 'Shipping', href: '/admin/shipping', icon: 'M2 8h9v6H2zM11 10h3l3 2.5V14h-6zM6 16.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8M13.5 16.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8' },
      { label: 'Customers', href: '/admin/customers', icon: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M4 17c0-3.3 2.7-5 6-5s6 1.7 6 5' },
      { label: 'Settings', href: '/admin/settings', icon: 'M10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4' },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="lg:pb-3">
      {GROUPS.map((group) => (
        <div key={group.heading} className="px-2 py-1.5">
          <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-widest text-cream-200/55">
            {group.heading}
          </p>
          <ul className="flex gap-1 overflow-x-auto nc-no-scrollbar lg:flex-col lg:overflow-visible">
            {group.items.map((item) => {
              const active =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href} className="shrink-0 lg:shrink">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex min-h-[38px] items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors lg:min-h-0 lg:py-2',
                      active
                        ? 'bg-cream-50/15 text-cream-50'
                        : 'text-cream-200/80 hover:bg-cream-50/10 hover:text-cream-50',
                    )}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4 shrink-0 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
