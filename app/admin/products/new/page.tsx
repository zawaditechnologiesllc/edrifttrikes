export const dynamic = "force-dynamic";

import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import ProductForm from "../ProductForm";
import type { Category } from "@/lib/types";

export default async function NewProduct() {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }
  const admin = createAdminClient();
  const { data: categories } = await admin.from("categories").select("*").order("position");
  return (
    <div className="p-8">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-8">New Product</h1>
      <ProductForm categories={(categories as Category[]) ?? []} />
    </div>
  );
}