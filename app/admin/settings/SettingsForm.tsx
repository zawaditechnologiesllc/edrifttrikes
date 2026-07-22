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
