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

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  hydrated: boolean;
  quote: CartQuote | null;
  quoteLoading: boolean;
  paymentMethod: 'RAZORPAY' | 'COD';
  drawerOpen: boolean;
}

interface CartActions {
  addItem: (item: Omit<CartItem, 'key' | 'qty'>, qty?: number) => void;
  addBundle: (
    bundle: { bundleId: string; name: string; items: Array<{ productId: string; variantId: string; slug: string; name: string; flavour: string; weightLabel: string; imageUrl: string | null; unitPricePaise: number; mrpPaise: number | null; qty: number }> },
    qty?: number,
  ) => void;
  updateQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<{ ok: boolean; message: string }>;
  removeCoupon: () => void;
  setPaymentMethod: (m: 'RAZORPAY' | 'COD') => void;
  reconcile: () => Promise<CartQuote | null>;
  openDrawer: () => void;
  closeDrawer: () => void;
  count: number;
  hasIssues: boolean;
}

const CartContext = createContext<(CartState & CartActions) | null>(null);

const STORAGE_KEY = 'nc_cart_v1';
const META_KEY = 'nc_cart_meta_v1';

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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'RAZORPAY' | 'COD'>('RAZORPAY');
  const [hydrated, setHydrated] = useState(false);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    setHydrated(true);
  }, []);

  // --- persist -------------------------------------------------------------
  useEffect(() => {
    if (!hydrated) return;
    writeStorage(items, couponCode, paymentMethod);
  }, [items, couponCode, paymentMethod, hydrated]);

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
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const couponRef = useRef(couponCode);
  couponRef.current = couponCode;
  const methodRef = useRef(paymentMethod);
  methodRef.current = paymentMethod;
  const inFlight = useRef(false);

  const reconcile = useCallback(async (): Promise<CartQuote | null> => {
    const current = itemsRef.current;
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

  // Reconcile whenever the cart meaningfully changes (debounced).
  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    const t = setTimeout(() => void reconcile(), 350);
    return () => clearTimeout(t);
  }, [items, couponCode, paymentMethod, hydrated, reconcile]);

  // --- actions -------------------------------------------------------------
  const addItem = useCallback(
    (item: Omit<CartItem, 'key' | 'qty'>, qty = 1) => {
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
      setDrawerOpen(true);
    },
    [broadcast],
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
      setDrawerOpen(true);
    },
    [broadcast],
  );

  const updateQty = useCallback((key: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.key !== key);
      return prev.map((i) => (i.key === key ? { ...i, qty: Math.min(20, qty) } : i));
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCode(null);
    setQuote(null);
  }, []);

  const applyCoupon = useCallback(
    async (code: string): Promise<{ ok: boolean; message: string }> => {
      const current = itemsRef.current;
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
      couponCode,
      hydrated,
      quote,
      quoteLoading,
      paymentMethod,
      drawerOpen,
      addItem,
      addBundle,
      updateQty,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
      setPaymentMethod,
      reconcile,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      count,
      hasIssues,
    }),
    [
      items,
      couponCode,
      hydrated,
      quote,
      quoteLoading,
      paymentMethod,
      drawerOpen,
      addItem,
      addBundle,
      updateQty,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
      reconcile,
      count,
      hasIssues,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState & CartActions {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>.');
  return ctx;
}
