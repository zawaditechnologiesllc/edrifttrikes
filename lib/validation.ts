/**
 * Checkout field definitions and validation — the single source of truth for
 * what a buyer must enter, how it's described to them, and what counts as
 * valid.
 *
 * Used by BOTH the checkout form (`app/checkout/CheckoutClient.tsx`) and the
 * checkout API (`app/api/checkout/route.ts`). That's the point: a rule the
 * browser enforces but the server doesn't is not a rule, and a rule the server
 * enforces but the browser doesn't is a form that rejects people with no
 * explanation.
 *
 * DEPENDENCY-FREE except for the country list, so it is directly unit-testable
 * (tests/validation.test.ts) and safe in both client and server components.
 */

import { isKnownCountry, normalizeCountry } from "@/lib/countries";

export type CheckoutFieldName =
  | "first_name"
  | "last_name"
  | "address"
  | "address2"
  | "city"
  | "state"
  | "zip"
  | "country"
  | "phone";

export type FieldSpec = {
  name: CheckoutFieldName;
  label: string;
  /** Shown under the input — what to type and, where useful, why we need it. */
  hint: string;
  placeholder: string;
  /** Lets the browser autofill the whole address in one go. */
  autoComplete: string;
  type?: "text" | "tel";
  inputMode?: "text" | "tel" | "numeric";
  required: boolean;
  maxLength: number;
  /** Grid width on the two-column form. */
  span: "half" | "full";
};

/**
 * The address form, in the order it's rendered.
 *
 * `autoComplete` values are the standard HTML tokens — with these, a browser
 * fills the entire address from a saved profile in one tap, which is the single
 * biggest thing that makes a checkout feel seamless.
 *
 * PLACEHOLDER CONVENTION: placeholders describe what to enter — they are never
 * a sample name, street or city. A specimen identity in a form field reads as
 * someone's real data, is easy to mistake for a prefilled value, and only makes
 * sense to buyers from whichever country the sample came from. `hint` carries
 * the explanation; `placeholder` carries the instruction.
 */
export const CHECKOUT_FIELDS: FieldSpec[] = [
  {
    name: "first_name",
    label: "First name",
    hint: "As it appears on your ID — couriers may check it on delivery.",
    placeholder: "Enter your first name",
    autoComplete: "given-name",
    required: true,
    maxLength: 60,
    span: "half",
  },
  {
    name: "last_name",
    label: "Last name",
    hint: "Your family or surname.",
    placeholder: "Enter your last name",
    autoComplete: "family-name",
    required: true,
    maxLength: 60,
    span: "half",
  },
  {
    name: "address",
    label: "Street address",
    hint: "House or building number and street name.",
    placeholder: "Building number and street name",
    autoComplete: "street-address",
    required: true,
    maxLength: 200,
    span: "full",
  },
  {
    name: "address2",
    label: "Apartment, suite, unit (optional)",
    hint: "Anything else the courier needs to find you — floor, buzzer, gate code.",
    placeholder: "Apartment, suite, floor or gate code",
    autoComplete: "address-line2",
    required: false,
    maxLength: 120,
    span: "full",
  },
  {
    name: "city",
    label: "City / Town",
    hint: "The city or town for delivery.",
    placeholder: "Enter your city or town",
    autoComplete: "address-level2",
    required: true,
    maxLength: 80,
    span: "half",
  },
  {
    name: "state",
    label: "State / Province / Region",
    hint: "Enter your region. If your country has none, put the city again.",
    placeholder: "Enter your state, province or region",
    autoComplete: "address-level1",
    required: true,
    maxLength: 80,
    span: "half",
  },
  {
    name: "zip",
    label: "Postal / ZIP code",
    hint: "2–12 characters. If your country doesn't use one, enter 00000.",
    placeholder: "Enter your postal or ZIP code",
    autoComplete: "postal-code",
    required: true,
    maxLength: 12,
    span: "half",
  },
  {
    name: "country",
    label: "Country",
    hint: "Pick from the list — it sets your shipping route.",
    placeholder: "Select your country",
    // "country" (not "country-name") because the control's value is the ISO
    // code — this is the token that tells a browser to autofill the code.
    autoComplete: "country",
    required: true,
    maxLength: 60,
    span: "half",
  },
  {
    name: "phone",
    label: "Phone number",
    hint: "Strongly recommended — the courier calls or texts this to arrange delivery or collection.",
    placeholder: "Include your country code",
    autoComplete: "tel",
    type: "tel",
    inputMode: "tel",
    required: false,
    maxLength: 25,
    span: "full",
  },
];

export const REQUIRED_FIELDS = CHECKOUT_FIELDS.filter((f) => f.required).map(
  (f) => f.name
);

/** Field spec by name. */
export function fieldSpec(name: CheckoutFieldName): FieldSpec | undefined {
  return CHECKOUT_FIELDS.find((f) => f.name === name);
}

// Permissive enough for real addresses worldwide, strict enough to catch a
// mistyped or junk entry. Deliberately NOT a strict pattern: rejecting a valid
// foreign address costs a sale, while a slightly odd one costs nothing.
const HAS_LETTER = /\p{L}/u;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const ZIP_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/;
// Digits, with the punctuation phone numbers are actually written with.
const PHONE_RE = /^\+?[0-9][0-9 ()./-]{5,23}$/;

/** Validate an email address. Returns null when valid, else the reason. */
export function validateEmail(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return "Enter your email address — your receipt and tracking go here.";
  if (v.length > 254) return "That email address is too long.";
  if (!EMAIL_RE.test(v)) return "That doesn't look like a valid email address.";
  return null;
}

/**
 * Validate one shipping field. Returns null when valid, else a message written
 * for the buyer to act on — never a bare "invalid".
 */
export function validateShippingField(
  name: CheckoutFieldName,
  value: string
): string | null {
  const spec = fieldSpec(name);
  if (!spec) return null;
  const v = (value ?? "").trim();

  if (!v) {
    return spec.required ? `${spec.label} is required.` : null;
  }
  if (v.length > spec.maxLength) {
    return `${spec.label} must be ${spec.maxLength} characters or fewer.`;
  }

  switch (name) {
    case "first_name":
    case "last_name":
      if (v.length < 2) return `${spec.label} must be at least 2 characters.`;
      if (!HAS_LETTER.test(v)) return `${spec.label} must contain letters.`;
      return null;

    case "address":
      if (v.length < 5) return "Enter the full street address, including the number.";
      if (!HAS_LETTER.test(v)) return "Enter a street name, not just numbers.";
      return null;

    case "address2":
      return null;

    case "city":
    case "state":
      if (v.length < 2) return `${spec.label} must be at least 2 characters.`;
      if (!HAS_LETTER.test(v)) return `${spec.label} must contain letters.`;
      return null;

    case "zip":
      if (!ZIP_RE.test(v)) {
        return "Enter a valid postal code (letters and numbers, 2–12 characters).";
      }
      return null;

    case "country":
      if (!isKnownCountry(v)) return "Choose your country from the list.";
      return null;

    case "phone":
      // Optional — but if given, it must be dialable, because the courier uses
      // it to arrange delivery.
      if (!PHONE_RE.test(v)) {
        return "Enter a reachable phone number, including your country code.";
      }
      return null;

    default:
      return null;
  }
}

export type CheckoutValidation = {
  ok: boolean;
  /** Field name → message, for rendering under the right input. */
  errors: Partial<Record<"email" | CheckoutFieldName, string>>;
  /** The field to focus / report first, in form order. */
  firstErrorField: string | null;
  firstErrorMessage: string | null;
};

/**
 * Validate the whole checkout payload — email plus every shipping field.
 *
 * The client calls this before submitting so the buyer sees every problem at
 * once; the API calls it again because a browser check is a convenience, not a
 * guarantee.
 */
export function validateCheckout(input: {
  email: string;
  shipping: Record<string, string>;
}): CheckoutValidation {
  const errors: CheckoutValidation["errors"] = {};

  const emailError = validateEmail(input.email ?? "");
  if (emailError) errors.email = emailError;

  for (const spec of CHECKOUT_FIELDS) {
    const error = validateShippingField(spec.name, input.shipping?.[spec.name] ?? "");
    if (error) errors[spec.name] = error;
  }

  // Report in form order so "the first problem" is the topmost one on screen,
  // not whichever key the object happened to iterate first.
  const order: string[] = ["email", ...CHECKOUT_FIELDS.map((f) => f.name)];
  const firstErrorField =
    order.find((k) => errors[k as keyof typeof errors]) ?? null;

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    firstErrorField,
    firstErrorMessage: firstErrorField
      ? (errors[firstErrorField as keyof typeof errors] ?? null)
      : null,
  };
}

/**
 * Trim, bound and canonicalise a validated shipping payload for storage.
 *
 * Only known fields survive — a crafted request can't attach arbitrary keys to
 * an order — and the country is stored in its canonical spelling so the admin
 * order list and shipping labels stay consistent.
 */
export function normalizeShipping(
  shipping: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of CHECKOUT_FIELDS) {
    const raw = shipping?.[spec.name];
    if (typeof raw !== "string") continue;
    const value = raw.trim().slice(0, spec.maxLength);
    if (!value) continue;
    out[spec.name] =
      spec.name === "country" ? (normalizeCountry(value) ?? value) : value;
  }
  return out;
}
