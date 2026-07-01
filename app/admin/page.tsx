export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { Icon } from "@/components/Icon";

export default async function AdminOverview() {
  const admin = createAdminClient();

  const [{ count: products }, { count: orders }, { count: customers }, { data: paid }, { data: recent }] =
    await Promise.all([
      admin.from("products").select("*", { count: "exact", head: true }),
      admin.from("orders").select("*", { count: "exact", head: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("orders").select("total_cents").in("status", ["paid", "fulfilled"]),
      admin.from("orders").select("*").order("created_at", { ascending: false }).limit(6),
    ]);

  const revenue = (paid ?? []).reduce((n, o) => n + (o.total_cents as number), 0);

  const stats = [
    { label: "Revenue", value: formatMoney(revenue), icon: "payments" },
    { label: "Orders", value: String(orders ?? 0), icon: "receipt_long" },
    { label: "Products", value: String(products ?? 0), icon: "inventory_2" },
    { label: "Riders", value: String(customers ?? 0), icon: "group" },
  ];

  return (
    <div className="p-8">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-8">Control Room</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter mb-12">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface-container border border-white/10 rounded-lg p-6">
            <Icon name={s.icon} className="w-6 h-6 text-secondary" />
            <p className="text-3xl font-headline-md text-white mt-3">{s.value}</p>
            <p className="text-on-surface-variant text-xs uppercase tracking-widest font-label-bold mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-headline-md text-headline-md text-white uppercase">Recent Orders</h2>
        <Link href="/admin/orders" className="text-secondary font-label-bold text-sm uppercase tracking-widest hover:underline">View all</Link>
      </div>
      <div className="bg-surface-container border border-white/10 rounded-lg divide-y divide-white/5">
        {(recent ?? []).length === 0 ? (
          <p className="p-6 text-on-surface-variant">No orders yet.</p>
        ) : (
          (recent ?? []).map((o) => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between p-4 hover:bg-white/5">
              <span className="font-headline-md text-white">{o.order_number}</span>
              <span className="text-on-surface-variant text-sm">{o.email}</span>
              <span className="font-label-bold uppercase text-xs tracking-widest text-secondary">{o.status}</span>
              <span className="text-white font-label-bold">{formatMoney(o.total_cents, o.currency)}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}