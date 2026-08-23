"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { ANNOUNCEMENTS_TAG, CATALOG_TAG, CONTENT_TAG, SETTINGS_TAG } from "@/lib/db";
import {
  markOrderPaid,
  setOrderStage,
  ensureCustomerAccountLink,
  loadOrder,
  syncProductColors,
} from "@/lib/orders";
import { sendAccountInviteEmail, sendRefundEmail, resendFailureHint } from "@/lib/email";
import { publicSiteUrl } from "@/lib/env";
import { ALL_STAGES, type FulfillmentStage } from "@/lib/fulfillment";
import { looksInternal, trackingUrlFor } from "@/lib/couriers";
import { DEFAULT_TAX_RATE_BPS } from "@/lib/totals";
import { parseColors } from "@/lib/colors";
import { normalizeHref, normalizeMessage } from "@/lib/announcements";

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

/**
 * Percent input → basis points ("8.25" → 825), which is how the tax rate is
 * stored so the charged amount stays exact integer math.
 * Clamped to 0–50%, matching the database CHECK constraint.
 */
function percentToBps(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return DEFAULT_TAX_RATE_BPS;
  return Math.max(0, Math.min(5000, Math.round(n * 100)));
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
    // Parsed on the way in so the stored shape is always canonical, whatever
    // the admin typed or the .txt import produced.
    colors: parseColors(String(formData.get("colors") || "")),
  };

  // Columns added by later migrations (0003/0005) — stripped and retried if
  // the database hasn't run them yet, so the rest of the product still saves.
  // When that happens the admin gets an explicit warning below: silently
  // dropping the shipping fee looked like the fee being "ignored".
  const optionalColumns = ["featured", "shipping_cents", "free_shipping", "colors"];
  const stripOptional = () => optionalColumns.forEach((c) => delete row[c]);
  const MISSING_MIGRATIONS_WARNING =
    "Product saved, BUT the featured/shipping/colour settings were NOT stored — your database is missing a migration. Run supabase/migrations/0003_featured_site_settings.sql, 0005_product_shipping.sql and 0012_product_colors.sql in the Supabase SQL Editor (Admin → System shows which are missing), then edit and save this product again.";
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

/**
 * Whether this save should email the customer.
 *
 * The form pairs the checkbox with a hidden "off" input, because an unchecked
 * checkbox submits NOTHING at all — so the presence of any value is what
 * distinguishes "the admin opted out" from "this form has no such control"
 * (the compact status dropdown in the orders table doesn't). Absent the control
 * entirely, the customer hears: an admin changing an order's state expects that.
 */
function wantsNotify(formData: FormData): boolean {
  const values = formData.getAll("notify");
  return values.length === 0 || values.includes("on");
}

export type ColorRefreshState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Products with no colours anywhere, so the owner knows what to go and fix. */
  missing?: string[];
};

/**
 * Re-read every product's colours out of the description text the admin
 * uploaded, and write them onto the row.
 *
 * The nightly sweep already does this a few at a time, which is right for a
 * background job and useless when someone has just uploaded twenty product
 * sheets and wants the swatches to appear NOW. This runs the same function
 * across the whole catalogue in one go and reports what it found.
 *
 * NON-DESTRUCTIVE: a product that already has colours is counted and skipped,
 * never overwritten. An admin's hand-edited list survives any number of runs.
 */
export async function refreshProductColors(): Promise<ColorRefreshState> {
  await requireAdmin();
  if (!adminConfigured()) {
    return { error: "Connect Supabase (URL + service role key) first." };
  }

  const admin = createAdminClient();
  let result;
  try {
    // No write cap: this is the deliberate "do the lot" path.
    result = await syncProductColors(admin, { limit: Infinity });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin] colour refresh failed", e);
    return { error: `Could not refresh colours: ${message}` };
  }

  // ALWAYS, not only when something changed. A run that found nothing still
  // has to leave the admin looking at fresh data — an owner who presses the
  // button and sees the old screen concludes it did nothing, whatever the
  // message underneath says.
  revalidateTag(CATALOG_TAG);
  // "layout" so the product EDIT pages refresh too, not just the list: the
  // colour field on those is what the owner opens next to check the result.
  revalidatePath("/admin/products", "layout");
  revalidatePath("/shop");

  const parts = [
    `${result.updated} product${result.updated === 1 ? "" : "s"} filled in`,
    `${result.alreadyHad} already had colours`,
  ];
  if (result.missing.length > 0) {
    parts.push(
      `${result.missing.length} still ha${result.missing.length === 1 ? "s" : "ve"} none`
    );
  }

  return { ok: true, message: `${parts.join(", ")}.`, missing: result.missing };
}

export type OrderUpdateState = { ok?: boolean; error?: string; message?: string };

/** The order_status enum in the database — anything else is rejected. */
const ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Update an order's status, delivery stage and tracking details.
 *
 * Returns state instead of silently swallowing failures — the previous version
 * discarded the Supabase error and rendered nothing, so a rejected write looked
 * exactly like a successful one and the control appeared to "do nothing".
 *
 * Setting the status to `paid` runs the SAME transition the payment webhooks do
 * (markOrderPaid): it stamps paid_at, starts the delivery schedule and sends the
 * shipping confirmation. An order marked paid by hand is therefore tracked
 * exactly like one paid through Stripe or PayPal.
 */
export async function updateOrderStatus(
  _prev: OrderUpdateState,
  formData: FormData
): Promise<OrderUpdateState> {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  if (!id) return { error: "Missing order id." };

  const status = String(formData.get("status") || "").trim() as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) {
    return { error: `"${status}" is not a valid order status.` };
  }

  const admin = createAdminClient();
  const notes: string[] = [];

  // --- status -------------------------------------------------------------
  const { data: current, error: readErr } = await admin
    .from("orders")
    .select("id, status, fulfillment_stage, order_number, tracking_number, courier")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { error: `Could not read the order: ${readErr.message}` };
  if (!current) return { error: "Order not found." };

  if (current.status !== status) {
    if (status === "paid") {
      // Route through the shared transition so the customer journey starts.
      const paid = await markOrderPaid(
        admin,
        { id },
        { paidVia: "manual", sendEmail: wantsNotify(formData), force: true }
      );
      if (!paid.ok) {
        return { error: `Could not mark paid: ${paid.reason ?? "unknown error"}` };
      }
      notes.push(
        paid.transitioned
          ? "marked paid — shipping confirmation sent"
          : "marked paid (confirmation already sent earlier)"
      );
    } else {
      const { error } = await admin.from("orders").update({ status }).eq("id", id);
      if (error) return { error: `Could not update status: ${error.message}` };
      notes.push(`status → ${status}`);

      // Closing an order stops the scheduler from marching it through the
      // delivery stages and emailing a customer about a package that isn't
      // coming.
      if (status === "cancelled" || status === "refunded") {
        await admin
          .from("orders")
          .update({ fulfillment_stage: "cancelled", stage_updated_at: new Date().toISOString() })
          .eq("id", id);

        // A refund is money leaving the customer's order without them doing
        // anything, so they hear about it. Marking an order refunded used to
        // send nothing at all — the customer's first sign was a credit
        // appearing (or not appearing) on their statement days later.
        if (status === "refunded" && wantsNotify(formData)) {
          const order = await loadOrder(admin, { id });
          if (order?.email) {
            try {
              await sendRefundEmail(order);
              notes.push(`refund notice emailed to ${order.email}`);
            } catch (e) {
              // The status change is already committed and correct; a failed
              // email must not roll it back or look like the refund failed.
              const message = e instanceof Error ? e.message : String(e);
              console.error("[admin] refund email failed", e);
              notes.push(
                `status saved, BUT the refund email did not send: ${message}. ${
                  resendFailureHint(message) ?? "Tell the customer directly."
                }`
              );
            }
          } else {
            notes.push("status saved — no email on this order, so nothing was sent");
          }
        }
      } else if (status === "fulfilled") {
        await admin
          .from("orders")
          .update({ fulfillment_stage: "delivered", stage_updated_at: new Date().toISOString() })
          .eq("id", id);
      }
    }
  }

  // --- tracking details ----------------------------------------------------
  // Written before any stage email so the email carries the tracking number.
  const tracking = String(formData.get("tracking_number") || "").trim().slice(0, 120);
  const courier = String(formData.get("courier") || "").trim().slice(0, 80);
  if (formData.has("tracking_number") || formData.has("courier")) {
    const next = { tracking_number: tracking || null, courier: courier || null };
    const changed =
      next.tracking_number !== (current.tracking_number ?? null) ||
      next.courier !== (current.courier ?? null);
    if (changed) {
      const { error } = await admin.from("orders").update(next).eq("id", id);
      if (error) return { error: `Could not save tracking details: ${error.message}` };

      // SAY SO. Saving a tracking number on its own used to leave `notes`
      // empty, so the form reported "No changes to save." over a write that
      // had just succeeded — indistinguishable from the control being broken.
      if (next.tracking_number !== (current.tracking_number ?? null)) {
        notes.push(
          next.tracking_number
            ? `tracking → ${next.tracking_number}`
            : "tracking number cleared"
        );
      }
      if (next.courier !== (current.courier ?? null)) {
        notes.push(next.courier ? `courier → ${next.courier}` : "courier cleared");
      }
      // Whether the customer gets a link or a bare string is the difference
      // between the number being useful and being homework, so it is worth
      // one line of feedback.
      const link = trackingUrlFor(next.courier, next.tracking_number);
      if (next.tracking_number && !link) {
        notes.push(
          looksInternal(next.tracking_number)
            ? "our own reference, so the customer gets it as plain text"
            : "no tracking page for that courier, so the customer gets plain text"
        );
      }
    }
  }

  // --- delivery stage ------------------------------------------------------
  const stage = String(formData.get("stage") || "").trim() as FulfillmentStage;
  if (stage && stage !== current.fulfillment_stage) {
    if (!ALL_STAGES.includes(stage)) {
      return { error: `"${stage}" is not a valid delivery stage.` };
    }
    // Unchecking "email the customer" lets an admin correct a mistaken stage
    // silently.
    const moved = await setOrderStage(admin, id, stage, {
      sendEmail: wantsNotify(formData),
    });
    if (!moved.ok) return { error: `Could not update stage: ${moved.error}` };
    notes.push(
      moved.emailed ? `stage → ${stage} (customer emailed)` : `stage → ${stage}`
    );
    if (moved.warning) notes.push(moved.warning);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);

  return {
    ok: true,
    message: notes.length ? `Saved: ${notes.join(", ")}.` : "No changes to save.",
  };
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
    tax_rate_bps: percentToBps(formData.get("tax_rate")),
    updated_at: new Date().toISOString(),
  };

  // The logo column is only included when the admin actually changed it —
  // PostgREST's upsert updates exactly the columns present in the payload, so
  // leaving it out keeps the stored logo instead of clearing it on every save.
  const logoResult = await resolveLogo(formData);
  if ("error" in logoResult) return { error: logoResult.error };
  if (logoResult.changed) row.logo_url = logoResult.url;

  let { error } = await admin.from("site_settings").upsert(row, { onConflict: "id" });
  // Columns added by later migrations (0004 shipping/tax, 0013 logo). If the
  // database hasn't run them, save what it does have and name the file to run —
  // silently dropping a setting looks like the setting being ignored.
  if (error && "shipping_cents" in row) {
    delete row.shipping_cents;
    delete row.free_shipping;
    delete row.tax_rate_bps;
    delete row.logo_url;
    ({ error } = await admin.from("site_settings").upsert(row, { onConflict: "id" }));
    if (!error) {
      revalidateTag(SETTINGS_TAG);
      return {
        error:
          "Contact info saved, but the shipping, tax and logo settings need migrations supabase/migrations/0004_shipping_and_articles.sql, 0006_fulfillment_tracking.sql and 0013_store_logo.sql — run them in the Supabase SQL Editor, then save again.",
      };
    }
  }
  if (error) {
    return {
      error:
        "Could not save. If this is a fresh database, run the SQL files in supabase/migrations (0003, 0004, 0006 and 0013) first.",
    };
  }
  revalidateTag(SETTINGS_TAG);
  return { ok: true };
}

// PDF can embed exactly these two raster formats. The admin's browser converts
// anything else to PNG before upload (see logoToPng in lib/image-compress.ts);
// this is what catches the cases where it couldn't.
const PDF_EMBEDDABLE_TYPES = new Set(["image/png", "image/jpeg"]);

/**
 * Work out what should happen to the store logo on this save: cleared, replaced
 * with a freshly uploaded file, or left exactly as it is.
 */
async function resolveLogo(
  formData: FormData
): Promise<{ changed: boolean; url: string | null } | { error: string }> {
  if (formData.get("remove_logo") === "on") return { changed: true, url: null };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { changed: false, url: null };

  if (!PDF_EMBEDDABLE_TYPES.has(file.type)) {
    return {
      error:
        "The logo must be a PNG or a JPEG — those are the only image formats a PDF can embed. Your browser normally converts the file for you; if it couldn't, export the logo as a PNG (which keeps a transparent background) and upload that.",
    };
  }

  const { url, error } = await uploadImage(file);
  if (error || !url) {
    return { error: `Could not upload the logo: ${error ?? "the upload returned nothing"}` };
  }
  return { changed: true, url };
}


export type InviteState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Shown to the admin only when the email could not be sent. */
  actionLink?: string;
};

/**
 * Connect a guest order to a customer account.
 *
 * Two outcomes, decided by whether an account already exists for the order's
 * email:
 *
 *  - ACCOUNT EXISTS → link the order to it immediately. There is nothing to
 *    invite them to, and emailing a sign-up link to someone who already has an
 *    account is confusing.
 *  - NO ACCOUNT → generate a Supabase invite link and email it. Following it
 *    signs them in and confirms the address, which is precisely what lets the
 *    order attach itself (claimGuestOrders / migration 0010). We never create
 *    a password on their behalf.
 *
 * The order is NOT modified in the invite case. It stays a guest order until
 * the customer actually accepts, so an unaccepted invite leaves no trace of a
 * relationship that doesn't exist yet.
 */
export async function inviteOrderCustomer(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  if (!id) return { error: "Missing order id." };

  const admin = createAdminClient();
  const { data: order, error: readErr } = await admin
    .from("orders")
    .select("id, email, user_id, order_number")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { error: `Could not read the order: ${readErr.message}` };
  if (!order) return { error: "Order not found." };
  if (order.user_id) return { ok: true, message: "This order is already linked to an account." };

  const email = String(order.email || "").trim().toLowerCase();
  if (!email) return { error: "This order has no email address to invite." };

  // Same path the payment flow uses, so the button and the automatic link can
  // never behave differently.
  const result = await ensureCustomerAccountLink(
    admin,
    { id: order.id as string, email, user_id: null },
    publicSiteUrl() || ""
  );

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);

  if (result.linked) {
    return {
      ok: true,
      message: `${email} already has an account — the order is linked and on their dashboard now.`,
    };
  }

  if (!result.inviteLink) {
    return { error: `Could not create the invite: ${result.reason ?? "unknown error"}` };
  }

  try {
    await sendAccountInviteEmail({
      to: email,
      orderNumber: String(order.order_number),
      actionLink: result.inviteLink,
    });
  } catch (e) {
    // The link is valid even though the email failed, so hand it to the admin
    // rather than losing it — they can pass it on however they like.
    return {
      ok: true,
      message: `Invite created for ${email}, but the email could not be sent (${String(
        (e as Error)?.message || e
      )}). Send them this link yourself:`,
      actionLink: result.inviteLink,
    };
  }

  revalidatePath(`/admin/orders/${id}`);
  return {
    ok: true,
    message: `Invite sent to ${email}. Once they set up their account, this order and all its updates appear on their dashboard.`,
  };
}
// ---------------------------------------------------------------------------
// Announcements — the scrolling stripe at the top of the storefront
// ---------------------------------------------------------------------------

export type AnnouncementState = { ok?: boolean; error?: string };

/**
 * A datetime-local input gives "2026-08-20T17:30" with NO timezone, which the
 * browser means in the ADMIN'S local time. Interpreting that as UTC would fire
 * a sale banner hours early or late, so it is parsed in the local zone (which
 * `new Date()` does for that format) and stored as a proper instant.
 */
function localDateTimeToIso(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Create or update one announcement. */
export async function saveAnnouncement(
  _prev: AnnouncementState,
  formData: FormData
): Promise<AnnouncementState> {
  await requireAdmin();
  const admin = createAdminClient();

  const message = normalizeMessage(formData.get("message") as string);
  if (!message) return { error: "Write the message that should scroll across the stripe." };

  // An unusable link is worth saying out loud rather than silently dropping:
  // an admin who typed one expects it to work.
  const rawHref = String(formData.get("href") || "").trim();
  const href = normalizeHref(rawHref);
  if (rawHref && !href) {
    return {
      error:
        "That link can't be used. Enter a path on this site (like /shop) or a full https:// address.",
    };
  }

  const starts_at = localDateTimeToIso(formData.get("starts_at"));
  const ends_at = localDateTimeToIso(formData.get("ends_at"));
  if (starts_at && ends_at && ends_at <= starts_at) {
    return { error: "The end time has to be after the start time." };
  }

  const row = {
    message,
    href,
    active: formData.get("active") === "on",
    starts_at,
    ends_at,
    position: Math.max(0, Math.min(999, Number(formData.get("position") || 0) || 0)),
    updated_at: new Date().toISOString(),
  };

  const id = String(formData.get("id") || "").trim();
  const { error } = id
    ? await admin.from("announcements").update(row).eq("id", id)
    : await admin.from("announcements").insert(row);

  if (error) {
    return {
      error: `Could not save: ${error.message}. If this is a fresh database, run supabase/migrations/0014_announcements.sql first.`,
    };
  }

  revalidateAnnouncements();
  return { ok: true };
}

export async function deleteAnnouncement(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("announcements").delete().eq("id", String(formData.get("id")));
  revalidateAnnouncements();
}

/** Flip one announcement on or off without opening the editor. */
export async function toggleAnnouncement(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("announcements")
    .update({ active: formData.get("active") === "on", updated_at: new Date().toISOString() })
    .eq("id", String(formData.get("id")));
  revalidateAnnouncements();
}

/**
 * The stripe renders on EVERY storefront page, so a change has to reach the
 * cached page shells as well as the announcements read itself.
 */
function revalidateAnnouncements() {
  revalidateTag(ANNOUNCEMENTS_TAG);
  revalidatePath("/admin/announcements");
  revalidatePath("/", "layout");
}
