"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSiteSettings, type SettingsState } from "../actions";
import type { SiteSettings } from "@/lib/types";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-secondary text-on-secondary-fixed px-8 py-4 rounded font-label-bold uppercase tracking-widest hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save settings"}
    </button>
  );
}

const input =
  "w-full bg-surface-container-highest border border-white/10 text-white p-3 rounded focus:border-secondary focus:ring-0";
const lbl =
  "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

export default function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action] = useActionState<SettingsState, FormData>(saveSiteSettings, {});
  return (
    <form action={action} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Company email</label>
          <input
            name="company_email"
            type="email"
            defaultValue={settings.company_email ?? ""}
            placeholder="hello@edrifttrikes.com"
            className={input}
          />
        </div>
        <div>
          <label className={lbl}>Company phone</label>
          <input
            name="company_phone"
            defaultValue={settings.company_phone ?? ""}
            placeholder="+1 (555) 010-0000"
            className={input}
          />
        </div>
      </div>
      <div>
        <label className={lbl}>Address line 1</label>
        <input
          name="address_line1"
          defaultValue={settings.address_line1 ?? ""}
          placeholder="100 Drift Lane"
          className={input}
        />
      </div>
      <div>
        <label className={lbl}>Address line 2 (city, region, country)</label>
        <input
          name="address_line2"
          defaultValue={settings.address_line2 ?? ""}
          placeholder="Los Angeles, CA 90001, USA"
          className={input}
        />
      </div>

      <div className="border-t border-white/10 pt-6">
        <p className="font-label-bold text-label-bold text-white uppercase tracking-widest text-xs mb-4">
          Shipping
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className={lbl}>Flat shipping fee ($) — every order</label>
            <input
              name="shipping_fee"
              defaultValue={((settings.shipping_cents ?? 5000) / 100).toFixed(2)}
              placeholder="50.00"
              className={input}
            />
          </div>
          <label className="flex items-center gap-3 text-on-surface-variant pb-3">
            <input
              type="checkbox"
              name="free_shipping"
              defaultChecked={settings.free_shipping ?? false}
              className="w-5 h-5"
            />
            <span className="font-label-bold uppercase text-xs tracking-widest">
              Free shipping on all orders
            </span>
          </label>
        </div>
        <p className="text-[10px] text-outline uppercase tracking-widest mt-2">
          One constant fee for every order. Tick free shipping to override it —
          cart, checkout, and receipts update immediately.
        </p>
      </div>

      {state.error && <p className="text-error font-body-md">{state.error}</p>}
      {state.ok && (
        <p className="text-secondary font-label-bold uppercase text-xs tracking-widest">
          Saved — the footer updates within a few seconds.
        </p>
      )}

      <div className="pt-2">
        <Save />
      </div>
    </form>
  );
}
