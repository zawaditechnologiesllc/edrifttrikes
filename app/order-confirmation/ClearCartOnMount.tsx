"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";

// Clears the cart once the order is confirmed (covers the Stripe redirect path).
export default function ClearCartOnMount() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
