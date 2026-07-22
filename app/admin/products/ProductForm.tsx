"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProduct, createUploadUrls } from "../actions";
import { createClient } from "@/lib/supabase/client";
import { parseProductText, PRODUCT_TEMPLATE } from "@/lib/product-import";
import type { Category, Product } from "@/lib/types";

// Per-file ceiling, checked before upload. Images go straight from the
// browser to Supabase Storage (never through the Worker), so this is a UX
// guard, not a platform limit.
const MAX_FILE_MB = 10;

/** Reject a hung step with a readable error instead of spinning forever. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s — check your connection and /api/health, then try again.`)),
        ms
      )
    ),
  ]);
}

const input =
  "w-full bg-surface-container-highest border border-white/10 text-white p-3 rounded focus:border-secondary focus:ring-0";
const lbl =
  "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

export default function ProductForm({
  product,
  categories,
}: {
  product?: Product | null;
  categories: Category[];
}) {
  const p = product;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = e.currentTarget;
    setError(null);
    setPending(true);
    try {
      const fd = new FormData(form);
      // Pull the Files out — they upload browser → Storage, not through the
      // server action (large multipart bodies are what used to hang saves).
      const heroFile = fd.get("image");
      const galleryFiles = fd
        .getAll("gallery")
        .filter((f): f is File => f instanceof File && f.size > 0);
      fd.delete("image");
      fd.delete("gallery");

      const files: File[] = [];
      if (heroFile instanceof File && heroFile.size > 0) files.push(heroFile);
      files.push(...galleryFiles);

      const tooBig = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
      if (tooBig) {
        setError(
          `"${tooBig.name}" is ${(tooBig.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_FILE_MB} MB per image. Resize/compress it and try again.`
        );
        return;
      }

      if (files.length > 0) {
        setStep("Authorizing image upload…");
        const targets = await withTimeout(
          createUploadUrls(files.map((f) => ({ name: f.name, type: f.type }))),
          30_000,
          "Authorizing the upload"
        );
        if ("error" in targets) {
          setError(targets.error);
          return;
        }
        const supabase = createClient();
        const hasHero = heroFile instanceof File && heroFile.size > 0;
        const galleryUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          setStep(`Uploading image ${i + 1} of ${files.length}…`);
          const t = targets.urls[i];
          const { error: upErr } = await withTimeout(
            supabase.storage
              .from("product-images")
              .uploadToSignedUrl(t.path, t.token, files[i], {
                contentType: files[i].type || "image/jpeg",
              }),
            120_000,
            `Uploading ${files[i].name}`
          );
          if (upErr) {
            setError(`Upload failed for ${files[i].name}: ${upErr.message}`);
            return;
          }
          if (hasHero && i === 0) fd.set("hero_uploaded_url", t.publicUrl);
          else galleryUrls.push(t.publicUrl);
        }
        if (galleryUrls.length) fd.set("gallery_uploaded_urls", JSON.stringify(galleryUrls));
      }

      setStep("Saving product…");
      const res = await withTimeout(saveProduct({}, fd), 60_000, "Saving the product");
      if (res?.error) {
        setError(res.error);
        return;
      }
      setStep("Saved — redirecting…");
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed — please try again.");
    } finally {
      setPending(false);
      setStep(null);
    }
  }

  function importFromFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const form = formRef.current;
      if (!form) return;
      const parsed = parseProductText(String(reader.result || ""));

      let applied = 0;
      const setValue = (name: string, value: string) => {
        const el = form.elements.namedItem(name);
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        ) {
          el.value = value;
          applied++;
        }
      };
      for (const [name, value] of Object.entries(parsed.fields)) {
        if (value) setValue(name, value);
      }
      for (const [name, checked] of Object.entries(parsed.checks)) {
        const el = form.elements.namedItem(name);
        if (el instanceof HTMLInputElement) {
          el.checked = checked;
          applied++;
        }
      }
      if (parsed.category) {
        const want = parsed.category.toLowerCase();
        const match = categories.find(
          (c) => c.slug.toLowerCase() === want || c.name.toLowerCase() === want
        );
        if (match) setValue("category_id", match.id);
      }

      const skipped = parsed.unknownKeys.length
        ? ` Skipped unknown keys: ${parsed.unknownKeys.join(", ")}.`
        : "";
      setImportNote(
        applied > 0
          ? `Prefilled ${applied} fields from ${file.name} — review, add images, then save.${skipped}`
          : `Nothing recognized in ${file.name} — use "Key: value" lines (download the template below).`
      );
    };
    reader.readAsText(file);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="hero_image" value={p?.hero_image ?? ""} />

      {!p && (
        <div className="bg-surface-container border border-white/10 rounded-lg p-5 space-y-2">
          <p className="font-label-bold text-label-bold text-white uppercase tracking-widest text-xs">
            Import from text file
          </p>
          <p className="text-on-surface-variant text-sm">
            Prefill the form from a <code className="text-secondary">.txt</code> file of{" "}
            <code className="text-secondary">Key: value</code> lines — then add images and adjust
            anything before saving.{" "}
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(PRODUCT_TEMPLATE)}`}
              download="product-template.txt"
              className="text-secondary hover:underline"
            >
              Download the template
            </a>
            .
          </p>
          <input
            type="file"
            accept=".txt,.text,.md,text/plain"
            onChange={importFromFile}
            className="text-on-surface-variant text-sm"
          />
          {importNote && <p className="text-secondary text-sm">{importNote}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Name</label>
          <input name="name" required defaultValue={p?.name} className={input} />
        </div>
        <div>
          <label className={lbl}>Slug (url)</label>
          <input name="slug" required defaultValue={p?.slug} placeholder="volt-s1-pro" className={input} />
        </div>
      </div>

      <div>
        <label className={lbl}>Tagline</label>
        <input name="tagline" defaultValue={p?.tagline ?? ""} className={input} />
      </div>
      <div>
        <label className={lbl}>Description</label>
        <textarea name="description" rows={4} defaultValue={p?.description ?? ""} className={input} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className={lbl}>Price ($)</label>
          <input name="price" required defaultValue={p ? (p.price_cents / 100).toFixed(2) : ""} className={input} />
        </div>
        <div>
          <label className={lbl}>Compare-at ($)</label>
          <input name="compare_at" defaultValue={p?.compare_at_cents ? (p.compare_at_cents / 100).toFixed(2) : ""} className={input} />
        </div>
        <div>
          <label className={lbl}>Stock</label>
          <input name="stock" type="number" defaultValue={p?.stock ?? 0} className={input} />
        </div>
        <div>
          <label className={lbl}>Badge</label>
          <input name="badge" defaultValue={p?.badge ?? ""} placeholder="NEW / SALE" className={input} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className={lbl}>Category</label>
          <select name="category_id" defaultValue={p?.category_id ?? ""} className={input}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Power</label>
          <select name="power" defaultValue={p?.power ?? "electric"} className={input}>
            <option value="electric">Electric</option>
            <option value="gas">Gas</option>
            <option value="gravity">Gravity</option>
            <option value="na">N/A</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Top speed</label>
          <input name="top_speed" defaultValue={p?.top_speed ?? ""} className={input} />
        </div>
        <div>
          <label className={lbl}>Range</label>
          <input name="range_miles" defaultValue={p?.range_miles ?? ""} className={input} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className={lbl}>Skill level</label>
          <input name="skill_level" defaultValue={p?.skill_level ?? ""} className={input} />
        </div>
        <div>
          <label className={lbl}>Status</label>
          <select name="status" defaultValue={p?.status ?? "active"} className={input}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <label className="flex items-center gap-3 text-on-surface-variant pb-3">
          <input type="checkbox" name="is_new" defaultChecked={p?.is_new} className="w-5 h-5" />
          <span className="font-label-bold uppercase text-xs tracking-widest">Mark as new</span>
        </label>
        <label className="flex items-center gap-3 text-on-surface-variant pb-3">
          <input type="checkbox" name="featured" defaultChecked={p?.featured} className="w-5 h-5" />
          <span className="font-label-bold uppercase text-xs tracking-widest">Featured (homepage)</span>
        </label>
      </div>

      <div>
        <label className={lbl}>Hero image</label>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p?.hero_image && <img src={p.hero_image} alt="" className="w-20 h-20 object-cover rounded border border-white/10" />}
          <input name="image" type="file" accept="image/*" className="text-on-surface-variant text-sm" />
        </div>
        <p className="text-[10px] text-outline uppercase tracking-widest mt-1">Main image, shown on cards. Uploads from your browser straight to Supabase Storage. Max {MAX_FILE_MB} MB. Leave empty to keep current.</p>
      </div>

      <div>
        <label className={lbl}>Gallery images (product page)</label>
        {p?.images && p.images.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {p.images.map((img) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt ?? ""} className="w-24 h-24 object-cover rounded border border-white/10" />
                <label className="absolute -top-2 -right-2 flex items-center gap-1 bg-surface-container-highest border border-white/10 rounded-full px-2 py-1 cursor-pointer" title="Remove on save">
                  <input type="checkbox" name="remove_image" value={img.id} className="w-3.5 h-3.5 accent-red-500" />
                  <span className="text-[9px] font-label-bold uppercase tracking-widest text-on-surface-variant">Del</span>
                </label>
              </div>
            ))}
          </div>
        )}
        <input name="gallery" type="file" accept="image/*" multiple className="text-on-surface-variant text-sm" />
        <p className="text-[10px] text-outline uppercase tracking-widest mt-1">Add one or more images for the product-page gallery. Max {MAX_FILE_MB} MB each. Tick existing images to remove them on save.</p>
      </div>

      {error && (
        <p className="text-error font-body-md border border-error/40 bg-error/10 rounded p-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-secondary text-on-secondary-fixed px-8 py-4 rounded font-label-bold uppercase tracking-widest hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
        >
          {pending ? step || "Saving…" : "Save product"}
        </button>
        <Link href="/admin/products" className="text-on-surface-variant font-label-bold uppercase tracking-widest text-sm hover:text-white">Cancel</Link>
      </div>
    </form>
  );
}
