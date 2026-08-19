export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { STAGE_COPY, type FulfillmentStage } from "@/lib/fulfillment";
import type { Order } from "@/lib/types";

export const metadata = { title: "Paid Orders" };

/**
 * PAID ORDERS — every order money has actually been received for, however it
 * arrived: a Stripe or PayPal webhook confirming the gateway took payment, or
 * an admin marking it paid by hand (bank transfer, cash on collection, a
 * gateway that failed to call back).
 *
 * Separate from the main orders list on purpose: that list is everything
 * including abandoned `pending` rows, which makes it useless for answering
 * "what have we actually taken?".
 */

/** How the payment reached us — colour-coded so manual entries stand out. */
const SOURCE_STYLE: Record<string, { label: string; className: string }> = {
  stripe: {
    label: "Stripe",
    className: "bg-primary-container/30 text-primary border-primary/30",
  },
  paypal: {
    label: "PayPal",
    className: "bg-secondary/10 text-secondary border-secondary/30",
  },
  manual: {
    label: "Manual",
    className: "bg-signal-orange/10 text-signal-orange border-signal-orange/30",
  },
};

function SourceBadge({ via }: { via: string | null | undefined }) {
  // Orders paid before migration 0007 ran have no recorded source.
  const style = SOURCE_STYLE[via ?? ""] ?? {
    label: "Unknown",
    className: "bg-white/5 text-on-surface-variant border-white/10",
  };
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-label-bold uppercase tracking-widest ${style.className}`}
    >
      {style.label}
    </span>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-surface-container border border-white/10 rounded-lg p-5">
      <p className="font-label-bold text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p className="font-headline-md text-2xl text-white mt-2">{value}</p>
      {hint && <p className="text-on-surface-variant text-xs mt-1">{hint}</p>}
    </div>
  );
}

export default async function AdminPaidOrders({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ via?: string }>;
}) {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }

  const { via } = await searchParamsPromise;
  const filter = via && SOURCE_STYLE[via] ? via : null;

  const admin = createAdminClient();

  // `fulfilled` counts as paid — it's a paid order that has since been
  // delivered, and excluding it would understate takings.
  let query = admin
    .from("orders")
    .select("*")
    .in("status", ["paid", "fulfilled"]);
  if (filter) query = query.eq("paid_via", filter);

  const { data, error } = await query
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    return (
      <div className="p-8">
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-4">
          Paid Orders
        </h1>
        <p className="text-error max-w-xl">
          Could not load paid orders: {error.message}
        </p>
        <p className="text-on-surface-variant text-sm mt-2 max-w-xl">
          If this is a fresh deploy, run{" "}
          <code className="text-secondary">
            supabase/migrations/0007_paid_source_and_replies.sql
          </code>{" "}
          in the Supabase SQL editor.
        </p>
      </div>
    );
  }

  const orders = (data ?? []) as Order[];

  // Totals are computed over the rows shown, so they always agree with the
  // table underneath rather than describing some other set.
  const revenue = orders.reduce((n, o) => n + (o.total_cents || 0), 0);
  const now = new Date();
  const thisMonth = orders.filter((o) => {
    const paid = o.paid_at ? new Date(o.paid_at) : null;
    return (
      paid &&
      paid.getMonth() === now.getMonth() &&
      paid.getFullYear() === now.getFullYear()
    );
  });
  const monthRevenue = thisMonth.reduce((n, o) => n + (o.total_cents || 0), 0);
  const awaitingFulfilment = orders.filter((o) => o.status === "paid").length;

  const tabs: { key: string | null; label: string }[] = [
    { key: null, label: "All" },
    { key: "stripe", label: "Stripe" },
    { key: "paypal", label: "PayPal" },
    { key: "manual", label: "Manual" },
  ];

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display-lg text-display-lg-mobile text-white uppercase">
            Paid Orders
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 max-w-xl">
            Orders payment has been received for — confirmed by a Stripe or
            PayPal webhook, or marked paid by an admin.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="text-on-surface-variant hover:text-white text-sm font-label-bold uppercase tracking-widest"
        >
          All orders →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatTile
          label={filter ? `${SOURCE_STYLE[filter].label} revenue` : "Total revenue"}
          value={formatMoney(revenue, orders[0]?.currency ?? "usd")}
          hint={`${orders.length} paid order${orders.length === 1 ? "" : "s"}`}
        />
        <StatTile
          label="This month"
          value={formatMoney(monthRevenue, orders[0]?.currency ?? "usd")}
          hint={`${thisMonth.length} order${thisMonth.length === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Awaiting fulfilment"
          value={String(awaitingFulfilment)}
          hint="Paid, not yet marked delivered"
        />
        <StatTile
          label="Average order"
          value={formatMoney(
            orders.length ? Math.round(revenue / orders.length) : 0,
            orders[0]?.currency ?? "usd"
          )}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <Link
              key={t.label}
              href={t.key ? `/admin/orders/paid?via=${t.key}` : "/admin/orders/paid"}
              className={`rounded px-4 py-2 text-xs font-label-bold uppercase tracking-widest border transition-colors ${
                active
                  ? "bg-secondary text-on-secondary-fixed border-secondary"
                  : "border-white/10 text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-surface-container border border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-left min-w-[820px]">
          <thead className="bg-surface-container-high text-on-surface-variant text-xs uppercase tracking-widest font-label-bold">
            <tr>
              <th className="p-4">Order</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Paid</th>
              <th className="p-4">Via</th>
              <th className="p-4">Delivery stage</th>
              <th className="p-4">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-white/5">
                <td className="p-4">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="text-secondary font-headline-md hover:underline"
                  >
                    {o.order_number}
                  </Link>
                  {o.status === "fulfilled" && (
                    <span className="block text-[10px] uppercase tracking-widest text-primary mt-0.5">
                      Fulfilled
                    </span>
                  )}
                </td>
                <td className="p-4 text-on-surface-variant">{o.email}</td>
                <td className="p-4 text-on-surface-variant text-sm whitespace-nowrap">
                  {o.paid_at ? (
                    new Date(o.paid_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  ) : (
                    <span className="text-outline">—</span>
                  )}
                </td>
                <td className="p-4">
                  <SourceBadge via={o.paid_via} />
                </td>
                <td className="p-4 text-on-surface-variant text-sm whitespace-nowrap">
                  {
                    STAGE_COPY[
                      (o.fulfillment_stage ?? "confirmed") as FulfillmentStage
                    ]?.label
                  }
                </td>
                <td className="p-4 text-white font-label-bold whitespace-nowrap">
                  {formatMoney(o.total_cents, o.currency)}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-on-surface-variant">
                  {filter
                    ? `No orders paid via ${SOURCE_STYLE[filter].label} yet.`
                    : "No paid orders yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {orders.length === 500 && (
        <p className="text-on-surface-variant text-xs mt-3">
          Showing the 500 most recent paid orders.
        </p>
      )}
    </div>
  );
}
