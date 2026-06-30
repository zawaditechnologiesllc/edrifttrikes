export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { deleteProduct } from "../actions";

export default async function AdminProducts() {
  const admin = createAdminClient();
  const { data: products } = await admin
    .from("products")
    .select("*, category:categories(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase">Products</h1>
        <Link href="/admin/products/new" className="bg-secondary text-on-secondary-fixed px-6 py-3 rounded font-label-bold uppercase tracking-widest text-sm hover:brightness-105">
          + New product
        </Link>
      </div>

      <div className="bg-surface-container border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-container-high text-on-surface-variant text-xs uppercase tracking-widest font-label-bold">
            <tr>
              <th className="p-4">Product</th>
              <th className="p-4 hidden md:table-cell">Category</th>
              <th className="p-4">Price</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {(products ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-white/5">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.hero_image || "/assets/placeholder.svg"} alt="" className="w-12 h-12 object-cover rounded bg-surface-container-high" />
                    <span className="text-white font-label-bold uppercase">{p.name}</span>
                  </div>
                </td>
                <td className="p-4 hidden md:table-cell text-on-surface-variant">{p.category?.name ?? "—"}</td>
                <td className="p-4 text-secondary font-label-bold">{formatMoney(p.price_cents)}</td>
                <td className={`p-4 font-label-bold ${p.stock <= 5 ? "text-signal-orange" : "text-on-surface-variant"}`}>{p.stock}</td>
                <td className="p-4">
                  <span className={`text-xs uppercase tracking-widest font-label-bold ${p.status === "active" ? "text-secondary" : "text-outline"}`}>{p.status}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/products/${p.id}`} className="text-primary hover:underline text-sm font-label-bold uppercase">Edit</Link>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-error/80 hover:text-error text-sm font-label-bold uppercase">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {(products ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-on-surface-variant">No products yet. Add your first rig.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}