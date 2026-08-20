"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  qty: number;
  stock: number;
  // Optional so carts saved before per-product shipping still parse; absent
  // values fall back to the store-wide fee at display time.
  shippingCents?: number | null;
  freeShipping?: boolean;
  /**
   * Colour the buyer chose, when the product offers any. Part of the line's
   * IDENTITY: the same trike in two colours is two cart lines, not one with a
   * doubled quantity.
   */
  color?: string | null;
};

/**
 * Identity of a cart line.
 *
 * Product id alone is not enough once colours exist. Carts saved before colours
 * have no colour and key as `id::`, so they keep working untouched.
 */
export function cartLineKey(item: Pick<CartItem, "productId" | "color">): string {
  return `${item.productId}::${item.color ?? ""}`;
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  /** Keyed by cartLineKey, not product id — colours make those differ. */
  setQty: (lineKey: string, qty: number) => void;
  remove: (lineKey: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "edrift.cart.v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // The stored cart is a snapshot from add-to-cart time; refresh price,
  // stock, and shipping from the live catalog once per load so admin edits
  // (e.g. a changed shipping fee) show correctly in cart and checkout.
  useEffect(() => {
    if (!hydrated) return;
    setItems((prev) => {
      if (prev.length === 0) return prev;
      // Distinct product ids — two colours of one product are two lines but a
      // single product to look up.
      const ids = [...new Set(prev.map((i) => i.productId))].join(",");
      fetch(`/api/product-info?ids=${encodeURIComponent(ids)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (data: {
            products?: {
              id: string;
              price_cents: number;
              stock: number;
              shipping_cents: number | null;
              free_shipping: boolean;
            }[];
          } | null) => {
            const fresh = data?.products;
            if (!fresh?.length) return;
            setItems((cur) =>
              cur.map((i) => {
                const f = fresh.find((p) => p.id === i.productId);
                return f
                  ? {
                      ...i,
                      priceCents: f.price_cents,
                      stock: f.stock,
                      shippingCents: f.shipping_cents,
                      freeShipping: f.free_shipping,
                    }
                  : i;
              })
            );
          }
        )
        .catch(() => {
          /* keep the snapshot */
        });
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const clampQty = (qty: number, stock: number) =>
      Math.max(1, Math.min(qty, stock > 0 ? stock : qty));
    return {
      items,
      count: items.reduce((n, i) => n + i.qty, 0),
      subtotalCents: items.reduce((n, i) => n + i.priceCents * i.qty, 0),
      add: (item, qty = 1) =>
        setItems((prev) => {
          const key = cartLineKey(item);
          const existing = prev.find((i) => cartLineKey(i) === key);
          if (existing)
            return prev.map((i) =>
              cartLineKey(i) === key
                ? { ...i, qty: clampQty(i.qty + qty, i.stock) }
                : i
            );
          return [...prev, { ...item, qty: clampQty(qty, item.stock) }];
        }),
      setQty: (lineKey, qty) =>
        setItems((prev) =>
          prev.map((i) =>
            cartLineKey(i) === lineKey ? { ...i, qty: clampQty(qty, i.stock) } : i
          )
        ),
      remove: (lineKey) =>
        setItems((prev) => prev.filter((i) => cartLineKey(i) !== lineKey)),
      clear: () => setItems([]),
      open,
      setOpen,
    };
  }, [items, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
