"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import { useCart } from "@/components/cart/CartProvider";
import { useSiteSettings } from "@/components/storefront/SiteSettingsProvider";
import { formatMoney } from "@/lib/format";
import { computeCartTotals } from "@/lib/totals";
import PayPalCardFields from "@/components/cart/PayPalCardFields";
import CheckoutField from "./CheckoutField";
import { CHECKOUT_FIELDS, validateCheckout } from "@/lib/validation";
import { ESTIMATED_DELIVERY_DAYS } from "@/lib/fulfillment";

type PaymentMethod = "stripe" | "paypal" | "";

export default function CheckoutClient({
  methods,
  paypalCardFields = false,
}: {
  methods: { stripe: boolean; paypal: boolean };
  paypalCardFields?: boolean;
}) {
  const { items, clear } = useCart();
  const settings = useSiteSettings();
  const totals = computeCartTotals(
    items.map((i) => ({
      price_cents: i.priceCents,
      qty: i.qty,
      shipping_cents: i.shippingCents,
      free_shipping: i.freeShipping,
    })),
    settings
  );
  const noPayments = !methods.stripe && !methods.paypal;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [shipping, setShipping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A field is "touched" once the buyer has left it. Errors only render for
  // touched fields, so the form doesn't turn red before anyone has typed.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Live validation of everything, recomputed each render. Cheap (a handful of
  // regexes) and it keeps the pay button's disabled state honest.
  const validation = validateCheckout({ email, shipping });

  const markTouched = (name: string) =>
    setTouched((t) => (t[name] ? t : { ...t, [name]: true }));

  /**
   * Reveal every problem at once and jump to the first one.
   *
   * Called when the buyer tries to pay with an incomplete form. Marking
   * everything touched is what turns the silent fields red; scrolling means
   * they don't have to hunt for the offending input on a long form.
   */
  function revealErrors(v: typeof validation): void {
    const all: Record<string, boolean> = { email: true };
    for (const f of CHECKOUT_FIELDS) all[f.name] = true;
    setTouched(all);
    if (!v.firstErrorField) return;
    if (typeof document === "undefined") return;
    const el = document.getElementById(v.firstErrorField);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLInputElement | null)?.focus({ preventScroll: true });
  }

  // Show a chooser only when more than one method is connected. Otherwise use
  // whichever single method is connected (or fall back to the direct/email path).
  const both = methods.stripe && methods.paypal;
  const initialMethod: PaymentMethod = methods.stripe
    ? "stripe"
    : methods.paypal
      ? "paypal"
      : "";
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Catch it here rather than letting the server bounce it back — the buyer
    // gets the problem highlighted on the exact field instead of one line of
    // red text at the bottom of the page.
    if (!validation.ok) {
      revealErrors(validation);
      setError(validation.firstErrorMessage);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          shipping,
          method,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The server validates independently. If it rejected a field, surface
        // it on that field rather than as an anonymous failure.
        if (data.field) {
          setTouched((t) => ({ ...t, [data.field]: true }));
          document.getElementById(data.field)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
        throw new Error(data.error || "Checkout failed.");
      }
      // NOTE: the cart is deliberately NOT cleared here. The buyer is about to
      // be handed to Stripe/PayPal and may well come back without paying —
      // emptying their cart at that point loses the sale. The confirmation
      // page clears it once payment has actually gone through
      // (app/order-confirmation/ClearCartOnMount.tsx).
      if (data.url) window.location.href = data.url; // Stripe or PayPal
      else {
        clear();
        router.push(`/order-confirmation?order=${data.orderNumber}`);
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  // Inline PayPal card fields (opt-in) — shown for the PayPal path instead of a
  // redirect, so buyers enter their card on this page with no account prompt.
  const showCardFields = paypalCardFields && method === "paypal";
  /**
   * Gate for the inline card fields. Returns the specific problem rather than
   * "fill in all shipping fields above" — and highlights it, so the buyer isn't
   * left scanning the form for whatever is missing.
   */
  const validatePayment = (): string | null => {
    if (validation.ok) return null;
    revealErrors(validation);
    return validation.firstErrorMessage;
  };
  const cardPayload = () => ({
    email,
    shipping,
    items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
  });
  const onCardPaid = (orderNumber: string) => {
    clear();
    router.push(`/order-confirmation?order=${orderNumber}`);
  };

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

  const payLabel = noPayments
    ? "Checkout paused"
    : loading
      ? "Processing…"
      : method === "paypal"
        ? "Pay with PayPal or card"
        : `Pay ${formatMoney(totals.total)} securely`;

  // Mirrors the real journey in lib/fulfillment.ts — the emails a buyer
  // actually receives. Quoting a different window here than the one the system
  // then emails them is how a store ends up arguing with its own customers.
  const STEPS = [
    ["1", "Place your order", "Pay securely by card or PayPal. Receipt emailed straight away."],
    ["2", "Payment confirmed", "We confirm and start preparing your build."],
    ["3", "Shipped", "Leaves the garage in about 3 days. Tracking is emailed."],
    [
      "4",
      "Delivery",
      `Around ${ESTIMATED_DELIVERY_DAYS} days, tracked at every step on your dashboard.`,
    ],
  ] as const;

  const methodBtn = (active: boolean) =>
    `flex items-center justify-center gap-2 rounded-lg border py-3 px-3 text-sm font-label-bold uppercase tracking-widest transition-all ${
      active
        ? "border-secondary bg-secondary/10 text-white"
        : "border-white/10 bg-surface-container-highest text-on-surface-variant hover:border-white/30"
    }`;

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <SiteHeader />
      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <h1 className="font-headline-xl text-headline-xl uppercase text-white mb-2">Secure Checkout</h1>
        <p className="text-on-surface-variant font-label-bold uppercase tracking-widest mb-8">Encrypted performance protocol</p>

        {/* What happens after you order — keeps the process unambiguous. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {STEPS.map(([n, title, body]) => (
            <div key={n} className="bg-surface-container-low border border-white/10 rounded-lg p-4">
              <p className="text-secondary font-headline-md text-lg">{n}</p>
              <p className="text-white font-label-bold uppercase tracking-widest text-xs mt-1">{title}</p>
              <p className="text-on-surface-variant text-xs mt-1">{body}</p>
            </div>
          ))}
        </div>

        {noPayments && (
          <div className="mb-10 bg-signal-orange/10 border border-signal-orange/50 rounded-lg p-6">
            <p className="text-signal-orange font-label-bold uppercase tracking-widest text-sm">
              Checkout temporarily paused
            </p>
            <p className="text-on-surface-variant mt-2">
              We&apos;re receiving a very high volume of orders right now. Your cart is
              saved — please try again in a few hours.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <section className="bg-surface-container-low p-6 sm:p-8 border border-white/10 rounded-lg">
              <h2 className="font-label-bold text-label-bold uppercase tracking-widest text-secondary mb-1">01 — Contact</h2>
              <p className="text-on-surface-variant text-sm mb-6">
                We send your receipt and every delivery update to this address.
              </p>
              <label
                htmlFor="email"
                className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest"
              >
                Email address <span className="text-secondary ml-1">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                aria-describedby={
                  touched.email && validation.errors.email ? "email-error" : "email-hint"
                }
                aria-invalid={(touched.email && Boolean(validation.errors.email)) || undefined}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => markTouched("email")}
                placeholder="you@example.com"
                className={`w-full bg-surface-container-highest border text-white p-4 rounded focus:ring-0 placeholder:text-outline transition-colors ${
                  touched.email && validation.errors.email
                    ? "border-error focus:border-error"
                    : "border-white/10 focus:border-secondary"
                }`}
              />
              {touched.email && validation.errors.email ? (
                <p id="email-error" className="text-error text-xs mt-1.5">
                  {validation.errors.email}
                </p>
              ) : (
                <p id="email-hint" className="text-outline text-xs mt-1.5">
                  Double-check it — a typo here means you never get your tracking updates.
                </p>
              )}
            </section>

            <section className="bg-surface-container-low p-6 sm:p-8 border border-white/10 rounded-lg">
              <h2 className="font-label-bold text-label-bold uppercase tracking-widest text-secondary mb-1">02 — Shipping address</h2>
              <p className="text-on-surface-variant text-sm mb-6">
                Where the rig is delivered. Fields marked{" "}
                <span className="text-secondary">*</span> are required — your browser
                can fill most of this for you.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                {CHECKOUT_FIELDS.map((spec) => (
                  <CheckoutField
                    key={spec.name}
                    spec={spec}
                    value={shipping[spec.name] || ""}
                    error={validation.errors[spec.name]}
                    touched={Boolean(touched[spec.name])}
                    // No need to re-check on change: the field renders an error
                    // only while `touched && error`, so correcting the value
                    // clears the message on the very next keystroke.
                    onChange={(value) =>
                      setShipping((prev) => ({ ...prev, [spec.name]: value }))
                    }
                    onBlur={() => markTouched(spec.name)}
                  />
                ))}
              </div>
            </section>

            {error && (
              <p
                role="alert"
                className="bg-error-container/30 border border-error/40 text-error-container px-4 py-3 rounded text-sm"
              >
                {error}
              </p>
            )}
          </div>

          {/* Summary */}
          <aside className="bg-surface-container border border-white/10 rounded-lg p-6 h-fit space-y-4">
            <h2 className="font-label-bold text-label-bold uppercase tracking-widest text-secondary">03 — Review &amp; Pay</h2>
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

            {both && (
              <div className="space-y-2 pt-1">
                <p className="block text-[10px] font-label-bold text-on-surface-variant uppercase tracking-widest">Payment method</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMethod("stripe")} className={methodBtn(method === "stripe")}>Card</button>
                  <button type="button" onClick={() => setMethod("paypal")} className={methodBtn(method === "paypal")}>PayPal</button>
                </div>
              </div>
            )}

            {showCardFields ? (
              <>
                {/* Inline card entry — no redirect, no account prompt. */}
                <PayPalCardFields
                  getPayload={cardPayload}
                  validate={validatePayment}
                  amountLabel={formatMoney(totals.total)}
                  onPaid={onCardPaid}
                />
                {/* Secondary: pay with a PayPal balance/account via the redirect. */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full border border-white/15 text-on-surface-variant py-3 rounded-lg font-label-bold text-xs uppercase tracking-widest hover:text-white hover:border-white/30 transition-all disabled:opacity-50"
                >
                  {loading ? "Processing…" : "Or pay with a PayPal account"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={loading || noPayments}
                  className="w-full bg-primary-container text-white py-5 rounded-lg font-label-bold uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {payLabel}
                </button>
                <p className="text-center text-[10px] text-outline uppercase tracking-widest">
                  {noPayments
                    ? "High order volume — try again in a few hours"
                    : method === "paypal"
                      ? "Encrypted · PayPal & cards accepted"
                      : "Encrypted · Powered by Stripe"}
                </p>
              </>
            )}
          </aside>
        </form>
      </main>
    </div>
  );
}
