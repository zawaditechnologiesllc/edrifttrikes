"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveSiteSettings, type SettingsState } from "../actions";
import type { SiteSettings } from "@/lib/types";
import { DEFAULT_TAX_RATE_BPS } from "@/lib/totals";
import { logoToPng } from "@/lib/image-compress";

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
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoNote, setLogoNote] = useState<string | null>(null);

  /**
   * Convert the chosen logo to PNG in the browser and put the converted file
   * back on the input, so the server action uploads that instead of the
   * original. PDF can only embed PNG and JPEG, and PNG is the one that keeps a
   * transparent background — a JPEG logo would print as a white box.
   */
  const onLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoPreview(null);
      setLogoNote(null);
      return;
    }
    setLogoNote("Preparing logo…");
    const png = await logoToPng(file);
    if (png !== file && logoInput.current) {
      const transfer = new DataTransfer();
      transfer.items.add(png);
      logoInput.current.files = transfer.files;
    }
    setLogoPreview(URL.createObjectURL(png));
    setLogoNote(
      png.type === "image/png"
        ? `Ready — ${png.name} (${Math.max(1, Math.round(png.size / 1024))} KB)`
        : `${file.name} could not be converted here. Save it as a PNG or JPEG and try again.`
    );
  };

  return (
    <form action={action} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Company email</label>
          <input
            name="company_email"
            type="email"
            defaultValue={settings.company_email ?? ""}
            placeholder="hello@edrifttrikes.shop"
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
          Store logo
        </p>
        <div className="flex items-start gap-5">
          {(logoPreview || settings.logo_url) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview ?? settings.logo_url ?? ""}
              alt="Store logo"
              // Checkerboard so a transparent logo reads as transparent rather
              // than as a white rectangle on the dark admin panel.
              className="w-28 h-20 object-contain rounded border border-white/10 bg-[conic-gradient(#2a2a2d_90deg,#1b1b1e_90deg_180deg,#2a2a2d_180deg_270deg,#1b1b1e_270deg)] bg-[length:12px_12px] p-1"
            />
          )}
          <div className="flex-1">
            <input
              ref={logoInput}
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onLogoChange}
              className="text-on-surface-variant text-sm"
            />
            {logoNote && (
              <p className="text-secondary text-xs mt-2 font-label-bold uppercase tracking-widest">
                {logoNote}
              </p>
            )}
            {settings.logo_url && (
              <label className="flex items-center gap-3 text-on-surface-variant mt-3">
                <input type="checkbox" name="remove_logo" className="w-4 h-4" />
                <span className="font-label-bold uppercase text-xs tracking-widest">
                  Remove the current logo on save
                </span>
              </label>
            )}
          </div>
        </div>
        <p className="text-[10px] text-outline uppercase tracking-widest mt-3">
          Printed at the top of every product information sheet, and behind it as
          a watermark. Converted to PNG in your browser and scaled to 600px, so a
          transparent background stays transparent. Leave empty to keep the
          current logo.
        </p>
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
          Default fee for products without their own (each product can set one
          on its form). Tick free shipping to make every order ship free —
          cart, checkout, and receipts update immediately.
        </p>
      </div>

      <div>
        <label className={lbl}>Sales tax rate (%)</label>
        <input
          name="tax_rate"
          inputMode="decimal"
          defaultValue={(
            (settings.tax_rate_bps ?? DEFAULT_TAX_RATE_BPS) / 100
          ).toFixed(2)}
          placeholder="8.00"
          className={`${input} max-w-[12rem]`}
        />
        <p className="text-[10px] text-outline uppercase tracking-widest mt-2">
          Applied to every order&apos;s subtotal. One flat rate for all buyers —
          it does not vary by state or country. If you sell across tax
          jurisdictions, use a real tax service (Stripe Tax, TaxJar) instead of
          relying on this.
        </p>
      </div>

      <div className="border-t border-white/10 pt-6">
        <p className="font-label-bold text-label-bold text-white uppercase tracking-widest text-xs mb-4">
          Invoice identity
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Trading name (DBA)</label>
            <input
              name="dba_name"
              defaultValue={settings.dba_name ?? ""}
              placeholder="E-Drift Trikes &amp; Go Carts"
              className={`${input} w-full`}
            />
          </div>
          <div>
            <label className={lbl}>Registered legal entity</label>
            <input
              name="legal_name"
              defaultValue={settings.legal_name ?? ""}
              placeholder="Zawadi Technologies LLC"
              className={`${input} w-full`}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={lbl}>Tax / business registration number</label>
          <input
            name="tax_id"
            defaultValue={settings.tax_id ?? ""}
            placeholder="EIN 88-1234567"
            className={`${input} max-w-[20rem]`}
          />
        </div>
        <div className="mt-4">
          <label className={lbl}>Invoice footer note (optional)</label>
          <textarea
            name="invoice_footer"
            defaultValue={settings.invoice_footer ?? ""}
            rows={2}
            placeholder="Payment terms, bank details, anything that should appear at the foot of every invoice."
            className={`${input} w-full`}
          />
        </div>
        <p className="text-[10px] text-outline uppercase tracking-widest mt-3">
          Printed at the top of every invoice. The trading name is what customers
          see; the registered entity appears beneath it as &ldquo;a trading name
          of&hellip;&rdquo; when the two differ. Changing these updates{" "}
          <strong className="text-white">every</strong> invoice, including ones
          for orders already placed — so an invoice you have already sent
          somebody will not match the copy you download after a change.
        </p>
      </div>

      <div className="border-t border-white/10 pt-6">
        <p className="font-label-bold text-label-bold text-white uppercase tracking-widest text-xs mb-4">
          Card payments
        </p>
        <label className={lbl}>Statement descriptor</label>
        <input
          name="statement_descriptor"
          defaultValue={settings.statement_descriptor ?? ""}
          placeholder="EDRIFTTRIKES"
          maxLength={22}
          className={`${input} max-w-[20rem]`}
        />
        <p className="text-[10px] text-outline uppercase tracking-widest mt-2">
          The name next to the charge on your buyer&apos;s bank statement. Use
          the trading name they will recognise — a cardholder who does not
          recognise a line on their statement disputes it as fraud, and that
          kind of dispute counts against you whether you win it or not. Letters
          and numbers only, kept short because Stripe adds your account prefix
          in front of it. Leave empty to use your Stripe account default.
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
