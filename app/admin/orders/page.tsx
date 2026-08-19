export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { OrderStatusQuickForm } from "./OrderStatusForm";
import { STAGE_COPY, type FulfillmentStage } from "@/lib/fulfillment";

export default async function AdminOrders() {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-8">Orders</h1>
      <div className="bg-surface-container border border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-left min-w-[700px]">
          <thead className="bg-surface-container-high text-on-surface-variant text-xs uppercase tracking-widest font-label-bold">
            <tr>
              <th className="p-4">Order</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Date</th>
              <th className="p-4">Total</th>
              <th className="p-4">Stage</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-white/5">
                <td className="p-4">
                  <Link href={`/admin/orders/${o.id}`} className="text-secondary font-headline-md hover:underline">{o.order_number}</Link>
                </td>
                <td className="p-4 text-on-surface-variant">{o.email}</td>
                <td className="p-4 text-on-surface-variant text-sm">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="p-4 text-white font-label-bold">{formatMoney(o.total_cents, o.currency)}</td>
                <td className="p-4 text-on-surface-variant text-sm whitespace-nowrap">
                  {STAGE_COPY[(o.fulfillment_stage ?? "awaiting_payment") as FulfillmentStage]?.label ?? "—"}
                </td>
                <td className="p-4">
                  <OrderStatusQuickForm orderId={o.id} status={o.status} />
                </td>
              </tr>
            ))}
            {(orders ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-on-surface-variant">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}