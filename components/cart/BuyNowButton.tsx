"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "./CartProvider";

/**
 * The direct path: add this product to the cart (if it isn't already) and go
 * straight to checkout in one click, skipping the cart drawer. Keeps the
 * shopping journey short — product → pay.
 */
export default function BuyNowButton({
  item,
  className,
  label = "Buy Now",
  qty = 1,
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
}) {
  const { add } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const soldOut = item.stock <= 0;

  return (
    <button
      type="button"
      disabled={soldOut || busy}
      onClick={() => {
        if (soldOut || busy) return;
        setBusy(true);
        add(item, qty);
        router.push("/checkout");
      }}
      className={
        className ??
        "bg-secondary text-on-secondary-fixed px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      }
    >
      {soldOut ? "Sold Out" : busy ? "…" : label}
    </button>
  );
}
