"use client";

import { countries } from "@/lib/countries";
import type { FieldSpec } from "@/lib/validation";
import type { AddressPrefill } from "@/lib/address-lookup";
import AddressAutocomplete from "@/components/checkout/AddressAutocomplete";

/**
 * One checkout input, with everything a buyer needs to fill it correctly:
 * a label, a hint saying exactly what goes in it, a placeholder instructing
 * what to type, and the `autocomplete` token that lets a browser fill the whole
 * address at once.
 *
 * Placeholders are instructions, never specimen names or addresses — see the
 * PLACEHOLDER CONVENTION note in lib/validation.ts.
 *
 * Errors only render once a field has been touched, so the form doesn't shout
 * at someone before they've typed anything — but once shown, the message says
 * what to do rather than just "invalid".
 */

const baseInput =
  "w-full bg-surface-container-highest border text-white p-4 rounded transition-colors focus:ring-0 placeholder:text-outline";

export default function CheckoutField({
  spec,
  value,
  error,
  touched,
  onChange,
  onBlur,
  country,
  onPickAddress,
}: {
  spec: FieldSpec;
  value: string;
  error?: string;
  touched: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  /** Current country code — narrows the address lookup to where they are. */
  country?: string;
  /** Fills the rest of the address from a picked suggestion. */
  onPickAddress?: (prefill: AddressPrefill) => void;
}) {
  const showError = touched && Boolean(error);
  const describedBy = showError ? `${spec.name}-error` : `${spec.name}-hint`;

  const borderClass = showError
    ? "border-error focus:border-error"
    : "border-white/10 focus:border-secondary";

  return (
    <div className={spec.span === "full" ? "col-span-2" : "col-span-2 sm:col-span-1"}>
      <label
        htmlFor={spec.name}
        className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest"
      >
        {spec.label}
        {spec.required && <span className="text-secondary ml-1">*</span>}
      </label>

      {spec.name === "address" && onPickAddress ? (
        /* The street line gets the lookup. Everything it fills — city, state,
           ZIP, country — is a field the buyer would otherwise type by hand. */
        <AddressAutocomplete
          id={spec.name}
          value={value}
          country={country ?? ""}
          onChange={onChange}
          onPick={onPickAddress}
          onBlur={onBlur}
          placeholder={spec.placeholder}
          describedBy={describedBy}
          invalid={showError}
          maxLength={spec.maxLength}
          required={spec.required}
          className={`${baseInput} ${borderClass}`}
        />
      ) : spec.name === "country" ? (
        <select
          id={spec.name}
          name={spec.name}
          value={value}
          required={spec.required}
          autoComplete={spec.autoComplete}
          aria-describedby={describedBy}
          aria-invalid={showError || undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`${baseInput} ${borderClass} ${value ? "" : "text-outline"}`}
        >
          <option value="">{spec.placeholder}</option>
          {/* The VALUE is the ISO code, not the display name. Validation then
              only ever compares against a static code list, so it can't depend
              on the server runtime resolving the same country names the browser
              did — a mismatch there would reject every order. The name is
              cosmetic; the server canonicalises it for storage. */}
          {countries().map((c) => (
            <option key={c.code} value={c.code} className="text-white">
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={spec.name}
          name={spec.name}
          type={spec.type ?? "text"}
          inputMode={spec.inputMode}
          value={value}
          required={spec.required}
          maxLength={spec.maxLength}
          autoComplete={spec.autoComplete}
          placeholder={spec.placeholder}
          aria-describedby={describedBy}
          aria-invalid={showError || undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`${baseInput} ${borderClass}`}
        />
      )}

      {showError ? (
        <p id={`${spec.name}-error`} className="text-error text-xs mt-1.5">
          {error}
        </p>
      ) : (
        <p id={`${spec.name}-hint`} className="text-outline text-xs mt-1.5">
          {spec.hint}
        </p>
      )}
    </div>
  );
}
