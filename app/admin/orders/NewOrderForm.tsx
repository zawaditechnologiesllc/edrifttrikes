"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createManualOrder, type ManualOrderState } from "../actions";
import { MANUAL_ORDER_STATUSES, MAX_MANUAL_ITEMS } from "@/lib/manual-order";
import { formatMoney } from "@/lib/format";

export type PickerProduct = {
  id: string;
  name: string;
  slug: string | null;
  price_cents: number;
  hero_image: string | null;
  status: string;
};

type Line = {
  /** Stable across re-orders so React does not reuse the wrong input. */
  key: number;
  productId: string;
  name: string;
  price: string;
  qty: string;
  slug: string;
  imageUrl: string;
  color: string;
};

const input =
  "w-full bg-surface-container-highest border border-white/10 text-white p-3 rounded focus:border-secondary focus:ring-0";
const lbl =
  "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

let nextKey = 1;
const blankLine = (): Line => ({
  key: nextKey++,
  productId: "",
  name: "",
  price: "",
  qty: "1",
  slug: "",
  imageUrl: "",
  color: "",
});

/** Dollars as typed → cents, mirroring the server's signedDollarsToCents. */
function cents(value: string): number | null {
  const raw = value.trim();
  if (!raw) return 0;
  const negative = raw.startsWith("-");
  const cleaned = (negative ? raw.slice(1) : raw).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Math.round(Number(cleaned) * 100);
  return negative ? -n : n;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-secondary text-on-secondary-fixed px-6 py-3 rounded font-label-bold uppercase tracking-widest hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create order"}
    </button>
  );
}

export default function NewOrderForm({
  products,
  countries,
  defaultShippingCents,
  taxRateBps,
}: {
  products: PickerProduct[];
  countries: string[];
  defaultShippingCents: number;
  taxRateBps: number;
}) {
  const [state, action] = useActionState<ManualOrderState, FormData>(
    createManualOrder,
    {}
  );

  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [status, setStatus] = useState<string>("paid");
  const [shippingFee, setShippingFee] = useState<string>(
    (defaultShippingCents / 100).toFixed(2)
  );
  const [tax, setTax] = useState<string>("");

  const update = (key: number, patch: Partial<Line>) =>
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /** Picking a product fills the line in; every field stays editable after. */
  const choose = (key: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) {
      update(key, { productId: "" });
      return;
    }
    update(key, {
      productId: p.id,
      name: p.name,
      price: (p.price_cents / 100).toFixed(2),
      slug: p.slug ?? "",
      imageUrl: p.hero_image ?? "",
    });
  };

  /*
   * The running total, computed exactly as the server computes it: the sum of
   * the lines plus shipping plus tax. Shown so the admin can check it against
   * the figure the gateway actually took BEFORE creating the order — which is
   * the one number that has to match.
   */
  const money = useMemo(() => {
    let subtotal = 0;
    let bad = false;
    for (const l of lines) {
      if (!l.name.trim() && !l.price.trim()) continue;
      const c = cents(l.price);
      const q = Number(l.qty || "1");
      if (c === null || !Number.isFinite(q)) {
        bad = true;
        continue;
      }
      subtotal += c * q;
    }
    const ship = cents(shippingFee);
    const t = cents(tax);
    if (ship === null || t === null) bad = true;
    return { subtotal, shipping: ship ?? 0, tax: t ?? 0, total: subtotal + (ship ?? 0) + (t ?? 0), bad };
  }, [lines, shippingFee, tax]);

  const settled = status === "paid" || status === "fulfilled";
  const today = new Date().toISOString().slice(0, 10);

  /** Tax at the store's configured rate, offered as a convenience. */
  const suggestedTax = ((money.subtotal * taxRateBps) / 10_000 / 100).toFixed(2);

  return (
    <form action={action} className="space-y-8">
      {state.errors && state.errors.length > 0 && (
        <div className="bg-error/10 border border-error/40 rounded-lg p-4">
          <p className="font-label-bold text-error uppercase tracking-widest text-xs mb-2">
            {state.errors.length === 1 ? "One problem" : `${state.errors.length} problems`}
          </p>
          <ul className="list-disc list-inside space-y-1">
            {state.errors.map((e) => (
              <li key={e} className="text-error text-sm">{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      <section className="bg-surface-container border border-white/10 rounded-lg p-6">
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-1">Customer</h2>
        <p className="text-on-surface-variant text-sm mb-5">
          The email is how the order is found, who the confirmation goes to, and
          what links it to an account if they ever register.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={lbl} htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className={input} placeholder="rider@example.com" />
          </div>
          <div>
            <label className={lbl} htmlFor="first_name">First name</label>
            <input id="first_name" name="shipping.first_name" className={input} />
          </div>
          <div>
            <label className={lbl} htmlFor="last_name">Last name</label>
            <input id="last_name" name="shipping.last_name" className={input} />
          </div>
          <div className="md:col-span-2">
            <label className={lbl} htmlFor="address">Street address</label>
            <input id="address" name="shipping.address" className={input} />
          </div>
          <div className="md:col-span-2">
            <label className={lbl} htmlFor="address2">Apartment, suite, unit</label>
            <input id="address2" name="shipping.address2" className={input} />
          </div>
          <div>
            <label className={lbl} htmlFor="city">City</label>
            <input id="city" name="shipping.city" className={input} />
          </div>
          <div>
            <label className={lbl} htmlFor="state">State / Region</label>
            <input id="state" name="shipping.state" className={input} />
          </div>
          <div>
            <label className={lbl} htmlFor="zip">Postal code</label>
            <input id="zip" name="shipping.zip" className={input} />
          </div>
          <div>
            <label className={lbl} htmlFor="country">Country</label>
            <input id="country" name="shipping.country" list="manual-countries" className={input} />
            <datalist id="manual-countries">
              {countries.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className={lbl} htmlFor="phone">Phone</label>
            <input id="phone" name="shipping.phone" className={input} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="bg-surface-container border border-white/10 rounded-lg p-6">
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-1">What was sold</h2>
        <p className="text-on-surface-variant text-sm mb-5">
          Pick a product to fill a line in, or type one by hand for something
          that is not in the catalogue. A <span className="text-white">negative
          price</span> records a discount or a part refund — the total is always
          the sum of these lines, so that is how it is made to match what was
          actually charged.
        </p>

        <div className="space-y-4">
          {lines.map((l, i) => (
            <div key={l.key} className="border border-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-label-bold text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Line {i + 1}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))}
                    className="text-error/80 hover:text-error text-xs font-label-bold uppercase tracking-widest"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div>
                <label className={lbl}>From the catalogue</label>
                <select
                  value={l.productId}
                  onChange={(e) => choose(l.key, e.target.value)}
                  className={input}
                >
                  <option value="">— type it by hand —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.status !== "active" ? ` (${p.status})` : ""} — {formatMoney(p.price_cents, "usd")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-3">
                  <label className={lbl}>Description</label>
                  <input
                    name={`item.${i}.name`}
                    value={l.name}
                    onChange={(e) => update(l.key, { name: e.target.value })}
                    className={input}
                    placeholder="Voltage Drift trike"
                  />
                </div>
                <div>
                  <label className={lbl}>Unit price</label>
                  <input
                    name={`item.${i}.price`}
                    value={l.price}
                    onChange={(e) => update(l.key, { price: e.target.value })}
                    inputMode="decimal"
                    className={input}
                    placeholder="1899.00"
                  />
                </div>
                <div>
                  <label className={lbl}>Qty</label>
                  <input
                    name={`item.${i}.qty`}
                    value={l.qty}
                    onChange={(e) => update(l.key, { qty: e.target.value })}
                    inputMode="numeric"
                    className={input}
                  />
                </div>
                <div>
                  <label className={lbl}>Colour</label>
                  <input
                    name={`item.${i}.color`}
                    value={l.color}
                    onChange={(e) => update(l.key, { color: e.target.value })}
                    className={input}
                  />
                </div>
              </div>

              {/* Carried so the order reads like a real one: the invoice and
                  the customer's order page show the picture and link back to
                  the product. Hidden because the picker fills them. */}
              <input type="hidden" name={`item.${i}.productId`} value={l.productId} />
              <input type="hidden" name={`item.${i}.slug`} value={l.slug} />
              <input type="hidden" name={`item.${i}.imageUrl`} value={l.imageUrl} />
            </div>
          ))}
        </div>

        {lines.length < MAX_MANUAL_ITEMS && (
          <button
            type="button"
            onClick={() => setLines((cur) => [...cur, blankLine()])}
            className="mt-4 border border-white/20 text-on-surface-variant hover:text-white hover:border-white/40 px-4 py-2 rounded text-xs font-label-bold uppercase tracking-widest"
          >
            + Add a line
          </button>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="bg-surface-container border border-white/10 rounded-lg p-6">
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-5">Money</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={lbl} htmlFor="shipping_fee">Shipping</label>
            <input
              id="shipping_fee"
              name="shipping_fee"
              value={shippingFee}
              onChange={(e) => setShippingFee(e.target.value)}
              inputMode="decimal"
              className={input}
            />
          </div>
          <div>
            <label className={lbl} htmlFor="tax">Tax</label>
            <input
              id="tax"
              name="tax"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={input}
            />
            {money.subtotal > 0 && (
              <button
                type="button"
                onClick={() => setTax(suggestedTax)}
                className="mt-1 text-secondary text-xs font-label-bold uppercase tracking-widest hover:underline"
              >
                Use {(taxRateBps / 100).toFixed(2)}% = {suggestedTax}
              </button>
            )}
          </div>
          <div>
            <label className={lbl} htmlFor="currency">Currency</label>
            <input id="currency" name="currency" defaultValue="usd" maxLength={3} className={input} />
          </div>
        </div>

        {/* The number that has to match the gateway. Shown before the order
            exists, because afterwards fixing it means editing a record a
            customer may already have an invoice for. */}
        <dl className="mt-5 border-t border-white/10 pt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Items</dt>
            <dd className="text-white">{formatMoney(money.subtotal, "usd")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Shipping</dt>
            <dd className="text-white">{formatMoney(money.shipping, "usd")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Tax</dt>
            <dd className="text-white">{formatMoney(money.tax, "usd")}</dd>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
            <dt className="font-label-bold text-white uppercase tracking-widest">Total</dt>
            <dd className="font-headline-md text-secondary text-xl">
              {money.bad ? "—" : formatMoney(money.total, "usd")}
            </dd>
          </div>
        </dl>
        {money.bad && (
          <p className="text-signal-orange text-xs mt-2">
            One of the amounts is not a number yet, so the total cannot be shown.
          </p>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="bg-surface-container border border-white/10 rounded-lg p-6">
        <h2 className="font-headline-md text-headline-md text-white uppercase mb-5">Payment</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={lbl} htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={input}
            >
              {MANUAL_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="paid_via">Paid via</label>
            <select id="paid_via" name="paid_via" defaultValue="stripe" className={input}>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="authorizenet">Authorize.Net</option>
              <option value="manual">Other / manual</option>
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="paid_at">Paid on</label>
            <input
              id="paid_at"
              name="paid_at"
              type="date"
              defaultValue={today}
              disabled={!settled}
              className={`${input} disabled:opacity-40`}
            />
          </div>
          <div className="md:col-span-2">
            <label className={lbl} htmlFor="gateway_reference">
              Gateway reference
            </label>
            <input
              id="gateway_reference"
              name="gateway_reference"
              className={input}
              placeholder="pi_3Q… or cs_test_… or a PayPal order id"
            />
            <p className="text-on-surface-variant text-xs mt-1">
              The gateway&rsquo;s own id for the payment. Worth filling in: it is
              what ties this order to the transaction, and a refund has to go
              back through the account that took it.
            </p>
          </div>
          <div>
            <label className={lbl} htmlFor="gateway_account">Gateway account</label>
            <input id="gateway_account" name="gateway_account" className={input} />
          </div>
          <div className="md:col-span-3">
            <label className={lbl} htmlFor="order_number">Order number</label>
            <input
              id="order_number"
              name="order_number"
              className={input}
              placeholder="Leave blank to generate one"
            />
          </div>
          <div className="md:col-span-3">
            <label className={lbl} htmlFor="note">Why this was entered by hand</label>
            <input
              id="note"
              name="note"
              className={input}
              placeholder="Paid by bank transfer, 3 Oct"
            />
          </div>
        </div>

        {/*
          Off by default, and deliberately so. The usual reason to type an
          order in is that the sale already happened — the customer has their
          receipt and a surprise confirmation days later reads as a second
          charge. Tick it for a sale they have NOT been told about yet.
        */}
        <label className="flex items-start gap-3 mt-5 cursor-pointer">
          {/* An unchecked checkbox submits NOTHING, and wantsNotify() reads an
              absent field as "this form has no such control, so email them".
              The hidden "off" is what makes leaving it unticked mean no email
              — without it, the default would be inverted. */}
          <input type="hidden" name="notify" value="off" />
          <input type="checkbox" name="notify" value="on" className="mt-1 accent-secondary" />
          <span className="text-sm text-on-surface-variant">
            <span className="text-white font-label-bold uppercase tracking-widest text-[11px] block">
              Email the customer
            </span>
            {status === "refunded"
              ? "Send the refund notice."
              : "Send the order confirmation and, for a guest, the link that sets up their account."}
          </span>
        </label>
      </section>

      <div className="flex items-center gap-4">
        <SaveButton />
        <a
          href="/admin/orders"
          className="text-on-surface-variant hover:text-white text-sm font-label-bold uppercase tracking-widest"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
