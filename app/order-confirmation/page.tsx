import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import { getReceiptByNumber } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import ClearCartOnMount from "./ClearCartOnMount";
import { Icon } from "@/components/Icon";
import OrderTracker from "@/components/storefront/OrderTracker";
import { confirmationView } from "@/lib/payment-return";

// Deliberately generic: the page is not always a confirmation. An
// Authorize.Net payment held for review lands here unpaid, and a tab titled
// "Order Confirmed" over that would be the same lie the body used to tell.
export const metadata = { title: "Your order" };

export default async function OrderConfirmation({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ order?: string; payment?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  // Works for a guest who has just paid as well as a signed-in rider; the
  // guest copy has personal details stripped. See getReceiptByNumber.
  const receipt = searchParams.order
    ? await getReceiptByNumber(searchParams.order)
    : null;
  const order = receipt?.order ?? null;

  /**
   * THE ORDER'S STORED STATUS DECIDES WHAT THIS PAGE SAYS. `payment` is a hint
   * from the gateway's return handler that only refines the wording — it comes
   * back through the buyer's browser, so it can never promote an unpaid order
   * to a confirmed one. See lib/payment-return.ts.
   */
  const view = confirmationView(order?.status, searchParams.payment);

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      {/* The order exists either way, so the cart is cleared either way —
          leaving it full invites a second order for goods already on the
          books, which is the one outcome worse than an unclear status. */}
      <ClearCartOnMount />
      <SiteHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-margin-mobile md:px-margin-desktop py-16 text-center">
        <Icon name={view.icon} className={`w-16 h-16 ${view.accent}`} />
        <h1 className="font-display-lg text-display-lg-mobile md:text-headline-xl text-white uppercase mt-4">
          {view.title}
        </h1>
        <p className="text-on-surface-variant font-body-lg mt-3">
          {view.message}
        </p>
        {order && (
          <p className="text-on-surface-variant font-body-lg mt-2">
            {view.settled
              ? `Confirmation sent to ${order.email}.`
              : `We'll email ${order.email} as soon as this changes.`}
          </p>
        )}

        {order && (
          <div className="mt-10 text-left bg-surface-container border border-white/10 rounded-lg p-8">
            <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
              <span className="font-label-bold uppercase tracking-widest text-on-surface-variant">Order</span>
              <span className="font-headline-md text-secondary">{order.order_number}</span>
            </div>
            <div className="space-y-3">
              {(order.items ?? []).map((i) => (
                <div key={i.id} className="flex justify-between text-on-surface-variant">
                  <span>{i.name}{i.color ? ` — ${i.color}` : ""} × {i.qty}</span>
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
            </div>
          </div>
        )}

        {order && view.settled && (
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
