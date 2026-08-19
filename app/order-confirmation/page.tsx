import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import { getOrderByNumber } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import ClearCartOnMount from "./ClearCartOnMount";
import { Icon } from "@/components/Icon";
import OrderTracker from "@/components/storefront/OrderTracker";
import { DutyRow } from "@/components/storefront/DutyNotice";
import { computeDuty } from "@/lib/totals";

export const metadata = { title: "Order Confirmed" };

export default async function OrderConfirmation({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const order = searchParams.order ? await getOrderByNumber(searchParams.order) : null;

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <ClearCartOnMount />
      <SiteHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-margin-mobile md:px-margin-desktop py-16 text-center">
        <Icon name="check_circle" className="w-16 h-16 text-secondary" />
        <h1 className="font-display-lg text-display-lg-mobile md:text-headline-xl text-white uppercase mt-4">
          Order Confirmed
        </h1>
        <p className="text-on-surface-variant font-body-lg mt-3">
          The garage is on it. {order ? `Confirmation sent to ${order.email}.` : "A confirmation email is on its way."}{" "}
          You can follow every step here or on your rider dashboard.
        </p>

        {order && (
          <div className="mt-10 text-left bg-surface-container border border-white/10 rounded-lg p-8">
            <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
              <span className="font-label-bold uppercase tracking-widest text-on-surface-variant">Order</span>
              <span className="font-headline-md text-secondary">{order.order_number}</span>
            </div>
            <div className="space-y-3">
              {(order.items ?? []).map((i) => (
                <div key={i.id} className="flex justify-between text-on-surface-variant">
                  <span>{i.name} × {i.qty}</span>
                  <span className="text-white">{formatMoney(i.price_cents * i.qty, order.currency)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-on-surface-variant"><span>Subtotal</span><span className="text-white">{formatMoney(order.subtotal_cents, order.currency)}</span></div>
              <div className="flex justify-between text-on-surface-variant"><span>Shipping</span><span className="text-white">{order.shipping_cents === 0 ? "FREE" : formatMoney(order.shipping_cents, order.currency)}</span></div>
              <div className="flex justify-between text-on-surface-variant"><span>Tax</span><span className="text-white">{formatMoney(order.tax_cents, order.currency)}</span></div>
              <div className="flex justify-between font-label-bold uppercase tracking-widest pt-2"><span className="text-white">Total</span><span className="text-secondary text-xl">{formatMoney(order.total_cents, order.currency)}</span></div>
              {/* Recomputed from the stored subtotal rather than persisted: the
                  store never collects this, so there is nothing to reconcile —
                  and it keeps the receipt in step with the published rate. */}
              <DutyRow
                duty={computeDuty(order.subtotal_cents)}
                currency={order.currency}
              />
            </div>
          </div>
        )}

        {order && (
          <div className="mt-8 text-left">
            <OrderTracker order={order} />
          </div>
        )}

        <div className="mt-10 flex justify-center gap-4">
          <Link href="/account" className="bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 transition-all">View orders</Link>
          <Link href="/shop" className="border border-white/20 text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:bg-white/5 transition-all">Keep shopping</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
