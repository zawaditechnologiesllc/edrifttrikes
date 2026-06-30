"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { formatMoney } from "@/lib/format";

export default function CartDrawer() {
  const { items, subtotalCents, setQty, remove, open, setOpen, count } = useCart();

  return (
    <>
      {/* overlay */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[80] bg-black/60 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed top-0 right-0 z-[90] h-full w-full max-w-md bg-surface-container-lowest border-l border-white/10 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="font-headline-md text-headline-md text-white uppercase">
            Your Cart{" "}
            <span className="text-secondary text-base align-top">{count}</span>
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="material-symbols-outlined text-on-surface-variant hover:text-white"
            aria-label="Close cart"
          >
            close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {items.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-on-surface-variant font-label-bold uppercase tracking-widest">
                Your garage manifest is empty
              </p>
              <Link
                href="/shop"
                onClick={() => setOpen(false)}
                className="inline-block mt-6 text-secondary font-label-bold uppercase tracking-widest hover:underline"
              >
                Shop trikes →
              </Link>
            </div>
          ) : (
            items.map((i) => (
              <div key={i.productId} className="flex gap-4 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.imageUrl ?? "/assets/placeholder.svg"}
                  alt={i.name}
                  className="w-20 h-20 object-cover rounded border border-white/10 bg-surface-container"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-label-bold uppercase tracking-wide truncate">
                    {i.name}
                  </p>
                  <p className="text-secondary font-body-md">
                    {formatMoney(i.priceCents)}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center border border-white/15 rounded">
                      <button
                        onClick={() => setQty(i.productId, i.qty - 1)}
                        className="px-2 text-on-surface-variant hover:text-white"
                      >
                        −
                      </button>
                      <span className="px-2 text-sm text-white">{i.qty}</span>
                      <button
                        onClick={() => setQty(i.productId, i.qty + 1)}
                        className="px-2 text-on-surface-variant hover:text-white"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => remove(i.productId)}
                      className="text-xs text-on-surface-variant hover:text-error uppercase tracking-widest font-label-bold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <footer className="p-6 border-t border-white/10 space-y-4">
            <div className="flex justify-between text-white font-label-bold uppercase tracking-widest">
              <span>Subtotal</span>
              <span className="text-secondary">{formatMoney(subtotalCents)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="block text-center bg-primary-container text-white py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
            >
              Checkout
            </Link>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="block text-center text-on-surface-variant py-2 font-label-bold text-xs uppercase tracking-widest hover:text-white"
            >
              View full cart
            </Link>
          </footer>
        )}
      </aside>
    </>
  );
}
