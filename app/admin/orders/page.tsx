export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { OrderStatusQuickForm } from "./OrderStatusForm";
import { STAGE_COPY, type FulfillmentStage } from "@/lib/fulfillment";
import { OriginCell } from "./OrderOrigin";
import PaymentSourceBadge from "./PaymentSourceBadge";

/**
 * The status tabs.
 *
 * "All" first and selected by default, so the page still opens on everything —
 * a tab that hides orders by default is how an order goes unnoticed. The rest
 * are in the order an order moves through them, with Refunded and Cancelled
 * last because they are the ones you go looking for deliberately.
 */
const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "refunded", label: "Refunded" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }
  const admin = createAdminClient();
  /*
   * Every order, then filtered and counted here rather than in the query. The
   * tabs need a count for each status, so the rows have to be in hand anyway —
   * and this keeps the page's existing promise that nothing is hidden from it.
   */
  const { data: orders } = await admin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  const all = orders ?? [];
  const active = String((await searchParams).status ?? "");
  const known = TABS.some((t) => t.key === active) ? active : "";
  const rows = known ? all.filter((o) => o.status === known) : all;
  const countFor = (key: string) =>
    key ? all.filter((o) => o.status === key).length : all.length;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase">Orders</h1>
        {/*
          For money that arrived somewhere this shop could not see — a payment
          link, an invoice, a bank transfer, a sale agreed over the phone. The
          checkout creates an order before the buyer ever reaches a payment
          page, so those sales have no row at all until one is typed.
        */}
        <Link
          href="/admin/orders/new"
          className="bg-secondary text-on-secondary-fixed px-5 py-3 rounded font-label-bold uppercase tracking-widest text-sm hover:brightness-105 active:scale-95 transition-all"
        >
          + New order
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 mb-6" aria-label="Filter orders by status">
        {TABS.map((t) => {
          const selected = known === t.key;
          const count = countFor(t.key);
          return (
            <Link
              key={t.key || "all"}
              href={t.key ? `/admin/orders?status=${t.key}` : "/admin/orders"}
              aria-current={selected ? "page" : undefined}
              className={`rounded border px-4 py-2 text-xs font-label-bold uppercase tracking-widest transition-colors ${
                selected
                  ? "border-secondary bg-secondary/15 text-secondary"
                  : "border-white/10 text-on-surface-variant hover:border-white/25 hover:text-white"
              }`}
            >
              {t.label}
              {/* The count is the useful half: an empty Refunded tab answers
                  the question without being opened. */}
              <span className={selected ? "ml-2 text-secondary/70" : "ml-2 text-outline"}>
                {count}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="bg-surface-container border border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-left min-w-[1080px]">
          <thead className="bg-surface-container-high text-on-surface-variant text-xs uppercase tracking-widest font-label-bold">
            <tr>
              <th className="p-4">Order</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Origin</th>
              <th className="p-4">Account</th>
              <th className="p-4">Date</th>
              <th className="p-4">Total</th>
              <th className="p-4">Stage</th>
              <th className="p-4">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-white/5">
                <td className="p-4">
                  <Link href={`/admin/orders/${o.id}`} className="text-secondary font-headline-md hover:underline">{o.order_number}</Link>
                </td>
                <td className="p-4 text-on-surface-variant break-all">{o.email}</td>
                {/* Where they were connecting from. Read-only, and flagged only
                    when something is worth a second look — a badge on every row
                    is a badge nobody reads. */}
                <td className="p-4"><OriginCell order={o} /></td>
                <td className="p-4">
                  {o.user_id ? (
                    <span className="text-[10px] font-label-bold uppercase tracking-widest text-secondary">
                      Linked
                    </span>
                  ) : (
                    <span className="text-[10px] font-label-bold uppercase tracking-widest text-outline">
                      Guest
                    </span>
                  )}
                </td>
                <td className="p-4 text-on-surface-variant text-sm">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="p-4 text-white font-label-bold whitespace-nowrap">
                  {formatMoney(o.total_cents, o.currency)}
                  {/* How it was paid, where the amount is — the two facts get
                      read together, and it saves opening the order to find out
                      which gateway a refund has to go back through. */}
                  {o.paid_via && (
                    <span className="block mt-1">
                      <PaymentSourceBadge via={o.paid_via} />
                    </span>
                  )}
                </td>
                <td className="p-4 text-on-surface-variant text-sm whitespace-nowrap">
                  {STAGE_COPY[(o.fulfillment_stage ?? "awaiting_payment") as FulfillmentStage]?.label ?? "—"}
                </td>
                <td className="p-4">
                  <OrderStatusQuickForm orderId={o.id} status={o.status} />
                </td>
                <td className="p-4 text-right whitespace-nowrap">
                  {/* An explicit action: the order number is a link too, but a
                      named control is what makes "open it and change things"
                      discoverable. */}
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="text-on-surface-variant hover:text-white text-xs font-label-bold uppercase tracking-widest"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-on-surface-variant">
                  {all.length === 0
                    ? "No orders yet."
                    : `No ${known} orders.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}