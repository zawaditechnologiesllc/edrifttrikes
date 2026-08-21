"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart, type CartItem } from "@/components/cart/CartProvider";

/**
 * Puts an abandoned order's items back in the cart.
 *
 * The link in an abandoned-order email carries `?recover=<order id>`. Without
 * this the email could only say "come back to the shop" — which is the part the
 * buyer had already done. With it, they land on a cart holding the exact trike,
 * colour and quantity they chose, which is the whole point of chasing the order
 * at all.
 *
 * ADDITIVE, NEVER DESTRUCTIVE. If they have since put something else in their
 * cart, this adds to it rather than replacing it. Deleting a live cart to
 * restore a stale one would lose a sale to win one back.
 *
 * The recovered items are dropped into the same `add()` the shop uses, so
 * colours stay part of the line identity and prices refresh from the live
 * product record exactly as they do for anything else in the cart.
 */
export default function CartRecovery() {
  const params = useSearchParams();
  const router = useRouter();
  const { add, items, setOpen } = useCart();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "empty">("idle");
  /** One attempt per page load — add() changes `items`, which re-renders us. */
  const attempted = useRef(false);

  const orderId = params.get("recover");

  useEffect(() => {
    if (!orderId || attempted.current) return;
    attempted.current = true;

    let cancelled = false;
    (async () => {
      setStatus("working");
      try {
        const response = await fetch(
          `/api/cart/recover?order=${encodeURIComponent(orderId)}`
        );
        const data = (await response.json()) as { items?: Omit<CartItem, "stock">[] };
        const recovered = Array.isArray(data.items) ? data.items : [];
        if (cancelled) return;

        // Anything already in the cart wins — re-adding would double a
        // quantity the buyer has since chosen for themselves.
        const present = new Set(items.map((i) => `${i.productId}::${i.color ?? ""}`));
        let added = 0;
        for (const item of recovered) {
          if (present.has(`${item.productId}::${item.color ?? ""}`)) continue;
          add(
            {
              productId: item.productId,
              slug: item.slug,
              name: item.name,
              priceCents: item.priceCents,
              imageUrl: item.imageUrl ?? null,
              // The live figure arrives with the cart's own price refresh; this
              // is only what it starts from.
              stock: 99,
              color: item.color ?? null,
            },
            item.qty
          );
          added++;
        }
        setStatus(recovered.length === 0 ? "empty" : "done");
        if (added > 0) setOpen(false);
      } catch {
        if (!cancelled) setStatus("empty");
      } finally {
        // Drop the parameter so a refresh, a back button or a shared URL does
        // not re-run the restore.
        if (!cancelled) router.replace("/cart", { scroll: false });
      }
    })();

    return () => {
      cancelled = true;
    };
    // `items` is read inside but must NOT retrigger this: add() mutates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!orderId && status === "idle") return null;

  if (status === "empty") {
    return (
      <div
        role="status"
        className="mb-6 rounded-lg border border-white/10 bg-surface-container-low p-4"
      >
        <p className="text-on-surface-variant text-sm">
          That order has already been paid for, or the link has expired — nothing
          was added. Everything in the shop is still here.
        </p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div
        role="status"
        className="mb-6 rounded-lg border border-secondary/40 bg-secondary/10 p-4"
      >
        <p className="text-white font-label-bold uppercase tracking-widest text-xs">
          Welcome back
        </p>
        <p className="text-on-surface-variant text-sm mt-1">
          We&apos;ve put what you were looking at back in your cart. Nothing has been
          charged — check it over and carry on when you&apos;re ready.
        </p>
      </div>
    );
  }

  return null;
}
