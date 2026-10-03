export const dynamic = "force-dynamic";

import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { saveCategory, deleteCategory, toggleCategory } from "../actions";

const input = "w-full bg-surface-container-highest border border-white/10 text-white p-3 rounded focus:border-secondary focus:ring-0";
const lbl = "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

export default async function AdminCategories() {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }
  const admin = createAdminClient();
  /**
   * The product counts are read alongside the categories so the page can say
   * what turning one off actually costs. It hides that category's products
   * too, and "7 products hidden with it" is the difference between an informed
   * click and a surprise.
   */
  const [{ data: categories }, { data: liveProducts }] = await Promise.all([
    admin.from("categories").select("*").order("position"),
    admin.from("products").select("category_id").eq("status", "active"),
  ]);
  const productCount = new Map<string, number>();
  for (const row of liveProducts ?? []) {
    const key = String((row as { category_id: string | null }).category_id ?? "");
    if (key) productCount.set(key, (productCount.get(key) ?? 0) + 1);
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-2">Categories</h1>
      <p className="text-on-surface-variant text-sm mb-8 max-w-2xl">
        Turning a category off hides <span className="text-white">everything</span> about
        it: the menu and footer links, the hero button, the homepage tile, the
        shop filter, its category page, and its products — everywhere they
        appear, including their own pages and the checkout, which will refuse
        them. Nothing is deleted and no product status changes, so turning it
        back on restores all of it. To hide one product on its own, set its
        status in <span className="text-secondary">Products</span>.
      </p>

      <form action={saveCategory} className="bg-surface-container border border-white/10 rounded-lg p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8">
        <div><label className={lbl}>Name</label><input name="name" required className={input} /></div>
        <div><label className={lbl}>Slug</label><input name="slug" required className={input} /></div>
        <div><label className={lbl}>Position</label><input name="position" type="number" defaultValue={0} className={input} /></div>
        <button className="bg-secondary text-on-secondary-fixed px-6 py-3 rounded font-label-bold uppercase tracking-widest">Add</button>
        <div className="md:col-span-2"><label className={lbl}>Description</label><input name="description" className={input} /></div>
        <div className="md:col-span-2"><label className={lbl}>Image URL</label><input name="image_url" placeholder="/assets/action-360-slide.jpg" className={input} /></div>
      </form>

      <div className="bg-surface-container border border-white/10 rounded-lg divide-y divide-white/5">
        {/*
            Each existing category is now EDITABLE, not just deletable. The
            save action always supported an id, but nothing sent one — so the
            page offered Add and Delete and nothing in between, and renaming a
            category or changing its tile image meant writing SQL by hand.
        */}
        {(categories ?? []).map((c) => (
          <div key={c.id} className="p-4">
            <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
              <div>
                <span className="text-white font-label-bold uppercase">{c.name}</span>
                <span className="text-on-surface-variant text-sm ml-3">/{c.slug}</span>
                {c.active === false && (
                  <span className="ml-3 inline-block rounded border border-signal-orange/40 bg-signal-orange/10 px-2 py-0.5 text-[10px] font-label-bold uppercase tracking-widest text-signal-orange">
                    Hidden
                  </span>
                )}
                {/* What the toggle is actually doing to the catalogue. */}
                {(productCount.get(String(c.id)) ?? 0) > 0 && (
                  <span className={`ml-3 text-xs ${c.active === false ? "text-signal-orange/80" : "text-on-surface-variant"}`}>
                    {productCount.get(String(c.id))}{" "}
                    {productCount.get(String(c.id)) === 1 ? "product" : "products"}
                    {c.active === false ? " hidden with it" : " live"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                {/* One click, and the desired state travels with it rather
                    than being read back from the row first. */}
                <form action={toggleCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={c.active === false ? "true" : "false"} />
                  <button
                    className={`rounded border px-3 py-1.5 text-xs font-label-bold uppercase tracking-widest transition-colors ${
                      c.active === false
                        ? "border-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20"
                        : "border-white/20 text-on-surface-variant hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {c.active === false ? "Turn on" : "Turn off"}
                  </button>
                </form>
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-error/80 hover:text-error text-sm font-label-bold uppercase">Delete</button>
                </form>
              </div>
            </div>
            <form action={saveCategory} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <input type="hidden" name="id" value={c.id} />
              <div><label className={lbl}>Name</label><input name="name" required defaultValue={c.name ?? ""} className={input} /></div>
              <div><label className={lbl}>Slug</label><input name="slug" required defaultValue={c.slug ?? ""} className={input} /></div>
              <div><label className={lbl}>Position</label><input name="position" type="number" defaultValue={c.position ?? 0} className={input} /></div>
              <button className="bg-primary-container text-white px-6 py-3 rounded font-label-bold uppercase tracking-widest">Save</button>
              <div className="md:col-span-2"><label className={lbl}>Description</label><input name="description" defaultValue={c.description ?? ""} className={input} /></div>
              <div className="md:col-span-2">
                <label className={lbl}>Image URL</label>
                <input name="image_url" defaultValue={c.image_url ?? ""} placeholder="/assets/action-360-slide.jpg" className={input} />
              </div>
            </form>
          </div>
        ))}
        {(categories ?? []).length === 0 && <p className="p-6 text-on-surface-variant">No categories yet.</p>}
      </div>
    </div>
  );
}