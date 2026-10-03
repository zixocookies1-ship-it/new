'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

/** Primary sidebar navigation – exactly 7 sections in specified order. */
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: 'M3 10.5 10 4l7 6.5M5 9.5V16h10V9.5' },
  { label: 'Orders', href: '/admin/orders', icon: 'M4 5h12v11H4zM4 8h12M7 11.5h6' },
  { label: 'Delivery', href: '/admin/delivery', icon: 'M2 8h9v6H2zM11 10h3l3 2.5V14h-6zM6 16.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8M13.5 16.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8' },
  { label: 'Products', href: '/admin/products', icon: 'M4 6l6-2 6 2v8l-6 2-6-2zM4 6l6 2 6-2M10 8v8' },
  { label: 'Coupons', href: '/admin/coupons', icon: 'M3 7h14v6H3zM12 9.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2' },
  { label: 'Settings', href: '/admin/settings', icon: 'M10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4' },
  { label: 'Payment & Delivery API Keys', href: '/admin/integrations', icon: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M4 17c0-3.3 2.7-5 6-5s6 1.7 6 5' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="lg:pb-3">
      <ul className="flex flex-col lg:flex-row gap-2 overflow-x-auto nc-no-scrollbar lg:overflow-visible">
        {NAV_ITEMS.map((item) => {
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
                  active ? 'bg-cream-50/15 text-cream-50' : 'text-cream-200/80 hover:bg-cream-50/10 hover:text-cream-50',
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
    </nav>
  );
}