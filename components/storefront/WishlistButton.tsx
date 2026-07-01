import { toggleWishlist } from "@/lib/actions/wishlist";
import { HeartIcon } from "@/components/Icon";

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
          <HeartIcon filled={saved} className={`w-6 h-6 ${saved ? "text-secondary" : ""}`} />
          {saved ? "Saved" : "Save"}
        </button>
      ) : (
        <button aria-label={saved ? "Remove from wishlist" : "Save to wishlist"} className={`hover:text-secondary transition-colors ${saved ? "text-secondary" : "text-on-surface-variant"}`}>
          <HeartIcon filled={saved} />
        </button>
      )}
    </form>
  );
}
