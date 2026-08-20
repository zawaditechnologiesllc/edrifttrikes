"use client";

import { useState } from "react";
import AddToCartButton from "@/components/cart/AddToCartButton";
import BuyNowButton from "@/components/cart/BuyNowButton";
import WishlistButton from "@/components/storefront/WishlistButton";
import type { CartItem } from "@/components/cart/CartProvider";
import type { ProductColor } from "@/lib/colors";

/**
 * Colour choice plus the buy actions.
 *
 * These live together because the choice is part of what goes in the cart —
 * splitting them would mean lifting selection state into the page, which is a
 * server component. The colour becomes part of the cart line's identity, so the
 * same trike in two colours is two lines rather than one with a doubled
 * quantity.
 */
export default function ProductBuyPanel({
  item,
  colors,
  productId,
}: {
  /** Everything about the cart line except the colour and quantity. */
  item: Omit<CartItem, "qty" | "color">;
  colors: ProductColor[];
  productId: string;
}) {
  const mustChoose = colors.length > 0;
  // No default when there's a choice to make: pre-selecting one means a buyer
  // who skimmed the page receives a colour they never picked.
  const [color, setColor] = useState<string | null>(null);
  const [nudged, setNudged] = useState(false);

  const cartItem: Omit<CartItem, "qty"> = { ...item, color };

  /** Blocks the buy actions until a colour is chosen, and says why. */
  const guard = (): boolean => {
    if (!mustChoose || color !== null) return true;
    setNudged(true);
    return false;
  };

  return (
    <div className="space-y-5">
      {mustChoose && (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-label-bold text-[10px] uppercase tracking-widest text-on-surface-variant">
              Colour{" "}
              <span className="text-secondary">*</span>
            </p>
            {color && <p className="text-white text-sm">{color}</p>}
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            {colors.map((c) => {
              const active = color === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setColor(c.name);
                    setNudged(false);
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                    active
                      ? "border-secondary bg-secondary/10 text-white"
                      : "border-white/15 text-on-surface-variant hover:border-white/40 hover:text-white"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 rounded-full border border-white/25"
                    // No hex in the sheet → an empty ring rather than a wrong
                    // colour. The name is always there to read.
                    style={c.hex ? { backgroundColor: c.hex } : undefined}
                  />
                  {c.name}
                </button>
              );
            })}
          </div>

          {nudged && !color && (
            <p role="alert" className="text-error text-xs mt-2">
              Choose a colour before adding this to your cart.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <BuyNowButton item={cartItem} label="Buy Now" guard={guard} />
        <AddToCartButton
          item={cartItem}
          label="Add to Cart"
          guard={guard}
          className="border border-white text-white px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <WishlistButton productId={productId} variant="full" />
      </div>
    </div>
  );
}
