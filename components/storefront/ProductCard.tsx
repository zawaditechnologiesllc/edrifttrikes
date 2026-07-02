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

export default function ProductCard({ product }: { product: Product }) {
  const img = product.hero_image || "/assets/placeholder.svg";
  const badge = product.badge || (product.is_new ? "NEW" : null);
  return (
    <div className="group bg-white border border-black/10 rounded-lg overflow-hidden flex flex-col hover-lift hover:border-primary-container">
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
            className={`absolute top-3 left-3 cut-corner-badge font-label-bold text-[10px] uppercase tracking-widest px-3 py-1 ${
              BADGE_STYLES[badge] ?? "bg-black text-white"
            }`}
          >
            {badge}
          </span>
        )}
        {product.stock <= 0 && (
          <span className="absolute inset-0 bg-white/70 flex items-center justify-center font-headline-md text-headline-md uppercase text-black/60">
            Sold Out
          </span>
        )}
      </Link>
      <div className="p-5 flex flex-col flex-1 text-surface-container-lowest">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-headline-md text-xl uppercase leading-tight hover:text-primary-container transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-slate-gray text-sm mt-1 line-clamp-1">{product.tagline}</p>

        {(product.top_speed || product.range_miles) && (
          <div className="grid grid-cols-2 gap-2 my-4">
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

        <div className="mt-auto flex items-center justify-between pt-4">
          <div>
            <span className="text-primary-container font-headline-md text-xl">
              {formatMoney(product.price_cents)}
            </span>
            {product.compare_at_cents && (
              <span className="text-slate-gray line-through text-sm ml-2">
                {formatMoney(product.compare_at_cents)}
              </span>
            )}
          </div>
        </div>
        <AddToCartButton
          item={{
            productId: product.id,
            slug: product.slug,
            name: product.name,
            priceCents: product.price_cents,
            imageUrl: product.hero_image,
            stock: product.stock,
          }}
          className="mt-4 w-full bg-surface-container-lowest text-white py-3 font-label-bold text-label-bold uppercase tracking-widest rounded hover:bg-primary-container active:scale-95 transition-all disabled:opacity-40"
          label="Add to Cart"
        />
      </div>
    </div>
  );
}
