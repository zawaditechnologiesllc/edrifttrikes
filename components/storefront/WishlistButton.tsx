import { toggleWishlist } from "@/lib/actions/wishlist";

export default function WishlistButton({
  productId,
  saved,
  redirectTo,
  variant = "icon",
}: {
  productId: string;
  saved: boolean;
  redirectTo?: string;
  variant?: "icon" | "full";
}) {
  return (
    <form action={toggleWishlist}>
      <input type="hidden" name="product_id" value={productId} />
      {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
      {variant === "full" ? (
        <button className="flex items-center gap-2 border border-white/20 text-white px-6 py-4 rounded-lg font-label-bold text-label-bold uppercase tracking-widest hover:border-secondary hover:text-secondary transition-all">
          <span className={`material-symbols-outlined ${saved ? "text-secondary" : ""}`} style={saved ? { fontVariationSettings: '"FILL" 1' } : undefined}>
            favorite
          </span>
          {saved ? "Saved" : "Save"}
        </button>
      ) : (
        <button aria-label={saved ? "Remove from wishlist" : "Save to wishlist"} className="text-on-surface-variant hover:text-secondary transition-colors">
          <span className="material-symbols-outlined" style={saved ? { fontVariationSettings: '"FILL" 1' } : undefined}>favorite</span>
        </button>
      )}
    </form>
  );
}
