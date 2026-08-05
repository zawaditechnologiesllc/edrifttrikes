import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Admin-only maintenance: re-stamp already-uploaded images with a 1-year
 * cache-control (new uploads already get it — see app/admin/actions.ts).
 * Processes ONE small batch per call and returns `nextOffset` when there's more,
 * so it stays well within the Worker's per-request limits; the admin UI loops
 * until `done`. Idempotent — re-running just re-stamps the same objects.
 *
 * GET /api/admin/storage-cache?offset=0
 */
const BUCKET = "product-images";
const CACHE_CONTROL = "31536000"; // 1 year
const BATCH = 6; // keep subrequests/memory well under free-plan limits

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

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin only. Sign in as an admin first." }, { status: 403 });
  }
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Supabase service role not configured on this host." }, { status: 503 });
  }

  const offset = Math.max(0, parseInt(new URL(request.url).searchParams.get("offset") || "0", 10) || 0);
  const admin = createAdminClient();

  const { data: list, error } = await admin.storage
    .from(BUCKET)
    .list("", { limit: BATCH, offset, sortBy: { column: "name", order: "asc" } });
  if (error) {
    return NextResponse.json({ error: `Could not list storage: ${error.message}` }, { status: 502 });
  }

  const entries = list ?? [];
  const files = entries.filter((o) => o.id !== null); // skip folders (id is null)

  let updated = 0;
  const failed: string[] = [];
  for (const f of files) {
    const path = f.name;
    const { data: blob, error: dErr } = await admin.storage.from(BUCKET).download(path);
    if (dErr || !blob) {
      failed.push(`${path}: download ${dErr?.message ?? "no data"}`);
      continue;
    }
    const contentType = blob.type || "image/jpeg";
    const { error: uErr } = await admin.storage
      .from(BUCKET)
      .update(path, blob, { cacheControl: CACHE_CONTROL, contentType, upsert: true });
    if (uErr) {
      failed.push(`${path}: ${uErr.message}`);
      continue;
    }
    updated++;
  }

  // A full page means there may be more; advance by what we listed.
  const more = entries.length === BATCH;
  const nextOffset = offset + entries.length;

  return NextResponse.json({
    ok: failed.length === 0,
    bucket: BUCKET,
    scanned: entries.length,
    updated,
    failed,
    done: !more,
    nextOffset: more ? nextOffset : null,
  });
}
