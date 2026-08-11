# Moving to a fresh Supabase project (without egress problems)

This guide covers rebuilding the store on a **new Supabase project** — e.g. to
escape a project that has blown its free-tier **egress** quota — and, more
importantly, making sure the new project **stays** under the limit.

> **Read this first — the one fact that decides everything:**
> Free-tier egress (and storage, MAU, …) is metered **per Supabase
> _organization_, not per project.** A new *project* inside the **same** org
> draws on the same, already-spent 5 GB allowance. To get a fresh allowance you
> must create a **new organization**. Spinning up orgs to dodge limits runs
> against Supabase's fair-use policy, and it's a treadmill — so treat this as a
> reset you only get to use *once*, paired with the egress fixes below. The
> durable version of the same thing is Supabase **Pro** (~$25/mo, 250 GB egress).

There is **no way to "reset" or "refresh" cached egress** — it's a cumulative
usage meter, not a cache. It only returns to zero at the start of the billing
cycle, or on a brand-new organization.

---

## Why the new project won't repeat the problem

Egress = **bytes served × views**. Two things now hold both factors down, and
both are automatic:

1. **Images are auto-optimized on upload** — resized to ~1600px and re-encoded
   as WebP in the browser before they reach Storage. A 3–8 MB phone photo is
   stored as a ~150–400 KB WebP.
   → `lib/image-compress.ts` (used by the product form + article cover input)
2. **Images cache for 1 year** (`cache-control: max-age=31536000`) with
   immutable UUID filenames, so repeat views come from the browser/CDN cache
   instead of re-fetching from Storage.
   → `IMAGE_CACHE_CONTROL` in `app/admin/actions.ts`

Together these typically cut image egress ~90%. As a rule of thumb, a store
doing 35 GB/cycle of raw-image egress lands around **~3.5 GB** once images are
re-uploaded through the optimizer — under the 5 GB free cap.

**The catch:** this only works if the images in the new project are the
**small, re-uploaded** ones. If you *copy the old large files over*, you copy
the problem too. Always re-upload originals through the admin form (step 6).

---

## Migration steps

### 1. Export your catalog (costs ~no egress)
- **Admin → System (`/admin/status`) → "Download catalog (JSON)".** Exports
  every product (with its category, gallery images and specs), plus categories,
  articles and site settings. It reads **only text rows — no image bytes** — so
  it's safe even while you're over quota.
- No-deploy fallback (works even if the button isn't live yet) — run in the
  Supabase **SQL Editor** and copy the result:
  ```sql
  select json_build_object(
    'categories',     (select coalesce(json_agg(c), '[]') from categories c),
    'products',       (select coalesce(json_agg(p), '[]') from products p),
    'product_images', (select coalesce(json_agg(i), '[]') from product_images i),
    'product_specs',  (select coalesce(json_agg(s), '[]') from product_specs s),
    'articles',       (select coalesce(json_agg(a), '[]') from articles a),
    'site_settings',  (select row_to_json(ss) from site_settings ss where id = 1)
  );
  ```
  Or Supabase **Table Editor → each table → Export → CSV**.

### 2. Get the image files (only if you don't have the originals)
The export records image **URLs**, not the bytes. If you still have your
original photos locally, skip this. Otherwise download them from
**Supabase → Storage → `product-images`** *before the old project pauses* (a
paused project is fully offline). This download does use egress on the old
project — but you're already over, so just get them out.

### 3. Create a new **organization** and project
Supabase dashboard → **New organization** → then **New project** inside it. Note
the new project's URL and keys (Settings → API).

### 4. Create the schema
In the new project's **SQL Editor**, run the files in `supabase/migrations/` in
order (`0001` → `0005`), then `supabase/seed.sql` if you want the sample data.
See [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) for the full env matrix and Auth
URL configuration.

### 5. Point the app at the new project
In **Cloudflare → your Worker → Settings → Variables**, update (as **runtime**
vars, then redeploy):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Also set Supabase **Auth → URL Configuration → Site URL** to your production
domain (see `SUPABASE_SETUP.md`). Make yourself admin again:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

### 6. Recreate products and **re-upload images**
Add products from your export, and **re-upload the image files** through the
admin form. They're auto-optimized on the way in, so the new bucket holds small
WebPs from day one. (The old image URLs in your export will 404 once the old
project is gone — re-uploading replaces them.)

### 7. Verify it's egress-safe
- Upload a product image, then check it in **Supabase → Storage** — it should be
  a few hundred KB (not multi-MB) and its `Cache-Control` should be
  `max-age=31536000`.
- Watch **Organization → Usage** over the first few days; egress should grow far
  more slowly than before.

---

## Egress-safe checklist

**Do**
- ✅ Re-upload images through the admin form (auto-optimized + 1-year cache).
- ✅ Keep source photos reasonable (the form accepts up to 40 MB and shrinks
  them, but there's no reason to feed it 40 MB).
- ✅ Export regularly as a backup (`/admin/status`).

**Don't**
- ❌ Copy the old, large image files straight into the new bucket — that carries
  the egress problem over. Re-upload instead.
- ❌ Click **System → "Optimize image caching"** (the re-stamp button) on a
  fresh project. It downloads and re-uploads every object, which *uses* egress,
  and new uploads already have the 1-year cache — so it's pure waste here. It's
  only for images uploaded *before* the cache-control change on an old project.
- ❌ Expect any SQL/button to "reset" the egress counter — nothing does.

## When to just upgrade instead

If traffic (not image size) is your egress driver, or you'd rather not manage a
migration, **Supabase Pro** (~$25/mo, 250 GB egress, bills overage instead of
pausing) is the clean answer and removes the pause risk immediately. For a live
store, that's usually cheaper than the downtime.
