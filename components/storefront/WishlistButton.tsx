"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartIcon } from "@/components/Icon";

/**
 * Client-side wishlist toggle. Fetches saved-state after mount so the product
 * page itself can stay statically cached (fast) while the heart is per-user.
 */
export default function WishlistButton({
  productId,
  variant = "icon",
}: {
  productId: string;
  variant?: "icon" | "full";
}) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    fetch(`/api/wishlist?productId=${productId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setSaved(Boolean(d.saved)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [productId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const d = await res.json();
      if (res.ok) setSaved(Boolean(d.saved));
    } finally {
      setBusy(false);
    }
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="flex items-center gap-2 border border-white/20 text-white px-6 py-4 rounded-lg font-label-bold text-label-bold uppercase tracking-widest hover:border-secondary hover:text-secondary transition-all disabled:opacity-60"
      >
        <HeartIcon filled={saved} className={`w-6 h-6 ${saved ? "text-secondary" : ""}`} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={`hover:text-secondary transition-colors disabled:opacity-60 ${saved ? "text-secondary" : "text-on-surface-variant"}`}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}
