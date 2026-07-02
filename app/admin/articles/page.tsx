export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { saveArticle, deleteArticle } from "../actions";

const input = "w-full bg-surface-container-highest border border-white/10 text-white p-3 rounded focus:border-secondary focus:ring-0";
const lbl = "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

export default async function AdminArticles() {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }
  const admin = createAdminClient();
  const { data: articles } = await admin.from("articles").select("*").order("published_at", { ascending: false });

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-8">Tech Lab</h1>

      <form action={saveArticle} className="bg-surface-container border border-white/10 rounded-lg p-6 space-y-4 mb-8">
        <h2 className="font-headline-md text-headline-md text-white uppercase">New article</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={lbl}>Title</label><input name="title" required className={input} /></div>
          <div><label className={lbl}>Slug</label><input name="slug" required className={input} /></div>
          <div><label className={lbl}>Category</label><input name="category" className={input} /></div>
          <div><label className={lbl}>Author</label><input name="author" className={input} /></div>
        </div>
        <div><label className={lbl}>Excerpt</label><input name="excerpt" className={input} /></div>
        <div><label className={lbl}>Body</label><textarea name="body" rows={5} className={input} /></div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1"><label className={lbl}>Cover image</label><input name="image" type="file" accept="image/*" className="text-on-surface-variant text-sm" /></div>
          <label className="flex items-center gap-2 text-on-surface-variant"><input type="checkbox" name="published" defaultChecked className="w-5 h-5" /><span className="text-xs font-label-bold uppercase tracking-widest">Published</span></label>
        </div>
        <button className="bg-secondary text-on-secondary-fixed px-6 py-3 rounded font-label-bold uppercase tracking-widest">Publish</button>
      </form>

      <div className="bg-surface-container border border-white/10 rounded-lg divide-y divide-white/5">
        {(articles ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between p-4">
            <div>
              <span className="text-white font-label-bold uppercase">{a.title}</span>
              <span className="text-on-surface-variant text-sm ml-3">/{a.slug}</span>
              {!a.published && <span className="text-signal-orange text-xs ml-3 uppercase">draft</span>}
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/tech-lab/${a.slug}`} className="text-primary text-sm font-label-bold uppercase hover:underline">View</Link>
              <form action={deleteArticle}>
                <input type="hidden" name="id" value={a.id} />
                <button className="text-error/80 hover:text-error text-sm font-label-bold uppercase">Delete</button>
              </form>
            </div>
          </div>
        ))}
        {(articles ?? []).length === 0 && <p className="p-6 text-on-surface-variant">No articles yet.</p>}
      </div>
    </div>
  );
}