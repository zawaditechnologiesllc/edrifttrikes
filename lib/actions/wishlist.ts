"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleWishlist(formData: FormData) {
  const productId = String(formData.get("product_id") || "");
  if (!productId) return;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
  } else {
    await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: productId });
  }

  revalidatePath("/wishlist");
  const back = String(formData.get("redirect") || "");
  if (back) revalidatePath(back);
}
