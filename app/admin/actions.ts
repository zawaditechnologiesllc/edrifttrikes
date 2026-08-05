"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { CATALOG_TAG, CONTENT_TAG, SETTINGS_TAG } from "@/lib/db";

async function requireAdmin() {
  if (!adminConfigured()) redirect("/login");
  const supabase = await createClient();
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

// Only ever store real image files, with a safe, whitelisted extension. This
// is the last line of defence against a non-image (e.g. an HTML/SVG payload)
// being uploaded and later served from our storage origin.
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB

// Cache uploaded images for a year. Filenames are random UUIDs, so an object is
// immutable — a new image is always a new URL. Supabase Storage defaults to
// only 1 hour (`cache-control: max-age=3600`), which makes the CDN and browsers
// re-download every image hourly and inflates Storage egress. A long max-age
// means repeat views are served from browser/CDN cache instead of re-fetched.
const IMAGE_CACHE_CONTROL = "31536000"; // seconds = 1 year

/** Whitelist the extension, falling back to jpg when it's unknown/unsafe. */
function safeImageExt(name: string): string {
  const ext = (String(name).split(".").pop() || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);
  return IMAGE_EXTS.has(ext) ? ext : "jpg";
}

/** True when the browser-declared content type is an image (or absent). */
function isImageType(type: string): boolean {
  return !type || type.startsWith("image/");
}

async function uploadImage(
  file: File | null
): Promise<{ url: string | null; error?: string }> {
  if (!file || file.size === 0) return { url: null };
  if (file.size > MAX_IMAGE_BYTES) {
    return { url: null, error: "Image is too large (max 15 MB)." };
  }
  if (!isImageType(file.type)) {
    return { url: null, error: "Only image files can be uploaded." };
  }
  const admin = createAdminClient();
  const ext = safeImageExt(file.name);
  const path = `${crypto.randomUUID()}.${ext}`;
  // Force an image content type so a mislabeled file can't be served as HTML.
  const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
  // Pass the File straight through — no Buffer copy. On Workers that halves
  // the memory footprint and CPU cost of a multi-MB upload.
  const { error } = await admin.storage
    .from("product-images")
    .upload(path, file, { contentType, upsert: false, cacheControl: IMAGE_CACHE_CONTROL });
  if (error) return { url: null, error: error.message };
  return { url: admin.storage.from("product-images").getPublicUrl(path).data.publicUrl };
}

export type ProductSaveState = { ok?: boolean; error?: string };

/**
 * Issue signed upload URLs so the browser uploads image bytes STRAIGHT to
 * Supabase Storage. Routing multi-MB files through the server action was the
 * cause of hung saves: on the Workers free plan, parsing a large multipart
 * body can exceed the CPU budget and the request dies without a response.
 * With this, the action only ever receives small text fields.
 */
export async function createUploadUrls(
  files: { name: string; type: string }[]
): Promise<{ urls: { path: string; token: string; publicUrl: string }[] } | { error: string }> {
  await requireAdmin();
  if (!Array.isArray(files) || files.length === 0 || files.length > 12) {
    return { error: "Between 1 and 12 images per save." };
  }
  // Reject anything the browser doesn't declare as an image before we hand out
  // an upload token for it.
  if (files.some((f) => !isImageType(String(f.type || "")))) {
    return { error: "Only image files can be uploaded." };
  }
  const admin = createAdminClient();
  const urls: { path: string; token: string; publicUrl: string }[] = [];
  for (const f of files) {
    const ext = safeImageExt(String(f.name));
    const path = `${crypto.randomUUID()}.${ext}`;
    const { data, error } = await admin.storage
      .from("product-images")
      .createSignedUploadUrl(path);
    if (error || !data) {
      return { error: `Could not authorize the upload: ${error?.message ?? "unknown error"}` };
    }
    urls.push({
      path,
      token: data.token,
      publicUrl: admin.storage.from("product-images").getPublicUrl(path).data.publicUrl,
    });
  }
  return { urls };
}

export async function saveProduct(
  _prev: ProductSaveState,
  formData: FormData
): Promise<ProductSaveState> {
  await requireAdmin();
  const admin = createAdminClient();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  if (!name || !slug) return { error: "Name and slug are required." };

  // Preferred path: the browser already uploaded the image straight to
  // Storage and passes only the resulting URL. The File branch remains as a
  // fallback for small images if the direct upload was unavailable.
  const heroDirect = String(formData.get("hero_uploaded_url") || "");
  const file = formData.get("image") as File | null;
  const heroUpload = heroDirect ? { url: null } : await uploadImage(file);
  if (heroUpload.error) {
    return { error: `Hero image upload failed: ${heroUpload.error}` };
  }
  const hero =
    heroDirect || heroUpload.url || String(formData.get("hero_image") || "") || null;

  const row: Record<string, unknown> = {
    slug,
    name,
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
    featured: formData.get("featured") === "on",
    shipping_cents: formData.get("shipping_fee")
      ? dollarsToCents(formData.get("shipping_fee"))
      : null,
    free_shipping: formData.get("free_shipping") === "on",
    badge: String(formData.get("badge") || "") || null,
    hero_image: hero,
  };

  // Columns added by later migrations (0003/0005) — stripped and retried if
  // the database hasn't run them yet, so the rest of the product still saves.
  // When that happens the admin gets an explicit warning below: silently
  // dropping the shipping fee looked like the fee being "ignored".
  const optionalColumns = ["featured", "shipping_cents", "free_shipping"];
  const stripOptional = () => optionalColumns.forEach((c) => delete row[c]);
  const MISSING_MIGRATIONS_WARNING =
    "Product saved, BUT the featured/shipping settings were NOT stored — your database is missing a migration. Run supabase/migrations/0003_featured_site_settings.sql and 0005_product_shipping.sql in the Supabase SQL Editor (Admin → System shows which are missing), then edit and save this product again.";
  let strippedOptional = false;

  let productId = id;
  if (id) {
    let { error } = await admin.from("products").update(row).eq("id", id);
    if (error && "featured" in row) {
      stripOptional();
      ({ error } = await admin.from("products").update(row).eq("id", id));
      strippedOptional = !error;
    }
    if (error) return { error: `Could not save: ${error.message}` };
  } else {
    let { data: created, error } = await admin.from("products").insert(row).select("id").single();
    if (error && "featured" in row) {
      stripOptional();
      ({ data: created, error } = await admin.from("products").insert(row).select("id").single());
      strippedOptional = !error;
    }
    if (error) return { error: `Could not save: ${error.message}` };
    productId = created?.id ?? "";
  }

  // Gallery images (product_images): remove ticked ones, then append uploads.
  const galleryFailures: string[] = [];
  if (productId) {
    const removeIds = formData.getAll("remove_image").map(String).filter(Boolean);
    if (removeIds.length) {
      await admin.from("product_images").delete().in("id", removeIds);
    }

    // Direct-uploaded gallery URLs (browser → Storage), plus any Files that
    // came through the fallback path.
    let galleryDirect: string[] = [];
    try {
      const raw = JSON.parse(String(formData.get("gallery_uploaded_urls") || "[]"));
      if (Array.isArray(raw)) galleryDirect = raw.filter((u) => typeof u === "string").slice(0, 20);
    } catch {
      /* no direct gallery uploads */
    }
    const galleryFiles = formData
      .getAll("gallery")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (galleryDirect.length || galleryFiles.length) {
      const { data: last } = await admin
        .from("product_images")
        .select("position")
        .eq("product_id", productId)
        .order("position", { ascending: false })
        .limit(1);
      let pos = last && last.length ? (last[0].position ?? 0) + 1 : 0;

      const newRows: { product_id: string; url: string; alt: string; position: number }[] = [];
      for (const url of galleryDirect) {
        newRows.push({ product_id: productId, url, alt: name, position: pos++ });
      }
      for (const file of galleryFiles) {
        const { url, error } = await uploadImage(file);
        if (url) newRows.push({ product_id: productId, url, alt: name, position: pos++ });
        else if (error) galleryFailures.push(`${file.name}: ${error}`);
      }
      if (newRows.length) await admin.from("product_images").insert(newRows);
    }
  }

  revalidateTag(CATALOG_TAG);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  if (productId && slug) revalidatePath(`/product/${slug}`);

  if (strippedOptional) {
    return { error: MISSING_MIGRATIONS_WARNING };
  }
  if (galleryFailures.length) {
    // The product itself saved — tell the admin which gallery images to retry.
    return {
      error: `Product saved, but some gallery images failed to upload — edit the product to retry them. ${galleryFailures.join("; ")}`,
    };
  }
  // No redirect here — the form navigates client-side on ok, so a hung
  // navigation can never masquerade as a hung save.
  return { ok: true };
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("products").delete().eq("id", String(formData.get("id")));
  revalidateTag(CATALOG_TAG);
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
  revalidateTag(CATALOG_TAG);
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("categories").delete().eq("id", String(formData.get("id")));
  revalidateTag(CATALOG_TAG);
  revalidatePath("/admin/categories");
  revalidatePath("/shop");
}

export async function saveArticle(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const id = String(formData.get("id") || "");
  const file = formData.get("image") as File | null;
  const uploaded = (await uploadImage(file)).url;
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
  revalidateTag(CONTENT_TAG);
  revalidatePath("/admin/articles");
  revalidatePath("/tech-lab");
  redirect("/admin/articles");
}

export async function deleteArticle(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("articles").delete().eq("id", String(formData.get("id")));
  revalidateTag(CONTENT_TAG);
  revalidatePath("/admin/articles");
  revalidatePath("/tech-lab");
}

export type SettingsState = { ok?: boolean; error?: string };

/** Save the footer contact info (site_settings row, always id = 1). */
export async function saveSiteSettings(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  await requireAdmin();
  const admin = createAdminClient();
  const trimmed = (name: string) => String(formData.get(name) || "").trim() || null;
  const row: Record<string, unknown> = {
    id: 1,
    company_email: trimmed("company_email"),
    company_phone: trimmed("company_phone"),
    address_line1: trimmed("address_line1"),
    address_line2: trimmed("address_line2"),
    shipping_cents: dollarsToCents(formData.get("shipping_fee")),
    free_shipping: formData.get("free_shipping") === "on",
    updated_at: new Date().toISOString(),
  };
  let { error } = await admin.from("site_settings").upsert(row, { onConflict: "id" });
  // Migration 0004 not run yet → shipping columns don't exist. Save the rest
  // and tell the admin what to run.
  if (error && "shipping_cents" in row) {
    delete row.shipping_cents;
    delete row.free_shipping;
    ({ error } = await admin.from("site_settings").upsert(row, { onConflict: "id" }));
    if (!error) {
      revalidateTag(SETTINGS_TAG);
      return {
        error:
          "Contact info saved, but shipping settings need migration supabase/migrations/0004_shipping_and_articles.sql — run it in the Supabase SQL Editor, then save again.",
      };
    }
  }
  if (error) {
    return {
      error:
        "Could not save. If this is a fresh database, run the SQL files in supabase/migrations (0003 and 0004) first.",
    };
  }
  revalidateTag(SETTINGS_TAG);
  return { ok: true };
}
