"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/login");
  return user;
}

function dollarsToCents(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? "0").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

async function uploadImage(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from("product-images")
    .upload(path, buf, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) return null;
  return admin.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

export async function saveProduct(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const id = String(formData.get("id") || "");
  const file = formData.get("image") as File | null;
  const uploaded = await uploadImage(file);
  const hero = uploaded || String(formData.get("hero_image") || "") || null;

  const row: Record<string, unknown> = {
    slug: String(formData.get("slug") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    tagline: String(formData.get("tagline") || "") || null,
    description: String(formData.get("description") || "") || null,
    price_cents: dollarsToCents(formData.get("price")),
    compare_at_cents: formData.get("compare_at") ? dollarsToCents(formData.get("compare_at")) : null,
    category_id: String(formData.get("category_id") || "") || null,
    power: String(formData.get("power") || "electric"),
    skill_level: String(formData.get("skill_level") || "") || null,
    top_speed: String(formData.get("top_speed") || "") || null,
    range_miles: String(formData.get("range_miles") || "") || null,
    stock: parseInt(String(formData.get("stock") || "0"), 10) || 0,
    status: String(formData.get("status") || "active"),
    is_new: formData.get("is_new") === "on",
    badge: String(formData.get("badge") || "") || null,
    hero_image: hero,
  };

  if (id) await admin.from("products").update(row).eq("id", id);
  else await admin.from("products").insert(row);

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect("/admin/products");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("products").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("orders")
    .update({ status: String(formData.get("status")) })
    .eq("id", String(formData.get("id")));
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${formData.get("id")}`);
}

export async function saveCategory(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const id = String(formData.get("id") || "");
  const row = {
    slug: String(formData.get("slug") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "") || null,
    position: parseInt(String(formData.get("position") || "0"), 10) || 0,
  };
  if (id) await admin.from("categories").update(row).eq("id", id);
  else await admin.from("categories").insert(row);
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("categories").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/categories");
}

export async function saveArticle(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const id = String(formData.get("id") || "");
  const file = formData.get("image") as File | null;
  const uploaded = await uploadImage(file);
  const row = {
    slug: String(formData.get("slug") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    excerpt: String(formData.get("excerpt") || "") || null,
    body: String(formData.get("body") || "") || null,
    category: String(formData.get("category") || "") || null,
    author: String(formData.get("author") || "") || null,
    cover_url: uploaded || String(formData.get("cover_url") || "") || null,
    published: formData.get("published") === "on",
  };
  if (id) await admin.from("articles").update(row).eq("id", id);
  else await admin.from("articles").insert(row);
  revalidatePath("/admin/articles");
  revalidatePath("/tech-lab");
  redirect("/admin/articles");
}

export async function deleteArticle(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("articles").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/articles");
}
