export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import ProductForm from "../ProductForm";
import type { Category, Product } from "@/lib/types";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      .eq("id", id)
      .maybeSingle(),
    admin.from("categories").select("*").order("position"),
  ]);
  if (!product) notFound();
  const p = product as Product;
  p.images = (p.images ?? []).sort((a, b) => a.position - b.position);
  return (
    <div className="p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-8">
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase">Edit Product</h1>
        {/* The sheet is generated from this record on request, so this is
            always what a buyer would get right now — the quickest way to check
            the logo, colours and specs came out right. */}
        <a
          href={`/product/${p.slug}/information`}
          target="_blank"
          rel="noopener"
          className="font-label-bold uppercase text-xs tracking-widest text-secondary hover:underline"
        >
          Preview product sheet (PDF) →
        </a>
      </div>
      <ProductForm product={p} categories={(categories as Category[]) ?? []} />
    </div>
  );
}