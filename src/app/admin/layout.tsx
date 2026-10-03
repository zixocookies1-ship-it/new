import type { Metadata } from 'next';
import './admin.css';

/**
 * Admin document chrome.
 *
 * The admin panel is completely separate from the storefront: no header, no
 * footer, no cart drawer, and it must never be indexed. The
 * route-level auth guard lives in `src/app/admin/(panel)/layout.tsx`.
 */
export const metadata: Metadata = {
  title: {
    default: 'Admin · Nature’s Choice Jaggery',
    template: '%s · Admin',
  },
  robots: { index: false, follow: false, nocache: true },
  // No session cookie leakage via prefetch.
  referrer: 'same-origin',
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-100 font-sans text-ink">{children}</div>
  );
}
