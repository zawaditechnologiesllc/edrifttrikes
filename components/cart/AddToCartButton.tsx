"use client";

import { useState } from "react";
import { useCart, type CartItem } from "./CartProvider";

export default function AddToCartButton({
  item,
  className,
  label = "Add to Cart",
  qty = 1,
  guard,
}: {
  item: Omit<CartItem, "qty">;
  className?: string;
  label?: string;
  qty?: number;
  /**
   * Runs before the item is added; returning false cancels it.
   *
   * Used for a required choice such as colour. The button stays ENABLED so the
   * click can explain what is missing — a disabled control just sits there
   * telling the buyer nothing.
   */
  guard?: () => boolean;
}) {
  const { add, setOpen } = useCart();
  const [added, setAdded] = useState(false);
  const soldOut = item.stock <= 0;

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => {
        if (soldOut) return;
        if (guard && !guard()) return;
        add(item, qty);
        setOpen(true);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className={
        className ??
        "bg-primary-container text-white px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      }
    >
      {soldOut ? "Sold Out" : added ? "Added ✓" : label}
    </button>
  );
}
