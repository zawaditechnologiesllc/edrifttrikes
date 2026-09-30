import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import AddToCartButton from "@/components/cart/AddToCartButton";

const BADGE_STYLES: Record<string, string> = {
  NEW: "bg-secondary text-on-secondary-fixed",
  SALE: "bg-signal-orange text-black",
  "LOW STOCK": "bg-signal-orange text-black",
  UPGRADE: "bg-primary-container text-white",
};

/**
 * A product card that sizes itself to the COLUMN IT IS IN, not to the window.
 *
 * ═══ WHY CONTAINER QUERIES AND NOT BREAKPOINTS ═════════════════════════════
 *
 * This one component renders in grids of wildly different density: three
 * columns on /shop (cards ~460px wide) and up to six on the homepage (~200px).
 * A media query cannot tell those apart — at 1440px wide the window is the same
 * in both cases, while the card is less than half the size.
 *
 * So the card declares itself a container and scales on its OWN width. Above
 * ~280px it looks exactly as it always has, which is what keeps /shop
 * untouched; below that it progressively drops the parts that cannot survive a
 * 200px column — the spec grid first, then the tagline, then the padding and
 * type come down.
 *
 * WHAT NEVER DROPS: the image, the name, the price and Add to Cart. Those four
 * are the card's whole job, and a cheaper layout is not a reason to make a
 * product unbuyable from the grid.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default function ProductCard({ product }: { product: Product }) {
  const img = product.hero_image || "/assets/placeholder.svg";
  const badge = product.badge || (product.is_new ? "NEW" : null);
  return (
    <div className="@container group bg-white border border-black/10 rounded-lg overflow-hidden flex flex-col hover-lift hover:border-primary-container">
      <Link href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {badge && (
          <span
            className={`absolute top-2 left-2 @[240px]:top-3 @[240px]:left-3 cut-corner-badge font-label-bold text-[9px] @[240px]:text-[10px] uppercase tracking-widest px-2 @[240px]:px-3 py-0.5 @[240px]:py-1 ${
              BADGE_STYLES[badge] ?? "bg-black text-white"
            }`}
          >
            {badge}
          </span>
        )}
        {product.stock <= 0 && (
          <span className="absolute inset-0 bg-white/70 flex items-center justify-center font-headline-md text-sm @[240px]:text-headline-md uppercase text-black/60">
            Sold Out
          </span>
        )}
      </Link>
      <div className="p-3 @[240px]:p-5 flex flex-col flex-1 text-surface-container-lowest">
        <Link href={`/product/${product.slug}`}>
          {/* Clamped to two lines: a four-word product name in a 200px column
              otherwise pushes the price and the button out of alignment with
              every neighbouring card. */}
          <h3 className="font-headline-md text-sm @[240px]:text-xl uppercase leading-tight line-clamp-2 @[280px]:line-clamp-none hover:text-primary-container transition-colors">
            {product.name}
          </h3>
        </Link>
        {/* Gated at 180px, not 200px, on purpose: the six-up desktop card
            measures ~199px, so a 200px gate would decide this on a single
            pixel and flip the moment the gap or the container padding moved.
            The real split is phone two-up (~166px) against everything wider
            (192px and up), and 180px sits clear of both. */}
        <p className="hidden @[180px]:block text-slate-gray text-sm mt-1 line-clamp-1">{product.tagline}</p>

        {/* Two labelled stats side by side need real width — shown only once
            the column can actually hold them. */}
        {(product.top_speed || product.range_miles) && (
          <div className="hidden @[280px]:grid grid-cols-2 gap-2 my-4">
            {product.top_speed && (
              <div className="border-l-2 border-secondary pl-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-gray font-label-bold">Top Speed</p>
                <p className="font-label-bold">{product.top_speed}</p>
              </div>
            )}
            {product.range_miles && (
              <div className="border-l-2 border-secondary pl-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-gray font-label-bold">Range</p>
                <p className="font-label-bold">{product.range_miles}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 @[240px]:pt-4">
          <div>
            <span className="text-primary-container font-headline-md text-base @[240px]:text-xl">
              {formatMoney(product.price_cents)}
            </span>
            {product.compare_at_cents && (
              <span className="text-slate-gray line-through text-xs @[240px]:text-sm ml-1 @[240px]:ml-2">
                {formatMoney(product.compare_at_cents)}
              </span>
            )}
          </div>
          {product.free_shipping && (
            <span className="hidden @[280px]:inline-block font-label-bold text-[10px] uppercase tracking-widest text-primary-container border border-primary-container/40 rounded px-2 py-1">
              Free shipping
            </span>
          )}
        </div>
        <AddToCartButton
          item={{
            productId: product.id,
            slug: product.slug,
            name: product.name,
            priceCents: product.price_cents,
            imageUrl: product.hero_image,
            stock: product.stock,
            shippingCents: product.shipping_cents ?? null,
            freeShipping: Boolean(product.free_shipping),
          }}
          className="mt-3 @[240px]:mt-4 w-full bg-surface-container-lowest text-white py-2 @[240px]:py-3 font-label-bold text-[10px] @[240px]:text-label-bold uppercase tracking-wider @[240px]:tracking-widest rounded hover:bg-primary-container active:scale-95 transition-all disabled:opacity-40"
          label="Add to Cart"
        />
      </div>
    </div>
  );
}
