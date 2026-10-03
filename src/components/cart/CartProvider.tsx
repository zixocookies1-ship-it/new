'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

/**
 * Cart state.
 *
 * Client responsibilities: line identity, quantities, and an instant display
 * snapshot so the drawer feels fast.
 *
 * Server responsibilities: every price, discount, shipping charge and total.
 * `reconcile()` pulls the authoritative quote and overwrites the display
 * snapshot, so a stale or tampered local price can never survive into checkout.
 */

export interface CartItem {
  /** Stable composite key. */
  key: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  flavour: string;
  weightLabel: string;
  imageUrl: string | null;
  /** Display-only snapshot in paise; replaced by reconcile(). */
  unitPricePaise: number;
  mrpPaise: number | null;
  qty: number;
  bundleId?: string | null;
  bundleName?: string | null;
}

export interface CartQuote {
  ok: boolean;
  lines: Array<{
    productId: string;
    variantId: string;
    name: string;
    weightLabel: string;
    imageUrl: string | null;
    unitPricePaise: number;
    mrpPaise: number | null;
    qty: number;
    lineTotalPaise: number;
  }>;
  issues: Array<{ code: string; message: string; productId?: string; variantId?: string }>;
  subtotalPaise: number;
  mrpTotalPaise: number;
  productDiscountPaise: number;
  couponDiscountPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  coupon: { valid: boolean; code: string; message: string; discountPaise: number } | null;
  freeShippingThresholdPaise: number | null;
  freeShippingShortfallPaise: number;
  freeShippingUnlocked: boolean;
  codAvailable: boolean;
  codBlockedReason: string | null;
  onlinePaymentAvailable: boolean;
}

export interface CartToast {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'error';
  /** Optional affordance, e.g. "Open cart". */
  actionLabel?: string;
  onAction?: () => void;
}

interface CartState {
  items: CartItem[];
  /**
   * Items the customer chose with "Buy now". They are checked out immediately and
   * are deliberately kept separate from `items`, so a successful purchase can
   * never delete unrelated things that were already sitting in the cart.
   */
  buyNowItems: CartItem[];
  /** True while checkout is operating on `buyNowItems` rather than the cart. */
  isBuyNow: boolean;
  /**
   * What checkout is actually buying: the buy-now lines when a "Buy now" purchase
   * is in progress, otherwise the cart. Both the checkout page and the
   * server-authoritative quote read this.
   */
  checkoutItems: CartItem[];
  couponCode: string | null;
  hydrated: boolean;
  quote: CartQuote | null;
  quoteLoading: boolean;
  paymentMethod: 'RAZORPAY' | 'COD';
  drawerOpen: boolean;
  toast: CartToast | null;
}

interface CartActions {
  /**
   * Adds an item to the cart and shows a small "Added to cart ✓" toast.
   * The cart drawer is deliberately NOT opened — the customer stays where they
   * are and keeps shopping. Pass `{ openDrawer: true }` to opt into the drawer.
   */
  addItem: (
    item: Omit<CartItem, 'key' | 'qty'>,
    qty?: number,
    opts?: { openDrawer?: boolean; silent?: boolean },
  ) => void;
  addBundle: (
    bundle: { bundleId: string; name: string; items: Array<{ productId: string; variantId: string; slug: string; name: string; flavour: string; weightLabel: string; imageUrl: string | null; unitPricePaise: number; mrpPaise: number | null; qty: number }> },
    qty?: number,
  ) => void;
  /** Make `item` the checkout item and send the customer straight to checkout. */
  buyNow: (item: Omit<CartItem, 'key' | 'qty'>, qty?: number) => void;
  /** Abandon a buy-now checkout. The cart is left untouched. */
  cancelBuyNow: () => void;
  updateQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  /**
   * Called ONLY after the server has verified the payment.
   *  - normal checkout  -> the cart (and its coupon) is emptied
   *  - "Buy now"        -> only the buy-now lines are dropped, the cart survives
   */
  completePurchase: () => void;
  applyCoupon: (code: string) => Promise<{ ok: boolean; message: string }>;
  removeCoupon: () => void;
  setPaymentMethod: (m: 'RAZORPAY' | 'COD') => void;
  reconcile: () => Promise<CartQuote | null>;
  openDrawer: () => void;
  closeDrawer: () => void;
  notify: (message: string, tone?: CartToast['tone'], action?: { label: string; onClick: () => void }) => void;
  dismissToast: () => void;
  count: number;
  hasIssues: boolean;
}

const CartContext = createContext<(CartState & CartActions) | null>(null);

const STORAGE_KEY = 'nc_cart_v1';
const META_KEY = 'nc_cart_meta_v1';
/**
 * Buy-now lines live in sessionStorage, not localStorage: they belong to one
 * browsing session, and a refresh mid-checkout must not lose them.
 */
const BUY_NOW_KEY = 'nc_buy_now_v1';

interface PersistedCart {
  items: CartItem[];
  couponCode: string | null;
  paymentMethod: 'RAZORPAY' | 'COD';
  savedAt: number;
}

function readStorage(): PersistedCart | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCart;
    if (!Array.isArray(parsed.items)) return null;
    // Cart snapshots older than 30 days are discarded.
    if (Date.now() - (parsed.savedAt ?? 0) > 30 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(items: CartItem[], couponCode: string | null, paymentMethod: 'RAZORPAY' | 'COD') {
  try {
    const payload: PersistedCart = { items, couponCode, paymentMethod, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage full or blocked — cart still works for this session */
  }
}

function readBuyNow(): CartItem[] {
  try {
    const raw = window.sessionStorage.getItem(BUY_NOW_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i) => i && typeof i.key === 'string' && i.productId && i.variantId);
  } catch {
    return [];
  }
}

function writeBuyNow(next: CartItem[]): void {
  try {
    if (next.length === 0) window.sessionStorage.removeItem(BUY_NOW_KEY);
    else window.sessionStorage.setItem(BUY_NOW_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [buyNowItems, setBuyNowItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'RAZORPAY' | 'COD'>('RAZORPAY');
  const [hydrated, setHydrated] = useState(false);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<CartToast | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** What checkout is buying right now. */
  const isBuyNow = buyNowItems.length > 0;
  const checkoutItems = isBuyNow ? buyNowItems : items;

  const dismissToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(null);
  }, []);

  const notify = useCallback<CartActions['notify']>((message, tone = 'success', action) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, tone, actionLabel: action?.label, onAction: action?.onClick });
    toastTimer.current = setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
    }, 3200);
  }, []);

  // Clear any toast on unmount so a timer cannot fire into a dead tree.
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Cross-tab sync without any dependency.
  const broadcast = useCallback(() => {
    try {
      window.localStorage.setItem(
        META_KEY,
        JSON.stringify({ at: Date.now(), items: items.length }),
      );
    } catch {
      /* ignore */
    }
  }, [items.length]);

  // --- hydrate -------------------------------------------------------------
  useEffect(() => {
    const stored = readStorage();
    if (stored) {
      setItems(stored.items);
      setCouponCode(stored.couponCode);
      setPaymentMethod(stored.paymentMethod === 'COD' ? 'COD' : 'RAZORPAY');
    }
    setBuyNowItems(readBuyNow());
    setHydrated(true);
  }, []);

  // --- persist -------------------------------------------------------------
  useEffect(() => {
    if (!hydrated) return;
    writeStorage(items, couponCode, paymentMethod);
  }, [items, couponCode, paymentMethod, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeBuyNow(buyNowItems);
  }, [buyNowItems, hydrated]);

  /**
   * A buy-now checkout only lives on the checkout page. The moment the customer
   * navigates anywhere else the buy-now lines are dropped, so the cart drawer and
   * cart page always describe the real cart again.
   */
  const pathname = usePathname();
  useEffect(() => {
    if (!hydrated || buyNowItems.length === 0) return;
    if (pathname && !pathname.startsWith('/checkout')) setBuyNowItems([]);
  }, [pathname, hydrated, buyNowItems.length]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const stored = readStorage();
      if (stored) {
        setItems(stored.items);
        setCouponCode(stored.couponCode);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // --- server-authoritative quote -----------------------------------------
  // The quote always describes `checkoutItems`, so during a "Buy now" purchase
  // the server prices the buy-now lines and not the cart behind them.
  const checkoutItemsRef = useRef(checkoutItems);
  checkoutItemsRef.current = checkoutItems;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const couponRef = useRef(couponCode);
  couponRef.current = couponCode;
  const methodRef = useRef(paymentMethod);
  methodRef.current = paymentMethod;
  const inFlight = useRef(false);

  const reconcile = useCallback(async (): Promise<CartQuote | null> => {
    const current = checkoutItemsRef.current;
    if (current.length === 0) {
      setQuote(null);
      return null;
    }
    if (inFlight.current) return null;
    inFlight.current = true;
    setQuoteLoading(true);

    try {
      const bundles = current
        .filter((i) => i.bundleId)
        .reduce<Record<string, number>>((acc, i) => {
          if (i.bundleId) acc[i.bundleId] = (acc[i.bundleId] ?? 0) + i.qty;
          return acc;
        }, {});

      const res = await fetch('/api/cart/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: current
            .filter((i) => !i.bundleId)
            .map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
          bundles: Object.entries(bundles).map(([bundleId, qty]) => ({ bundleId, qty })),
          couponCode: couponRef.current,
          paymentMethod: methodRef.current,
        }),
      });

      if (!res.ok) {
        setQuote(null);
        return null;
      }
      const json = (await res.json()) as { ok: boolean; data?: CartQuote };
      if (!json.ok || !json.data) {
        setQuote(null);
        return null;
      }

      setQuote(json.data);
      return json.data;
    } catch {
      setQuote(null);
      return null;
    } finally {
      inFlight.current = false;
      setQuoteLoading(false);
    }
  }, []);

  // Reconcile whenever what we are buying meaningfully changes (debounced).
  useEffect(() => {
    if (!hydrated) return;
    if (checkoutItems.length === 0) {
      setQuote(null);
      return;
    }
    const t = setTimeout(() => void reconcile(), 350);
    return () => clearTimeout(t);
  }, [checkoutItems, couponCode, paymentMethod, hydrated, reconcile]);

  // --- actions -------------------------------------------------------------
  const addItem = useCallback(
    (
      item: Omit<CartItem, 'key' | 'qty'>,
      qty = 1,
      opts?: { openDrawer?: boolean; silent?: boolean },
    ) => {
      const key = `${item.productId}:${item.variantId}`;
      setItems((prev) => {
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          return prev.map((i) =>
            i.key === key ? { ...i, qty: Math.min(20, i.qty + qty) } : i,
          );
        }
        return [...prev, { ...item, key, qty: Math.min(20, Math.max(1, qty)) }];
      });
      broadcast();
      // Stay on the page. The customer keeps shopping; the toast is the receipt.
      if (opts?.openDrawer) setDrawerOpen(true);
      else if (!opts?.silent) {
        notify(
          qty > 1 ? `${item.name} ×${qty} added to cart ✓` : `${item.name} added to cart ✓`,
          'success',
          { label: 'View cart', onClick: () => setDrawerOpen(true) },
        );
      }
    },
    [broadcast, notify],
  );

  const addBundle = useCallback(
    (
      bundle: {
        bundleId: string;
        name: string;
        items: Array<{
          productId: string;
          variantId: string;
          slug: string;
          name: string;
          flavour: string;
          weightLabel: string;
          imageUrl: string | null;
          unitPricePaise: number;
          mrpPaise: number | null;
          qty: number;
        }>;
      },
      qty = 1,
    ) => {
      const key = `bundle:${bundle.bundleId}`;
      setItems((prev) => {
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          return prev.map((i) =>
            i.key === key ? { ...i, qty: Math.min(20, i.qty + qty) } : i,
          );
        }
        // A bundle is one cart entry; its constituent products are stored in a
        // single synthetic item so the checkout posts it as one bundle line.
        const perUnit = Math.round(
          bundle.items.reduce((s, i) => s + i.unitPricePaise, 0) / Math.max(1, bundle.items.length),
        );
        return [
          ...prev,
          {
            key,
            productId: bundle.items[0]?.productId ?? '',
            variantId: bundle.items[0]?.variantId ?? '',
            slug: bundle.items[0]?.slug ?? '',
            name: bundle.name,
            flavour: 'bundle',
            weightLabel: `${bundle.items.length} flavours`,
            imageUrl: bundle.items[0]?.imageUrl ?? null,
            unitPricePaise: perUnit * bundle.items.length,
            mrpPaise: null,
            qty: Math.min(20, Math.max(1, qty)),
            bundleId: bundle.bundleId,
            bundleName: bundle.name,
          },
        ];
      });
      broadcast();
      // Stay on the page; toast instead of the drawer.
      notify(`${bundle.name} added to cart ✓`, 'success', {
        label: 'View cart',
        onClick: () => setDrawerOpen(true),
      });
    },
    [broadcast, notify],
  );

  /**
   * "Buy now": the product becomes the checkout item immediately. The customer's
   * existing cart is left completely alone — it is neither read, modified, nor
   * cleared by this path.
   */
  const buyNow = useCallback((item: Omit<CartItem, 'key' | 'qty'>, qty = 1) => {
    const key = `${item.productId}:${item.variantId}`;
    setBuyNowItems([{ ...item, key, qty: Math.min(20, Math.max(1, qty)) }]);
    setQuote(null);
  }, []);

  const cancelBuyNow = useCallback(() => {
    setBuyNowItems([]);
    setQuote(null);
  }, []);

  const updateQty = useCallback((key: string, qty: number) => {
    const apply = (prev: CartItem[]) => {
      if (qty <= 0) return prev.filter((i) => i.key !== key);
      return prev.map((i) => (i.key === key ? { ...i, qty: Math.min(20, qty) } : i));
    };
    // Edit whichever set checkout is currently operating on.
    if (buyNowItems.length > 0) {
      const next = apply(buyNowItems);
      setBuyNowItems(next);
      if (next.length === 0) setQuote(null);
      return;
    }
    setItems(apply);
  }, [buyNowItems]);

  const removeItem = useCallback(
    (key: string) => {
      if (buyNowItems.length > 0) {
        const next = buyNowItems.filter((i) => i.key !== key);
        setBuyNowItems(next);
        if (next.length === 0) setQuote(null);
        return;
      }
      setItems((prev) => prev.filter((i) => i.key !== key));
    },
    [buyNowItems],
  );

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCode(null);
    setQuote(null);
  }, []);

  /**
   * Post-payment cleanup. Only ever called once the server has verified the
   * payment. A "Buy now" purchase drops just its own lines, so anything the
   * customer had in their cart survives the purchase.
   */
  const completePurchase = useCallback(() => {
    if (buyNowItems.length > 0) {
      setBuyNowItems([]);
      setQuote(null);
      return;
    }
    setItems([]);
    setCouponCode(null);
    setQuote(null);
  }, [buyNowItems.length]);

  const applyCoupon = useCallback(
    async (code: string): Promise<{ ok: boolean; message: string }> => {
      // Price the active checkout set so a coupon applied at checkout is
      // validated against exactly what is being bought.
      const current = checkoutItemsRef.current;
      if (current.length === 0) return { ok: false, message: 'Add an item to your cart first.' };

      const bundles = current
        .filter((i) => i.bundleId)
        .reduce<Record<string, number>>((acc, i) => {
          if (i.bundleId) acc[i.bundleId] = (acc[i.bundleId] ?? 0) + i.qty;
          return acc;
        }, {});

      try {
        const res = await fetch('/api/cart/coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            lines: current
              .filter((i) => !i.bundleId)
              .map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
            bundles: Object.entries(bundles).map(([bundleId, qty]) => ({ bundleId, qty })),
            paymentMethod: methodRef.current,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          error?: string;
          data?: { valid: boolean; message: string };
        };

        if (!res.ok || !json.ok) {
          return { ok: false, message: json.error ?? 'That coupon could not be applied.' };
        }
        if (!json.data?.valid) {
          return { ok: false, message: json.data?.message ?? 'That coupon is not valid.' };
        }
        setCouponCode(code.trim().toUpperCase());
        return { ok: true, message: json.data.message };
      } catch {
        return { ok: false, message: 'Network error. Please try again.' };
      }
    },
    [],
  );

  const removeCoupon = useCallback(() => setCouponCode(null), []);

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const hasIssues = Boolean(quote?.issues?.length);

  const value = useMemo<CartState & CartActions>(
    () => ({
      items,
      buyNowItems,
      isBuyNow,
      checkoutItems,
      couponCode,
      hydrated,
      quote,
      quoteLoading,
      paymentMethod,
      drawerOpen,
      toast,
      addItem,
      addBundle,
      buyNow,
      cancelBuyNow,
      updateQty,
      removeItem,
      clearCart,
      completePurchase,
      applyCoupon,
      removeCoupon,
      setPaymentMethod,
      reconcile,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      notify,
      dismissToast,
      count,
      hasIssues,
    }),
    [
      items,
      buyNowItems,
      isBuyNow,
      checkoutItems,
      couponCode,
      hydrated,
      quote,
      quoteLoading,
      paymentMethod,
      drawerOpen,
      toast,
      addItem,
      addBundle,
      buyNow,
      cancelBuyNow,
      updateQty,
      removeItem,
      clearCart,
      completePurchase,
      applyCoupon,
      removeCoupon,
      reconcile,
      notify,
      dismissToast,
      count,
      hasIssues,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartToast toast={toast} onDismiss={dismissToast} />
    </CartContext.Provider>
  );
}

/**
 * The "Added to cart ✓" receipt.
 *
 * Small, non-blocking, and gone in a few seconds — it must never steal focus or
 * interrupt someone who is still choosing what to buy. Rendered once, here, so
 * every add-to-cart surface in the storefront gets it for free.
 */
function CartToast({ toast, onDismiss }: { toast: CartToast | null; onDismiss: () => void }) {
  if (!toast) return null;

  const tone =
    toast.tone === 'error'
      ? 'border-[#8F3333]/30 bg-white text-[#8F3333]'
      : toast.tone === 'info'
        ? 'border-cream-400 bg-white text-ink'
        : 'border-leaf-600/25 bg-white text-leaf-600';

  return (
    <div
      // `polite` so a screen reader announces the confirmation without
      // interrupting whatever the customer is doing.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 nc-safe-bottom lg:bottom-6"
    >
      <div
        className={`pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border px-4 py-2.5 text-sm font-medium shadow-card-hover ${tone}`}
      >
        {toast.tone === 'success' ? (
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m4.5 10.5 3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        <span className="truncate">{toast.message}</span>
        {toast.actionLabel && toast.onAction ? (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            className="shrink-0 font-semibold underline decoration-current/30 underline-offset-4 hover:decoration-current"
          >
            {toast.actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m5 5 10 10M15 5 5 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function useCart(): CartState & CartActions {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>.');
  return ctx;
}
