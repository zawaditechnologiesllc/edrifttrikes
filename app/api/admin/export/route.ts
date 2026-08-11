import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { supabaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Admin-only FULL CATALOG EXPORT as a single JSON file.
 *
 * Purpose: portability / backup — e.g. rebuilding the store in a fresh Supabase
 * project. Exports every catalog table with ALL columns, verbatim: products
 * (each with its category, gallery images and specs nested in), plus the flat
 * categories / articles / site_settings tables.
 *
 * Image URLs are included exactly as stored so you can see what each product
 * had, but this route reads only TEXT ROWS — it never downloads image bytes, so
 * it costs effectively zero Storage egress (safe to run even while you're over
 * quota). You re-upload the actual image files in the new project, where the
 * admin form auto-optimizes them.
 *
 * GET /api/admin/export  → application/json attachment
 */

async function requireAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return data?.role === "admin";
  } catch {
    return false;
  }
}

type Row = Record<string, unknown>;

/** Select every row from a table; return [] if the table/migration is absent. */
async function safeSelect(admin: ReturnType<typeof createAdminClient>, table: string): Promise<Row[]> {
  const { data, error } = await admin.from(table).select("*");
  if (error) return [];
  return (data as Row[] | null) ?? [];
}

const byNum = (k: string) => (a: Row, b: Row) => Number(a[k] ?? 0) - Number(b[k] ?? 0);
const byStr = (k: string, dir: 1 | -1 = 1) => (a: Row, b: Row) =>
  dir * String(a[k] ?? "").localeCompare(String(b[k] ?? ""));

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin only. Sign in as an admin first." }, { status: 403 });
  }
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Supabase service role not configured on this host." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();

  const [categories, products, images, specs, articles, settingsRows] = await Promise.all([
    safeSelect(admin, "categories"),
    safeSelect(admin, "products"),
    safeSelect(admin, "product_images"),
    safeSelect(admin, "product_specs"),
    safeSelect(admin, "articles"),
    safeSelect(admin, "site_settings"),
  ]);

  // Stable, human-readable ordering.
  categories.sort(byNum("position"));
  images.sort(byNum("position"));
  specs.sort(byNum("position"));
  products.sort(byStr("created_at"));
  articles.sort(byStr("published_at", -1));

  // Index the children so each product carries its own category/images/specs.
  const categoryById = new Map<unknown, Row>(categories.map((c): [unknown, Row] => [c.id, c]));
  const imagesByProduct = new Map<unknown, Row[]>();
  for (const img of images) {
    const arr = imagesByProduct.get(img.product_id);
    if (arr) arr.push(img);
    else imagesByProduct.set(img.product_id, [img]);
  }
  const specsByProduct = new Map<unknown, Row[]>();
  for (const s of specs) {
    const arr = specsByProduct.get(s.product_id);
    if (arr) arr.push(s);
    else specsByProduct.set(s.product_id, [s]);
  }

  const productsFull = products.map((p) => ({
    ...p,
    category: p.category_id != null ? categoryById.get(p.category_id) ?? null : null,
    images: imagesByProduct.get(p.id) ?? [],
    specs: specsByProduct.get(p.id) ?? [],
  }));

  // site_settings is a single row (id = 1); tolerate it being absent.
  const siteSettings = settingsRows.find((r) => r.id === 1) ?? settingsRows[0] ?? null;

  const payload = {
    exported_at: new Date().toISOString(),
    source: { supabase_url: supabaseUrl() ?? null },
    counts: {
      products: products.length,
      categories: categories.length,
      product_images: images.length,
      product_specs: specs.length,
      articles: articles.length,
    },
    categories,
    products: productsFull,
    articles,
    site_settings: siteSettings,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="edrift-catalog-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
