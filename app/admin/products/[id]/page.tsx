export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import ProductForm from "../ProductForm";
import type { Category, Product } from "@/lib/types";

export default async function EditProduct({ params }: { params: { id: string } }) {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }
  const admin = createAdminClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    admin
      .from("products")
      .select("*, images:product_images(*)")
      .eq("id", params.id)
      .maybeSingle(),
    admin.from("categories").select("*").order("position"),
  ]);
  if (!product) notFound();
  const p = product as Product;
  p.images = (p.images ?? []).sort((a, b) => a.position - b.position);
  return (
    <div className="p-8">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-8">Edit Product</h1>
      <ProductForm product={p} categories={(categories as Category[]) ?? []} />
    </div>
  );
}