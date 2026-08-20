export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import { getCurrentProfile, getMyOrders } from "@/lib/db";
import { supabaseConfigured } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { signOut } from "@/app/login/actions";
import OrderTracker from "@/components/storefront/OrderTracker";
import { STAGE_COPY, type FulfillmentStage } from "@/lib/fulfillment";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Rider Dashboard" };

const STATUS_COLOR: Record<string, string> = {
  pending: "text-signal-orange",
  paid: "text-secondary",
  fulfilled: "text-primary",
  cancelled: "text-error",
  refunded: "text-outline",
};

export default async function AccountPage() {
  if (!supabaseConfigured()) {
    return (
      <div className="bg-background min-h-screen">
        <SiteHeader />
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-24 text-center">
          <h1 className="font-headline-xl text-headline-xl text-white uppercase">Connect Supabase</h1>
          <p className="text-on-surface-variant mt-3">Add your Supabase env vars to enable rider accounts.</p>
        </div>
      </div>
    );
  }

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const orders = await getMyOrders();

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
          <div>
            <p className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">Rider Dashboard</p>
            <h1 className="font-display-lg text-display-lg-mobile md:text-headline-xl text-white uppercase leading-none mt-1">
              {profile.full_name || "Welcome, rider"}
            </h1>
            <p className="text-on-surface-variant mt-2">{profile.email}</p>
          </div>
          <div className="flex gap-3">
            {profile.role === "admin" && (
              <Link href="/admin" className="bg-secondary text-on-secondary-fixed px-6 py-3 rounded font-label-bold uppercase tracking-widest text-sm hover:brightness-105">
                Admin
              </Link>
            )}
            <form action={signOut}>
              <button className="border border-white/20 text-white px-6 py-3 rounded font-label-bold uppercase tracking-widest text-sm hover:bg-white/5">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <h2 className="font-headline-md text-headline-md text-white uppercase mb-6">Order History</h2>
        {orders.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-lg py-16 px-6 text-center">
            <p className="text-on-surface-variant uppercase tracking-widest font-label-bold">No orders yet</p>
            {/* The one case the automatic matching cannot cover: they checked
                out with a different address than they registered with. Say so
                plainly, and name the address we are matching on, rather than
                leaving them to conclude their order vanished. */}
            <p className="text-outline text-sm mt-4 max-w-md mx-auto leading-relaxed">
              Orders you placed as a guest with{" "}
              <span className="text-on-surface-variant">{profile.email}</span> appear
              here automatically. Bought using a different email address? Email{" "}
              <a
                href={`mailto:${COMPANY.supportEmail}`}
                className="text-secondary hover:underline"
              >
                {COMPANY.supportEmail}
              </a>{" "}
              with your order number and we&apos;ll connect it.
            </p>
            <Link href="/shop" className="inline-block mt-6 text-secondary font-label-bold uppercase tracking-widest hover:underline">Start your build →</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="bg-surface-container border border-white/10 rounded-lg p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
                  <span className="font-headline-md text-lg text-white">{o.order_number}</span>
                  <span className={`font-label-bold uppercase tracking-widest text-sm ${STATUS_COLOR[o.status] || "text-on-surface-variant"}`}>
                    {/* Once paid, the delivery stage is what the rider actually
                        cares about — "paid" tells them nothing they don't know. */}
                    {o.paid_at
                      ? STAGE_COPY[(o.fulfillment_stage ?? "confirmed") as FulfillmentStage].label
                      : o.status}
                  </span>
                  <span className="text-on-surface-variant text-sm">{new Date(o.created_at).toLocaleDateString()}</span>
                  <span className="text-secondary font-label-bold">{formatMoney(o.total_cents, o.currency)}</span>
                </div>
                <p className="text-on-surface-variant text-sm">
                  {(o.items ?? [])
                    .map((i) => `${i.name}${i.color ? ` (${i.color})` : ""} × ${i.qty}`)
                    .join("  ·  ")}
                </p>

                {/* Live delivery tracking, from payment through to collection. */}
                <div className="mt-6">
                  <OrderTracker order={o} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}