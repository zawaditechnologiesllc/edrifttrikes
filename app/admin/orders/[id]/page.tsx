export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import { OrderManageForm } from "../OrderStatusForm";
import ConnectAccountForm from "../ConnectAccountForm";
import { OriginPanel } from "../OrderOrigin";
import { loadOrderEvents } from "@/lib/orders";
import {
  STAGE_COPY,
  formatDeliveryDate,
  type FulfillmentStage,
} from "@/lib/fulfillment";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const addr = (order.shipping_address ?? {}) as Record<string, string>;
  const stage = (order.fulfillment_stage ?? "awaiting_payment") as FulfillmentStage;
  const events = await loadOrderEvents(admin, order.id);

  // Who, if anyone, owns this order. Guest checkouts have no account behind
  // them until the buyer registers with the same email.
  const { data: account } = order.user_id
    ? await admin
        .from("profiles")
        .select("id, email, full_name, created_at")
        .eq("id", order.user_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/admin/orders" className="text-on-surface-variant hover:text-white text-sm font-label-bold uppercase tracking-widest">← Orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 mb-8">
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase">{order.order_number}</h1>
        <div className="text-right">
          <p className="font-label-bold text-[10px] uppercase tracking-widest text-on-surface-variant">Delivery stage</p>
          <p className="font-headline-md text-secondary text-lg">{STAGE_COPY[stage].label}</p>
        </div>
      </div>

      <div className="mb-8">
        <OrderManageForm
          orderId={order.id}
          status={order.status}
          stage={stage}
          trackingNumber={order.tracking_number ?? null}
          courier={order.courier ?? null}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-surface-container border border-white/10 rounded-lg p-6">
          <h2 className="font-headline-md text-headline-md text-white uppercase mb-4">Items</h2>
          <div className="divide-y divide-white/5">
            {(order.items ?? []).map((i: { id: string; name: string; qty: number; price_cents: number; color?: string | null }) => (
              <div key={i.id} className="flex justify-between py-3">
                <span className="text-on-surface-variant">
                  {i.name}
                  {i.color && (
                    <span className="text-white"> — {i.color}</span>
                  )}{" "}
                  × {i.qty}
                </span>
                <span className="text-white">{formatMoney(i.price_cents * i.qty, order.currency)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-on-surface-variant"><span>Subtotal</span><span className="text-white">{formatMoney(order.subtotal_cents, order.currency)}</span></div>
            <div className="flex justify-between text-on-surface-variant"><span>Shipping</span><span className="text-white">{formatMoney(order.shipping_cents, order.currency)}</span></div>
            <div className="flex justify-between text-on-surface-variant"><span>Tax</span><span className="text-white">{formatMoney(order.tax_cents, order.currency)}</span></div>
            <div className="flex justify-between font-label-bold uppercase tracking-widest pt-1"><span className="text-white">Total</span><span className="text-secondary text-lg">{formatMoney(order.total_cents, order.currency)}</span></div>
          </div>
        </div>
        <div className="bg-surface-container border border-white/10 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-1">Customer</h3>
            <p className="text-white break-all">{order.email}</p>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-2">Account</h3>
            {account ? (
              <>
                <p className="text-white text-sm">
                  {(account.full_name as string) || "Registered rider"}
                </p>
                <p className="text-on-surface-variant text-xs break-all">
                  {account.email as string}
                </p>
                <p className="text-secondary text-[10px] uppercase tracking-widest font-label-bold mt-2">
                  Linked — visible on their dashboard
                </p>
              </>
            ) : (
              <ConnectAccountForm orderId={order.id} email={order.email} />
            )}
          </div>
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-1">Ship to</h3>
            <p className="text-white text-sm leading-relaxed">
              {[addr.first_name, addr.last_name].filter(Boolean).join(" ")}<br />
              {addr.address}<br />
              {addr.address2 && <>{addr.address2}<br /></>}
              {[addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}<br />
              {addr.country}
              {addr.phone && (
                <>
                  <br />
                  <span className="text-on-surface-variant">{addr.phone}</span>
                </>
              )}
            </p>
          </div>
          {order.paid_at && (
            <div>
              <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-1">Delivery estimate</h3>
              <p className="text-white text-sm">{formatDeliveryDate(order.estimated_delivery_at)}</p>
              <p className="text-on-surface-variant text-xs mt-1">
                Paid {new Date(order.paid_at).toLocaleDateString()}
              </p>
            </div>
          )}
          {order.tracking_number && (
            <div>
              <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-1">Tracking</h3>
              <p className="text-white text-sm break-all">{order.tracking_number}</p>
              {order.courier && <p className="text-on-surface-variant text-xs">{order.courier}</p>}
            </div>
          )}
          {events.length > 0 && (
            <div>
              <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-2">Timeline</h3>
              <ol className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="text-white">{e.title}</span>
                    <span className="block text-on-surface-variant text-xs">
                      {new Date(e.created_at).toLocaleString()}
                      {e.email_sent ? " · emailed" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Below the fold on purpose: the order list already flags anything worth
          a second look, so this is the page you come to in order to READ it,
          not something that has to compete with the items and the total. */}
      <div className="mt-6">
        <OriginPanel order={order} />
      </div>
    </div>
  );
}