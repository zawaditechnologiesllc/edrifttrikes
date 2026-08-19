export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { supabaseUrl, supabaseServiceRoleKey } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { Icon } from "@/components/Icon";

export default async function AdminOverview() {
  if (!adminConfigured()) {
    const missing = [
      !supabaseUrl() && "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)",
      !supabaseServiceRoleKey() && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean) as string[];
    return (
      <div className="p-8 max-w-2xl space-y-4">
        <p className="text-on-surface-variant">
          Connect Supabase (URL + service role key) to manage the store.
        </p>
        <p className="text-on-surface-variant">
          The running server can&apos;t see:{" "}
          <code className="text-secondary">{missing.join(", ")}</code>. Set{" "}
          {missing.length > 1 ? "them" : "it"} on the Cloudflare Worker under{" "}
          <span className="text-white">Settings → Variables and Secrets</span>{" "}
          (runtime, not only build), then redeploy. Visit{" "}
          <code className="text-secondary">/api/health</code> to verify — it
          must report <code className="text-secondary">adminReady: true</code>{" "}
          and the current <code className="text-secondary">diag</code> marker,
          otherwise the deployment is running stale code.
        </p>
      </div>
    );
  }
  const admin = createAdminClient();

  const [
    { count: products },
    { count: orders },
    { count: customers },
    { data: paid },
    { data: recent },
    unansweredMessages,
  ] = await Promise.all([
    admin.from("products").select("*", { count: "exact", head: true }),
    admin.from("orders").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("orders").select("total_cents").in("status", ["paid", "fulfilled"]),
    admin.from("orders").select("*").order("created_at", { ascending: false }).limit(6),
    // Best-effort: a missing contact_messages table must not break the whole
    // overview, so this resolves to 0 rather than rejecting. Wrapped in an
    // async function because the Supabase builder is a PromiseLike, not a real
    // Promise — it has no .catch() to hang the fallback off.
    (async () => {
      try {
        const { count, error } = await admin
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("handled", false);
        return error ? 0 : (count ?? 0);
      } catch {
        return 0;
      }
    })(),
  ]);

  const revenue = (paid ?? []).reduce((n, o) => n + (o.total_cents as number), 0);
  const paidCount = (paid ?? []).length;

  const stats = [
    {
      label: "Revenue",
      value: formatMoney(revenue),
      icon: "payments",
      href: "/admin/orders/paid",
      hint: `${paidCount} paid order${paidCount === 1 ? "" : "s"}`,
    },
    { label: "Orders", value: String(orders ?? 0), icon: "receipt_long", href: "/admin/orders" },
    { label: "Products", value: String(products ?? 0), icon: "inventory_2", href: "/admin/products" },
    {
      label: "Messages",
      value: String(unansweredMessages),
      icon: "mail",
      href: "/admin/messages",
      hint: unansweredMessages > 0 ? "Awaiting a reply" : "All answered",
    },
    { label: "Riders", value: String(customers ?? 0), icon: "group" },
  ];

  return (
    <div className="p-8">
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-8">Control Room</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-gutter mb-12">
        {stats.map((s) => {
          const tile = (
            <>
              <Icon name={s.icon} className="w-6 h-6 text-secondary" />
              <p className="text-3xl font-headline-md text-white mt-3">{s.value}</p>
              <p className="text-on-surface-variant text-xs uppercase tracking-widest font-label-bold mt-1">{s.label}</p>
              {s.hint && (
                <p className="text-outline text-[11px] mt-1">{s.hint}</p>
              )}
            </>
          );
          // Tiles that lead somewhere useful become links; the rest stay plain
          // so nothing looks clickable that isn't.
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className="bg-surface-container border border-white/10 rounded-lg p-6 hover:border-secondary/40 hover:bg-white/5 transition-colors"
            >
              {tile}
            </Link>
          ) : (
            <div key={s.label} className="bg-surface-container border border-white/10 rounded-lg p-6">
              {tile}
            </div>
          );
        })}
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