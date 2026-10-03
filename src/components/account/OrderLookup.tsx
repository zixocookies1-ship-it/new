'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/**
 * Order lookup — the only "account" feature a no-account store needs.
 * Orders are tracked by the order ID every confirmation carries, so
 * there is no profile to log in to. This builds the /order/[id] link
 * client-side; the destination page does the real work.
 */
export function OrderLookup() {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = orderId.trim();
    if (!id) return;
    router.push(`/order/${encodeURIComponent(id)}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="order-id" className="sr-only">
        Order ID
      </label>
      <input
        id="order-id"
        type="text"
        value={orderId}
        onChange={(e) => setOrderId(e.target.value)}
        placeholder="Enter your order ID"
        autoComplete="off"
        className="nc-input h-12 flex-1 rounded-full"
      />
      <button type="submit" className="nc-btn nc-btn-primary whitespace-nowrap">
        Track order
      </button>
    </form>
  );
}
