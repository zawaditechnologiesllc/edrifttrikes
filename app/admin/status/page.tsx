export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, serverEnv } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";
import StorageCacheButton from "./StorageCacheButton";

export const metadata = { title: "System status" };

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between bg-surface-container border border-white/10 rounded-lg px-4 py-3">
      <span className="text-on-surface-variant text-sm">{label}</span>
      <span
        className={`font-label-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded ${
          ok ? "bg-secondary/15 text-secondary" : "bg-error/15 text-error"
        }`}
      >
        {ok ? "Connected" : "Missing"}
      </span>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-secondary/15 text-secondary",
  fulfilled: "bg-secondary/15 text-secondary",
  pending: "bg-signal-orange/15 text-signal-orange",
  cancelled: "bg-error/15 text-error",
  refunded: "bg-error/15 text-error",
};

function paymentMethod(o: Order): string {
  const ref = o.stripe_session_id || "";
  if (ref.startsWith("cs_")) return "Stripe";
  if (ref) return "PayPal";
  return "—";
}

export default async function SystemStatus() {
  const stripeOk = Boolean(serverEnv("STRIPE_SECRET_KEY"));
  const paypalOk = Boolean(serverEnv("PAYPAL_CLIENT_ID") && serverEnv("PAYPAL_SECRET"));

  const config = [
    { label: "Supabase URL", ok: Boolean(supabaseUrl()) },
    { label: "Supabase anon key", ok: Boolean(supabaseAnonKey()) },
    { label: "Supabase service role (admin)", ok: Boolean(supabaseServiceRoleKey()) },
    { label: "Render backend URL (emails)", ok: Boolean(serverEnv("RENDER_API_URL")) },
    { label: "Internal API key (emails)", ok: Boolean(serverEnv("INTERNAL_API_KEY")) },
    { label: "Stripe (card payments)", ok: stripeOk },
    { label: "PayPal", ok: paypalOk },
    { label: "Turnstile (form bot protection)", ok: Boolean(serverEnv("TURNSTILE_SECRET_KEY")) },
  ];
  const checkoutLive = stripeOk || paypalOk;

  let orders: Order[] = [];
  // Probe one column per migration — a failed select means that migration
  // hasn't been run in THIS database, which silently disables its features
  // (e.g. per-product shipping fees falling back to the default).
  const migrations: { label: string; ok: boolean }[] = [];
  if (adminConfigured()) {
    const admin = createAdminClient();
    const columnExists = async (table: string, column: string) =>
      !(await admin.from(table).select(column).limit(1)).error;
    const [m3, m4a, m4b, m5, { data }] = await Promise.all([
      columnExists("site_settings", "id"),
      columnExists("site_settings", "shipping_cents"),
      columnExists("articles", "id").then(async (ok) => {
        if (!ok) return false;
        const { count } = await admin
          .from("articles")
          .select("*", { count: "exact", head: true });
        return (count ?? 0) >= 6;
      }),
      columnExists("products", "shipping_cents"),
      admin.from("orders").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    migrations.push(
      { label: "0003 — featured flag + site settings", ok: m3 },
      { label: "0004 — store shipping fee + Tech Lab articles", ok: m4a && m4b },
      { label: "0005 — per-product shipping fee", ok: m5 }
    );
    orders = (data as Order[]) ?? [];
  }

  return (
    <div className="p-8 space-y-10">
      <div>
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-2">System</h1>
        <p className="text-on-surface-variant max-w-2xl">
          What the running server can see right now. Public version of this
          check: <code className="text-secondary">/api/health</code>. Deep
          request logs: Cloudflare dashboard → your Worker → Logs.
        </p>
      </div>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-headline-md text-headline-md text-white uppercase">Configuration</h2>
          <span
            className={`font-label-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded ${
              checkoutLive ? "bg-secondary/15 text-secondary" : "bg-signal-orange/15 text-signal-orange"
            }`}
          >
            {checkoutLive ? "Checkout live" : "Checkout paused — no payment provider"}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {config.map((c) => (
            <Chip key={c.label} ok={c.ok} label={c.label} />
          ))}
        </div>
        {!checkoutLive && (
          <p className="text-on-surface-variant text-sm mt-3 max-w-2xl">
            With no payment provider connected, buyers see a &ldquo;high order
            volume — try again in a few hours&rdquo; notice and cannot place
            orders. Connect Stripe and/or PayPal on the Worker (Settings →
            Variables and Secrets) to go live.
          </p>
        )}
      </section>

      <section>
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-2">
          Image caching
        </h2>
        <p className="text-on-surface-variant text-sm max-w-2xl mb-4">
          New product images are cached for a year automatically. If your Supabase
          Storage egress is high, click below once to re-stamp images uploaded
          earlier (they kept the old 1-hour cache). Safe to run anytime.
        </p>
        <StorageCacheButton />
      </section>

      {migrations.length > 0 && (
        <section>
          <h2 className="font-headline-md text-headline-md text-white uppercase mb-4">
            Database migrations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {migrations.map((m) => (
              <div
                key={m.label}
                className="flex items-center justify-between bg-surface-container border border-white/10 rounded-lg px-4 py-3"
              >
                <span className="text-on-surface-variant text-sm">{m.label}</span>
                <span
                  className={`font-label-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded ${
                    m.ok ? "bg-secondary/15 text-secondary" : "bg-error/15 text-error"
                  }`}
                >
                  {m.ok ? "Applied" : "Missing"}
                </span>
              </div>
            ))}
          </div>
          {migrations.some((m) => !m.ok) && (
            <p className="text-error text-sm mt-3 max-w-2xl">
              A missing migration silently disables its features — e.g. without
              0005, per-product shipping fees are dropped on save and the
              default fee applies. Run the matching file from{" "}
              <code className="text-secondary">supabase/migrations/</code> in the
              Supabase SQL Editor (all are safe to re-run), then re-save any
              affected products.
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-4">
          Payment log — last {orders.length} orders
        </h2>
        <div className="bg-surface-container border border-white/10 rounded-lg divide-y divide-white/5 overflow-x-auto">
          {orders.length === 0 ? (
            <p className="p-6 text-on-surface-variant">No orders yet.</p>
          ) : (
            orders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-white/5 min-w-[640px]"
              >
                <span className="font-headline-md text-white">{o.order_number}</span>
                <span className="text-on-surface-variant text-sm truncate">{o.email}</span>
                <span className="text-on-surface-variant text-xs uppercase tracking-widest">
                  {paymentMethod(o)}
                </span>
                <span
                  className={`font-label-bold uppercase tracking-widest text-[10px] px-2 py-1 rounded ${
                    STATUS_STYLE[o.status] ?? "bg-white/10 text-on-surface-variant"
                  }`}
                >
                  {o.status}
                </span>
                <span className="text-white font-label-bold text-right">
                  {formatMoney(o.total_cents, o.currency)}
                </span>
              </Link>
            ))
          )}
        </div>
        <p className="text-on-surface-variant text-xs mt-3">
          Pending = placed, awaiting payment confirmation. Paid = payment
          captured and receipt emailed. A pending order older than an hour
          usually means the buyer abandoned payment.
        </p>
      </section>
    </div>
  );
}
