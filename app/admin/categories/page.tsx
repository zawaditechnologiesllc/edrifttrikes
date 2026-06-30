export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { saveCategory, deleteCategory } from "../actions";

const input = "w-full bg-surface-container-highest border border-white/10 text-white p-3 rounded focus:border-secondary focus:ring-0";
const lbl = "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

export default async function AdminCategories() {
  const admin = createAdminClient();
  const { data: categories } = await admin.from("categories").select("*").order("position");

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-8">Categories</h1>

      <form action={saveCategory} className="bg-surface-container border border-white/10 rounded-lg p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8">
        <div><label className={lbl}>Name</label><input name="name" required className={input} /></div>
        <div><label className={lbl}>Slug</label><input name="slug" required className={input} /></div>
        <div><label className={lbl}>Position</label><input name="position" type="number" defaultValue={0} className={input} /></div>
        <button className="bg-secondary text-on-secondary-fixed px-6 py-3 rounded font-label-bold uppercase tracking-widest">Add</button>
        <div className="md:col-span-4"><label className={lbl}>Description</label><input name="description" className={input} /></div>
      </form>

      <div className="bg-surface-container border border-white/10 rounded-lg divide-y divide-white/5">
        {(categories ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4">
            <div>
              <span className="text-white font-label-bold uppercase">{c.name}</span>
              <span className="text-on-surface-variant text-sm ml-3">/{c.slug}</span>
            </div>
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={c.id} />
              <button className="text-error/80 hover:text-error text-sm font-label-bold uppercase">Delete</button>
            </form>
          </div>
        ))}
        {(categories ?? []).length === 0 && <p className="p-6 text-on-surface-variant">No categories yet.</p>}
      </div>
    </div>
  );
}