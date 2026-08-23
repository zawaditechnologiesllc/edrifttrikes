"use client";

import { useId, useState } from "react";
import AddToCartButton from "@/components/cart/AddToCartButton";
import BuyNowButton from "@/components/cart/BuyNowButton";
import WishlistButton from "@/components/storefront/WishlistButton";
import type { CartItem } from "@/components/cart/CartProvider";
import { defaultColor, type ProductColor } from "@/lib/colors";

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
  const hasColors = colors.length > 0;
  // The first colour is selected from the start. Every unit has a colour
  // whether or not anyone chose one, so the alternative is either blocking
  // checkout to force a pick — which costs sales on a decision most buyers do
  // not care about — or shipping a colour the buyer never saw. Selecting it
  // means the label reads "Colour: Red" from the moment the page loads, it is
  // in the cart line, on the receipt and on the packing slip, and changing it
  // is one click.
  const [color, setColor] = useState<string | null>(defaultColor(colors));
  /** What the pointer (or keyboard focus) is over, which the label shows. */
  const [hovered, setHovered] = useState<string | null>(null);
  const ids = useId();

  // Hover wins while it lasts, then the label falls back to the real choice.
  const preview = hovered ?? color;

  const cartItem: Omit<CartItem, "qty"> = { ...item, color };

  return (
    <div className="space-y-5">
      {hasColors && (
        <div>
          {/*
            THE LABEL FOLLOWS THE POINTER, as it does on Amazon. Reading the
            name of the colour you are hovering — before committing to it — is
            what makes a grid of squares usable; without it a buyer has to click
            one to find out what it is called.
          */}
          <p className="text-sm" id={`${ids}-label`}>
            <span className="text-on-surface-variant">Colour: </span>
            <span className="text-white font-label-bold">{preview}</span>
          </p>

          <div
            role="group"
            aria-labelledby={`${ids}-label`}
            className="flex flex-wrap gap-2.5 mt-2.5"
          >
            {colors.map((c) => {
              const active = color === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={active}
                  onClick={() => setColor(c.name)}
                  onMouseEnter={() => setHovered(c.name)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(c.name)}
                  onBlur={() => setHovered(null)}
                  /*
                    The tile is the BORDER; the swatch sits inside it with a gap.
                    That gap is what makes a selected tile read as selected on
                    Amazon — a ring drawn straight onto the colour just looks
                    like an edge of the colour.
                  */
                  className={`rounded-lg border-2 p-[3px] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                    active
                      ? "border-secondary"
                      : "border-white/15 hover:border-white/50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    /*
                      ring-inset, always: a #101010 swatch on a near-black card
                      is invisible without an edge of its own, and "invisible"
                      reads as "broken button".
                    */
                    className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[5px] ring-1 ring-inset ring-white/20 bg-surface-container-highest"
                    style={c.hex ? { backgroundColor: c.hex } : undefined}
                  >
                    {/* No hex in the product sheet → show the name instead of a
                        blank square or, worse, a guessed colour. */}
                    {!c.hex && (
                      <span className="px-0.5 text-center text-[8px] leading-[1.15] text-on-surface-variant line-clamp-3 break-words">
                        {c.name}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <BuyNowButton item={cartItem} label="Buy Now" />
        <AddToCartButton
          item={cartItem}
          label="Add to Cart"
          className="border border-white text-white px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <WishlistButton productId={productId} variant="full" />
      </div>
    </div>
  );
}
