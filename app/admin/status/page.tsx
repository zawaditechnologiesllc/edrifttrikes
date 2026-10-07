export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, serverEnv } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";
import StorageCacheButton from "./StorageCacheButton";
import { getSiteSettings } from "@/lib/db";
import { trustGaps } from "@/lib/seo";
import { checkStoredLogo } from "@/lib/logo";
import { authorizeNetConfigured, authorizeNetEnv } from "@/lib/authorize-net";
import { describeStripeAccount } from "@/lib/stripe-account";
import { getStripe } from "@/lib/stripe";
import { learnedAdjustments } from "@/lib/stripe-checkout";

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
  const settings = await getSiteSettings();
  const gaps = trustGaps(settings);
  // Checked live rather than assumed: the product sheet falls back to a text
  // watermark on ANY logo failure, so "no logo on the PDF" has three completely
  // different causes and looked identical from the admin.
  const logo = await checkStoredLogo(settings.logo_url);
  const stripeOk = Boolean(serverEnv("STRIPE_SECRET_KEY"));
  const paypalOk = Boolean(serverEnv("PAYPAL_CLIENT_ID") && serverEnv("PAYPAL_SECRET"));
  const anetOk = authorizeNetConfigured();

  const config = [
    { label: "Supabase URL", ok: Boolean(supabaseUrl()) },
    { label: "Supabase anon key", ok: Boolean(supabaseAnonKey()) },
    { label: "Supabase service role (admin)", ok: Boolean(supabaseServiceRoleKey()) },
    { label: "Render backend URL (emails)", ok: Boolean(serverEnv("RENDER_API_URL")) },
    { label: "Internal API key (emails)", ok: Boolean(serverEnv("INTERNAL_API_KEY")) },
    { label: "Stripe (card payments)", ok: stripeOk },
    { label: "PayPal", ok: paypalOk },
    {
      // The environment is worth saying out loud: a sandbox account looks
      // configured from every angle and takes no real money.
      label: anetOk
        ? `Authorize.Net (${authorizeNetEnv()})`
        : "Authorize.Net",
      ok: anetOk,
    },
    { label: "Turnstile (form bot protection)", ok: Boolean(serverEnv("TURNSTILE_SECRET_KEY")) },
  ];
  const checkoutLive = stripeOk || paypalOk || anetOk;

  /**
   * What the connected Stripe account has switched on, and what our Checkout
   * Sessions had to be adjusted to. Read live, because the whole point is to
   * answer "what is different about THIS account?" the moment one is attached.
   *
   * Never throws (see lib/stripe-account.ts) — a diagnostic must not be able
   * to break the page it reports on.
   */
  const stripeAccount = stripeOk
    ? await describeStripeAccount()
    : { ok: false as const, error: "no Stripe secret key configured" };
  const liveStripe = getStripe();
  const sessionShape = liveStripe ? learnedAdjustments(liveStripe as object) : [];

  let orders: Order[] = [];
  // Probe one column per migration — a failed select means that migration
  // hasn't been run in THIS database, which silently disables its features
  // (e.g. per-product shipping fees falling back to the default).
  const migrations: { label: string; ok: boolean }[] = [];
  if (adminConfigured()) {
    const admin = createAdminClient();
    const columnExists = async (table: string, column: string) =>
      !(await admin.from(table).select(column).limit(1)).error;
    const [m3, m4a, m4b, m5, m6, m12, m13, m15, m16, m17, m18, m19, m20, m21, { data }] = await Promise.all([
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
      columnExists("orders", "paid_at"),
      columnExists("products", "colors"),
      columnExists("site_settings", "logo_url"),
      columnExists("orders", "risk_level"),
      columnExists("site_settings", "statement_descriptor"),
      columnExists("site_settings", "dba_name"),
      columnExists("orders", "gateway_reference"),
      columnExists("site_settings", "authorizenet_account"),
      /*
       * 0020 renames a category rather than adding a column, so the probe is
       * its effect: a `gear` slug still present means the rename has not run.
       * A shop that never had one reads as done, which is correct — there is
       * nothing for it to do there.
       */
      admin
        .from("categories")
        .select("id", { count: "exact", head: true })
        .eq("slug", "gear")
        .then((r) => (r.error ? false : (r.count ?? 0) === 0)),
      columnExists("categories", "active"),
      admin.from("orders").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    migrations.push(
      { label: "0003 — featured flag + site settings", ok: m3 },
      { label: "0004 — store shipping fee + Tech Lab articles", ok: m4a && m4b },
      { label: "0005 — per-product shipping fee", ok: m5 },
      { label: "0006 — fulfilment tracking + stage emails", ok: m6 },
      { label: "0012 — product colours", ok: m12 },
      { label: "0013 — store logo for product sheets", ok: m13 },
      { label: "0015 — order origin + fraud review", ok: m15 },
      { label: "0016 — statement descriptor on card charges", ok: m16 },
      { label: "0017 — invoice identity (DBA, tax ID) + invoices", ok: m17 },
      { label: "0018 — gateway reference + account on orders", ok: m18 },
      // Inverted on purpose: 0019 DROPS a column, so "run" means it is gone.
      { label: "0019 — Authorize.Net account picker removed", ok: !m19 },
      { label: "0020 — Gear category renamed to Dirt Bikes", ok: m20 },
      { label: "0021 — switch a category on or off", ok: m21 }
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

      {/*
        THE STRIPE ACCOUNT ITSELF.
        Here because every "checkout is unavailable" incident so far has come
        down to a difference between two Stripe accounts, and the only way to
        see it used to be the Stripe request logs. Feature flags are read by
        shape, not by name, so a product Stripe rolls out after this was
        written still appears — which is how Managed Payments would have been
        visible before it caused a 400.
      */}
      {stripeOk && (
        <section>
          <h2 className="font-headline-md text-headline-md text-white uppercase mb-2">
            Stripe account
          </h2>
          <p className="text-on-surface-variant text-sm mb-4 max-w-2xl">
            Read live from Stripe. Booleans and names only — no key, no
            business or personal details.
          </p>

          {!stripeAccount.ok ? (
            <p className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-error text-sm">
              Could not read the account: {stripeAccount.error}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Chip ok={stripeAccount.chargesEnabled !== false} label="Charges enabled" />
                <Chip ok={stripeAccount.payoutsEnabled !== false} label="Payouts enabled" />
                <div className="flex items-center justify-between bg-surface-container border border-white/10 rounded-lg px-4 py-3">
                  <span className="text-on-surface-variant text-sm">Account country / currency</span>
                  <span className="text-white font-label-bold uppercase tracking-widest text-[10px]">
                    {stripeAccount.country ?? "—"} / {stripeAccount.defaultCurrency ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-surface-container border border-white/10 rounded-lg px-4 py-3">
                  <span className="text-on-surface-variant text-sm">Checkout Session shape</span>
                  <span className="text-white text-[11px] text-right">
                    {sessionShape.length === 0 ? "as sent — no adjustment needed" : sessionShape.join(", ")}
                  </span>
                </div>
              </div>

              {/*
                The one that matters when an account misbehaves: every
                `{ enabled: boolean }` toggle Stripe returned, whatever it is
                called and whenever it was introduced.
              */}
              {stripeAccount.featureFlags && Object.keys(stripeAccount.featureFlags).length > 0 && (
                <div>
                  <h3 className="font-label-bold text-label-bold text-white uppercase tracking-widest mb-2">
                    Features switched on
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stripeAccount.featureFlags).map(([name, on]) => (
                      <span
                        key={name}
                        className={`rounded border px-2 py-1 text-[11px] font-mono ${
                          on
                            ? "border-secondary/40 bg-secondary/10 text-secondary"
                            : "border-white/15 text-on-surface-variant"
                        }`}
                      >
                        {name}: {on ? "on" : "off"}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {stripeAccount.capabilities && Object.keys(stripeAccount.capabilities).length > 0 && (
                <details className="bg-surface-container border border-white/10 rounded-lg px-4 py-3">
                  <summary className="text-on-surface-variant text-sm cursor-pointer">
                    Payment capabilities ({Object.keys(stripeAccount.capabilities).length})
                  </summary>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(stripeAccount.capabilities).map(([name, status]) => (
                      <span
                        key={name}
                        className={`rounded border px-2 py-1 text-[11px] font-mono ${
                          status === "active"
                            ? "border-secondary/40 bg-secondary/10 text-secondary"
                            : "border-signal-orange/40 bg-signal-orange/10 text-signal-orange"
                        }`}
                      >
                        {name}: {status}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-2">
          Image caching
        </h2>
        <p className="text-on-surface-variant text-sm max-w-2xl mb-4">
          New product images are cached for a year and auto-optimized to WebP on
          upload — so on a <span className="text-white">fresh project you never
          need this button</span>. It exists only to fix images uploaded{" "}
          <em>before</em> those changes, which kept Supabase&apos;s old 1-hour
          cache.
        </p>
        <p className="text-signal-orange text-sm max-w-2xl mb-4">
          ⚠️ Heads up: re-stamping <strong>downloads and re-uploads every
          image</strong>, which itself uses Storage egress. Run it{" "}
          <strong>once</strong> for a batch of old images — never repeatedly, and
          not while you&apos;re trying to stay under an egress limit.
        </p>
        <StorageCacheButton />
      </section>

      <section>
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-2">
          Export / backup catalog
        </h2>
        <p className="text-on-surface-variant text-sm max-w-2xl mb-4">
          Download every product (with its category, gallery images and specs),
          plus articles and store settings, as one JSON file. It reads only text
          rows — it does <span className="text-white">not</span> download any
          image files, so it costs no Storage egress and is safe to run even
          while you&apos;re over quota. Use it to back up, or to rebuild the
          store in a fresh Supabase project — then re-upload the images there
          (the product form auto-optimizes them to cut egress). Image URLs in
          the file still point at this project.
        </p>
        <a
          href="/api/admin/export"
          download="edrift-catalog.json"
          className="inline-block bg-secondary text-on-secondary-fixed px-6 py-3 rounded-lg font-label-bold uppercase tracking-widest text-sm hover:brightness-105 active:scale-95 transition-all"
        >
          Download catalog (JSON)
        </a>
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

      <section className="mt-8">
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-2">
          Store logo on product sheets
        </h2>
        <div
          className={`bg-surface-container border rounded-lg p-4 flex items-start gap-3 ${
            logo.state === "ok" ? "border-secondary/40" : "border-signal-orange/50"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
              logo.state === "ok" ? "border-secondary bg-secondary/30" : "border-signal-orange"
            }`}
          />
          <div>
            <p className={logo.state === "ok" ? "text-white text-sm" : "text-signal-orange text-sm"}>
              {logo.state === "ok" ? "Logo is working" : "Logo is not printing"}
            </p>
            <p className="text-on-surface-variant text-xs mt-1 leading-relaxed max-w-2xl">
              {logo.detail}
            </p>
            {settings.logo_url && (
              <p className="text-outline text-[11px] mt-2 break-all">{settings.logo_url}</p>
            )}
          </div>
        </div>
      </section>

      {/*
        The things that actually decide whether a scanner calls a new shop
        legitimate. Every one is a five-minute job for the owner and impossible
        for anyone else to do for them, which is why they belong on a screen
        rather than in a document nobody opens.
      */}
      <section className="mt-8">
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-2">
          Looking legitimate
        </h2>
        <p className="text-on-surface-variant text-sm mb-4 max-w-2xl leading-relaxed">
          Sites that rate new shops — and the buyers who check them — look for
          business details that resolve to something real. A missing detail
          scores lower than a filled-in one; a{" "}
          <strong className="text-white">placeholder scores lowest of all</strong>,
          because a checker follows it and finds nothing. Anything unticked here
          is left out of the site&apos;s structured data rather than published as
          fact.
        </p>
        <div className="bg-surface-container border border-white/10 rounded-lg divide-y divide-white/5">
          {gaps.map((gap) => (
            <div key={gap.key} className="flex items-start gap-3 p-4">
              <span
                aria-hidden="true"
                className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                  gap.done ? "border-secondary bg-secondary/30" : "border-signal-orange"
                }`}
              />
              <div>
                <p className={gap.done ? "text-white text-sm" : "text-signal-orange text-sm"}>
                  {gap.label}
                  {gap.done && <span className="text-secondary text-xs"> · set</span>}
                </p>
                {!gap.done && (
                  <p className="text-on-surface-variant text-xs mt-1 leading-relaxed max-w-xl">
                    {gap.why}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-on-surface-variant text-xs mt-3 max-w-2xl leading-relaxed">
          Contact details live in{" "}
          <Link href="/admin/settings" className="text-secondary hover:underline">
            Settings
          </Link>
          ; the legal entity name and governing law are in{" "}
          <code className="text-secondary">lib/company.ts</code>. Beyond this
          screen, the things that move the score most are a claimed Google
          Business Profile, a real review platform collecting real reviews, and
          public WHOIS rather than privacy-shielded registration.
        </p>
      </section>
    </div>
  );
}
