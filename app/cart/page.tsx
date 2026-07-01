"use client";

import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import { computeTotals } from "@/lib/totals";
import { Icon } from "@/components/Icon";

export default function CartPage() {
  const { items, subtotalCents, setQty, remove } = useCart();
  const totals = computeTotals(subtotalCents);

  return (
    <div className="bg-surface-container-lowest text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <h1 className="font-display-lg text-display-lg-mobile md:text-headline-xl text-white uppercase mb-2">
          The Garage Manifest
        </h1>
        <p className="text-on-surface-variant font-label-bold uppercase tracking-widest mb-10">
          {items.length} {items.length === 1 ? "item" : "items"} staged for deployment
        </p>

        {items.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-lg">
            <Icon name="shopping_cart" className="w-16 h-16 text-outline" />
            <p className="font-headline-md text-2xl uppercase text-white mt-4">Your manifest is empty</p>
            <Link href="/shop" className="inline-block mt-6 bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 transition-all">
              Shop rigs
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-4">
              {items.map((i) => (
                <div key={i.productId} className="flex gap-5 items-center bg-surface-container border border-white/10 rounded-lg p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.imageUrl ?? "/assets/placeholder.svg"} alt={i.name} className="w-24 h-24 object-cover rounded bg-surface-container-high" />
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${i.slug}`} className="text-white font-headline-md text-lg uppercase hover:text-secondary">
                      {i.name}
                    </Link>
                    <p className="text-secondary">{formatMoney(i.priceCents)}</p>
                  </div>
                  <div className="flex items-center border border-white/15 rounded">
                    <button onClick={() => setQty(i.productId, i.qty - 1)} className="px-3 py-2 text-on-surface-variant hover:text-white">−</button>
                    <span className="px-3 text-white">{i.qty}</span>
                    <button onClick={() => setQty(i.productId, i.qty + 1)} className="px-3 py-2 text-on-surface-variant hover:text-white">+</button>
                  </div>
                  <div className="w-28 text-right">
                    <p className="text-white font-label-bold">{formatMoney(i.priceCents * i.qty)}</p>
                    <button onClick={() => remove(i.productId)} className="text-xs text-on-surface-variant hover:text-error uppercase tracking-widest font-label-bold mt-1">Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <aside className="bg-surface-container border border-white/10 rounded-lg p-6 h-fit space-y-4">
              <h2 className="font-headline-md text-headline-md text-white uppercase">Summary</h2>
              <div className="flex justify-between text-on-surface-variant"><span>Subtotal</span><span className="text-white">{formatMoney(totals.subtotal)}</span></div>
              <div className="flex justify-between text-on-surface-variant"><span>Shipping</span><span className="text-white">{totals.shipping === 0 ? "FREE" : formatMoney(totals.shipping)}</span></div>
              <div className="flex justify-between text-on-surface-variant"><span>Tax</span><span className="text-white">{formatMoney(totals.tax)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-4 font-label-bold uppercase tracking-widest">
                <span className="text-white">Total</span><span className="text-secondary text-xl">{formatMoney(totals.total)}</span>
              </div>
              <Link href="/checkout" className="block text-center bg-primary-container text-white py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
                Secure Checkout
              </Link>
              <Link href="/shop" className="block text-center text-on-surface-variant py-2 text-xs font-label-bold uppercase tracking-widest hover:text-white">
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
