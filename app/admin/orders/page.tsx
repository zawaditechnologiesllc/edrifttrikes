export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { OrderStatusQuickForm } from "./OrderStatusForm";
import { STAGE_COPY, type FulfillmentStage } from "@/lib/fulfillment";
import { OriginCell } from "./OrderOrigin";
import PaymentSourceBadge from "./PaymentSourceBadge";
import OrdersToolbar from "./OrdersToolbar";

/**
 * The status tabs.
 *
 * "All" first and selected by default, so the page still opens on everything —
 * a tab that hides orders by default is how an order goes unnoticed. The rest
 * are in the order an order moves through them, with Refunded and Cancelled
 * last because they are the ones you go looking for deliberately.
 */
/** How many rows one page of the table shows before "Show more". */
const PAGE_SIZE = 100;

/** The order_status enum, in the order an order moves through it. */
const STATUSES = ["pending", "paid", "fulfilled", "refunded", "cancelled"] as const;

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
  searchParams: Promise<{ status?: string; limit?: string }>;
}) {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }
  const admin = createAdminClient();
  const params = await searchParams;
  const active = String(params.status ?? "");
  const known = TABS.some((t) => t.key === active) ? active : "";
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, PAGE_SIZE), 2000);

  /*
   * ═══ THE COUNTS COME FROM THE DATABASE, NOT FROM THE ROWS ════════════════
   *
   * They used to be counted in JavaScript over whatever the page had fetched,
   * which quietly ties the numbers to the size of that fetch: any cap — ours,
   * or PostgREST's own max-rows — and every tab starts lying, while the page
   * still looks complete. A head-request per status costs no rows at all and
   * is true however many orders exist.
   *
   * It is also the diagnosis. "Pending 40, Paid 0" is not a broken filter; it
   * is forty payments that were never marked paid, and the tabs are the first
   * place that becomes visible.
   */
  const [totalRes, ...statusRes] = await Promise.all([
    admin.from("orders").select("id", { count: "exact", head: true }),
    ...STATUSES.map((status) =>
      admin.from("orders").select("id", { count: "exact", head: true }).eq("status", status)
    ),
  ]);
  const totalInDatabase = totalRes.count ?? 0;
  const byStatus = new Map<string, number>(
    STATUSES.map((status, i) => [status, statusRes[i]?.count ?? 0])
  );
  /** Rows whose status is not one of the six — nothing should be here. */
  const unaccounted =
    totalInDatabase - STATUSES.reduce((n, s) => n + (byStatus.get(s) ?? 0), 0);

  /*
   * FILTERED IN THE QUERY. Fetching everything and filtering in memory means a
   * tab can only ever show what the fetch happened to include — so a shop with
   * more orders than one page would find its older refunds simply absent from
   * the Refunded tab.
   */
  let query = admin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (known) query = query.eq("status", known);
  const { data: orders, error: ordersError } = await query;

  const rows = orders ?? [];
  const shownOf = known ? (byStatus.get(known) ?? 0) : totalInDatabase;
  const countFor = (key: string) => (key ? (byStatus.get(key) ?? 0) : totalInDatabase);
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      status: known || undefined,
      limit: limit !== PAGE_SIZE ? String(limit) : undefined,
      ...over,
    };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const str = p.toString();
    return str ? `/admin/orders?${str}` : "/admin/orders";
  };

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

      {/* Re-read from Supabase, and ask Stripe what it really took. */}
      <OrdersToolbar totalInDatabase={totalInDatabase} />

      {/*
        A read that FAILED and a shop with no orders look identical in a table,
        and the difference is the whole question being asked here.
      */}
      {ordersError && (
        <p className="mb-4 bg-error/10 border border-error/40 rounded-lg px-4 py-3 text-error text-sm">
          Supabase refused the read: {ordersError.message}. The counts above may
          still be right — this is the row list that failed.
        </p>
      )}

      {/*
        A row whose status is none of the six would be invisible in every tab
        AND present in All, which is exactly the shape of "the tabs do not
        categorise". Nothing should ever be here; if something is, it says so.
      */}
      {unaccounted > 0 && (
        <p className="mb-4 bg-signal-orange/10 border border-signal-orange/40 rounded-lg px-4 py-3 text-signal-orange text-sm">
          {unaccounted} order{unaccounted === 1 ? " has a status" : "s have statuses"} outside
          the six below, so {unaccounted === 1 ? "it appears" : "they appear"} only under All.
          That should not be possible — tell Claude.
        </p>
      )}

      <nav className="flex flex-wrap gap-2 mb-6" aria-label="Filter orders by status">
        {TABS.map((t) => {
          const selected = known === t.key;
          const count = countFor(t.key);
          return (
            <Link
              key={t.key || "all"}
              href={t.key ? `/admin/orders?status=${t.key}` : "/admin/orders"}
              aria-current={selected ? "page" : undefined}
              /* Always ask the server. A tab that answered from the client
                 router's cache would show a stale set after a status change,
                 which reads as "the tabs do not filter". */
              prefetch={false}
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
                  {totalInDatabase === 0 ? "No orders yet." : `No ${known} orders.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/*
        WHAT IS ON THIS PAGE vs WHAT IS IN THE DATABASE, said out loud.
        The question "are these all of them?" should never need a support
        conversation, and a table alone can never answer it.
      */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-on-surface-variant text-sm">
          Showing <span className="text-white">{rows.length}</span> of{" "}
          <span className="text-white">{shownOf}</span>{" "}
          {known ? `${known} orders` : "orders"}
          {known && (
            <>
              {" "}· <span className="text-white">{totalInDatabase}</span> in the database
            </>
          )}
          .
        </p>
        {rows.length < shownOf && (
          <Link
            href={qs({ limit: String(Math.min(limit + PAGE_SIZE * 4, 2000)) })}
            prefetch={false}
            className="border border-white/20 text-on-surface-variant hover:text-white hover:border-white/40 px-4 py-2 rounded text-xs font-label-bold uppercase tracking-widest"
          >
            Show more
          </Link>
        )}
      </div>
    </div>
  );
}