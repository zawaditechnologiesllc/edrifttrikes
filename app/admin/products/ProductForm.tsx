"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { saveProduct } from "../actions";
import type { Category, Product } from "@/lib/types";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-secondary text-on-secondary-fixed px-8 py-4 rounded font-label-bold uppercase tracking-widest hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save product"}
    </button>
  );
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
  return (
    <form action={saveProduct} className="max-w-3xl space-y-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="hero_image" value={p?.hero_image ?? ""} />

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
      </div>

      <div>
        <label className={lbl}>Hero image</label>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p?.hero_image && <img src={p.hero_image} alt="" className="w-20 h-20 object-cover rounded border border-white/10" />}
          <input name="image" type="file" accept="image/*" className="text-on-surface-variant text-sm" />
        </div>
        <p className="text-[10px] text-outline uppercase tracking-widest mt-1">Main image, shown on cards. Uploads to Supabase Storage. Leave empty to keep current.</p>
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
        <p className="text-[10px] text-outline uppercase tracking-widest mt-1">Add one or more images for the product-page gallery. Tick existing images to remove them on save.</p>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <Save />
        <Link href="/admin/products" className="text-on-surface-variant font-label-bold uppercase tracking-widest text-sm hover:text-white">Cancel</Link>
      </div>
    </form>
  );
}
