/**
 * One-time maintenance: re-stamp every object in the product-images bucket with
 * a 1-year cache-control. New uploads already get this (see app/admin/actions.ts
 * + ProductForm), but images uploaded earlier still carry Supabase's default
 * 1-hour TTL, which makes the CDN/browser re-download them hourly and burns
 * Storage egress. This downloads each object and re-uploads it (same bytes, same
 * URL) with the long TTL.
 *
 * Run locally (NOT on the Worker):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-storage-cache.mjs
 *
 * Safe to re-run. URLs and DB rows are unchanged (same object paths).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.STORAGE_BUCKET || "product-images";
const CACHE_CONTROL = "31536000"; // 1 year

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function listAll(prefix = "") {
  const paths = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list "${prefix}": ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const p = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders come back with a null id; recurse into them.
      if (item.id === null) paths.push(...(await listAll(p)));
      else paths.push(p);
    }
    if (data.length < 100) break;
    offset += 100;
  }
  return paths;
}

const paths = await listAll();
console.log(`Found ${paths.length} object(s) in "${BUCKET}". Re-stamping cache-control=${CACHE_CONTROL}…`);

let ok = 0;
let fail = 0;
for (const path of paths) {
  const { data: blob, error: dErr } = await supabase.storage.from(BUCKET).download(path);
  if (dErr || !blob) {
    console.error(`✗ download ${path}: ${dErr?.message || "no data"}`);
    fail++;
    continue;
  }
  const contentType = blob.type || "image/jpeg";
  const { error: uErr } = await supabase.storage
    .from(BUCKET)
    .update(path, blob, { cacheControl: CACHE_CONTROL, contentType, upsert: true });
  if (uErr) {
    console.error(`✗ update ${path}: ${uErr.message}`);
    fail++;
    continue;
  }
  console.log(`✓ ${path}`);
  ok++;
}

console.log(`\nDone. Updated ${ok}, failed ${fail}.`);
process.exit(fail > 0 ? 1 : 0);
