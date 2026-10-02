/**
 * All money in this system is stored and computed as an integer number of
 * paise (INR minor units). Floats are never used for money.
 *
 * Razorpay, MongoDB documents and API responses all speak paise, which removes
 * an entire class of rounding bugs from checkout, webhooks and refunds.
 */

export const RUPEE = 100;

export function toPaise(amount: number | string): number {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * RUPEE);
}

export function toRupees(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return paise / RUPEE;
}

/** Format paise as a plain INR string, e.g. 24900 -> "₹249". */
export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = toRupees(Math.round(paise || 0));
  const showDecimals = opts.decimals ?? rupees % 1 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(rupees);
}

/** Format paise for Razorpay `amount` field (integer, never a float). */
export function paiseForGateway(paise: number): number {
  const v = Math.round(paise || 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function discountPct(mrp: number, price: number): number {
  if (mrp <= 0 || price <= 0 || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
