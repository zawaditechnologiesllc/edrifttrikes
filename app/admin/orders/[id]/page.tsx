export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { updateOrderStatus } from "../../actions";

const STATUSES = ["pending", "paid", "fulfilled", "cancelled", "refunded"];

export default async function AdminOrderDetail({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) notFound();

  const addr = (order.shipping_address ?? {}) as Record<string, string>;

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/admin/orders" className="text-on-surface-variant hover:text-white text-sm font-label-bold uppercase tracking-widest">← Orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 mb-8">
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase">{order.order_number}</h1>
        <form action={updateOrderStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={order.id} />
          <select name="status" defaultValue={order.status} className="bg-surface-container-highest border border-white/10 text-white rounded px-3 py-2 focus:border-secondary focus:ring-0">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="bg-secondary text-on-secondary-fixed px-5 py-2 rounded font-label-bold uppercase tracking-widest text-sm">Update</button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-surface-container border border-white/10 rounded-lg p-6">
          <h2 className="font-headline-md text-headline-md text-white uppercase mb-4">Items</h2>
          <div className="divide-y divide-white/5">
            {(order.items ?? []).map((i: { id: string; name: string; qty: number; price_cents: number }) => (
              <div key={i.id} className="flex justify-between py-3">
                <span className="text-on-surface-variant">{i.name} × {i.qty}</span>
                <span className="text-white">{formatMoney(i.price_cents * i.qty, order.currency)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-on-surface-variant"><span>Subtotal</span><span className="text-white">{formatMoney(order.subtotal_cents, order.currency)}</span></div>
            <div className="flex justify-between text-on-surface-variant"><span>Shipping</span><span className="text-white">{formatMoney(order.shipping_cents, order.currency)}</span></div>
            <div className="flex justify-between text-on-surface-variant"><span>Tax</span><span className="text-white">{formatMoney(order.tax_cents, order.currency)}</span></div>
            <div className="flex justify-between font-label-bold uppercase tracking-widest pt-1"><span className="text-white">Total</span><span className="text-secondary text-lg">{formatMoney(order.total_cents, order.currency)}</span></div>
          </div>
        </div>
        <div className="bg-surface-container border border-white/10 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-1">Customer</h3>
            <p className="text-white">{order.email}</p>
          </div>
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-1">Ship to</h3>
            <p className="text-white text-sm leading-relaxed">
              {[addr.first_name, addr.last_name].filter(Boolean).join(" ")}<br />
              {addr.address}<br />
              {[addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}<br />
              {addr.country}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}