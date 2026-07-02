"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import { computeTotals } from "@/lib/totals";

const FIELDS = [
  ["first_name", "First name", "col-span-1"],
  ["last_name", "Last name", "col-span-1"],
  ["address", "Address", "col-span-2"],
  ["city", "City", "col-span-1"],
  ["state", "State / Region", "col-span-1"],
  ["zip", "Postal code", "col-span-1"],
  ["country", "Country", "col-span-1"],
  ["phone", "Phone", "col-span-2"],
] as const;

export default function CheckoutPage() {
  const { items, subtotalCents, clear } = useCart();
  const totals = computeTotals(subtotalCents);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [shipping, setShipping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          shipping,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed.");
      clear();
      if (data.url) window.location.href = data.url; // Stripe
      else router.push(`/order-confirmation?order=${data.orderNumber}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-background text-on-surface min-h-screen">
        <SiteHeader />
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-24 text-center">
          <h1 className="font-headline-xl text-headline-xl text-white uppercase">Nothing to check out</h1>
          <Link href="/shop" className="inline-block mt-6 bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest">Shop rigs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <SiteHeader />
      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <h1 className="font-headline-xl text-headline-xl uppercase text-white mb-2">Secure Checkout</h1>
        <p className="text-on-surface-variant font-label-bold uppercase tracking-widest mb-10">Encrypted performance protocol</p>

        <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <section className="bg-surface-container-low p-8 border border-white/10 rounded-lg">
              <h2 className="font-label-bold text-label-bold uppercase tracking-widest text-secondary mb-6">01 — Contact</h2>
              <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="RACER@EDRIFT.COM"
                className="w-full bg-surface-container-highest border border-white/10 text-white p-4 rounded focus:border-secondary focus:ring-0"
              />
            </section>

            <section className="bg-surface-container-low p-8 border border-white/10 rounded-lg">
              <h2 className="font-label-bold text-label-bold uppercase tracking-widest text-secondary mb-6">02 — Shipping</h2>
              <div className="grid grid-cols-2 gap-4">
                {FIELDS.map(([key, label, span]) => (
                  <div key={key} className={span}>
                    <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">{label}</label>
                    <input
                      required={key !== "phone"}
                      value={shipping[key] || ""}
                      onChange={(e) => setShipping((s) => ({ ...s, [key]: e.target.value }))}
                      className="w-full bg-surface-container-highest border border-white/10 text-white p-4 rounded focus:border-secondary focus:ring-0"
                    />
                  </div>
                ))}
              </div>
            </section>

            {error && (
              <p className="bg-error-container/30 border border-error/40 text-error-container px-4 py-3 rounded font-label-bold uppercase tracking-widest text-sm">
                {error}
              </p>
            )}
          </div>

          {/* Summary */}
          <aside className="bg-surface-container border border-white/10 rounded-lg p-6 h-fit space-y-4">
            <h2 className="font-headline-md text-headline-md text-white uppercase">Order</h2>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {items.map((i) => (
                <div key={i.productId} className="flex gap-3 items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={i.imageUrl ?? "/assets/placeholder.svg"} alt={i.name} className="w-14 h-14 object-cover rounded bg-surface-container-high" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-label-bold uppercase truncate">{i.name}</p>
                    <p className="text-on-surface-variant text-xs">Qty {i.qty}</p>
                  </div>
                  <span className="text-white text-sm">{formatMoney(i.priceCents * i.qty)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="flex justify-between text-on-surface-variant"><span>Subtotal</span><span className="text-white">{formatMoney(totals.subtotal)}</span></div>
              <div className="flex justify-between text-on-surface-variant"><span>Shipping</span><span className="text-white">{totals.shipping === 0 ? "FREE" : formatMoney(totals.shipping)}</span></div>
              <div className="flex justify-between text-on-surface-variant"><span>Tax</span><span className="text-white">{formatMoney(totals.tax)}</span></div>
              <div className="flex justify-between font-label-bold uppercase tracking-widest pt-2"><span className="text-white">Total</span><span className="text-secondary text-xl">{formatMoney(totals.total)}</span></div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container text-white py-5 rounded-lg font-label-bold uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "Processing…" : `Pay ${formatMoney(totals.total)}`}
            </button>
            <p className="text-center text-[10px] text-outline uppercase tracking-widest">Encrypted · Powered by Stripe</p>
          </aside>
        </form>
      </main>
    </div>
  );
}
