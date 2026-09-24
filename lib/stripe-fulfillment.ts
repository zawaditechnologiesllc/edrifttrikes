/**
 * WHAT STRIPE IS TOLD ABOUT A REAL, PHYSICAL DELIVERY.
 *
 * Everything here exists for one reason: a card charge with no destination and
 * no proof of shipment is, to a payment processor's risk model, indistinguishable
 * from a charge for nothing. We sell crated trikes to named addresses and track
 * them end to end — this module is what makes the payment record say so.
 *
 * Two moments matter:
 *
 *  1. AT CHECKOUT — the buyer has already typed their address into our form, so
 *     it travels with the PaymentIntent (`stripeShipping`). Sending it costs
 *     nothing and asking for it twice on Stripe's page would cost conversions.
 *
 *  2. WHEN IT SHIPS — the courier and tracking number an admin enters go back
 *     onto the same PaymentIntent (`fulfillmentMetadata`). If that charge is
 *     ever disputed as "goods not received", the evidence is already attached
 *     to it rather than being reconstructed from our database months later.
 *
 * DEPENDENCY-FREE ON PURPOSE — no Stripe SDK, no Supabase, no env. Pure shaping
 * of plain objects, so it is unit-testable (tests/stripe-fulfillment.test.ts)
 * and the callers stay responsible for the network.
 */

import { countryCode } from "@/lib/countries";
import { trackingUrlFor } from "@/lib/couriers";

/** Stripe's own cap on an address field. Longer values are refused outright. */
const FIELD_LIMIT = 500;

/** The full statement descriptor must fit in 22 characters, prefix included. */
export const STATEMENT_DESCRIPTOR_LIMIT = 22;

/** Characters Stripe rejects anywhere in a statement descriptor. */
const DESCRIPTOR_FORBIDDEN = /[<>\\'"*]/g;

type ShippingAddress = Record<string, string | null | undefined>;

const clean = (v: unknown): string =>
  typeof v === "string" ? v.trim().slice(0, FIELD_LIMIT) : "";

/**
 * The buyer's delivery address, in the shape `payment_intent_data.shipping`
 * takes — or null when it cannot be built.
 *
 * Returns null rather than a partial object: Stripe requires a name, a line 1
 * and a two-letter country, and a session create that fails on a malformed
 * address is a lost sale. An address we cannot render is one we simply do not
 * send, which leaves us exactly where we were before.
 */
export function stripeShipping(address: ShippingAddress | null | undefined) {
  if (!address) return null;

  const name = [clean(address.first_name), clean(address.last_name)]
    .filter(Boolean)
    .join(" ");
  const line1 = clean(address.address);
  // The form stores whatever the buyer picked; Stripe wants ISO alpha-2. A
  // country we cannot resolve to a code is not one we can send.
  const country = countryCode(clean(address.country) || "");

  if (!name || !line1 || !country) return null;

  const phone = clean(address.phone);
  return {
    name,
    ...(phone ? { phone } : {}),
    address: {
      line1,
      ...(clean(address.address2) ? { line2: clean(address.address2) } : {}),
      ...(clean(address.city) ? { city: clean(address.city) } : {}),
      ...(clean(address.state) ? { state: clean(address.state) } : {}),
      ...(clean(address.zip) ? { postal_code: clean(address.zip) } : {}),
      country,
    },
  };
}

/**
 * The line a buyer sees on their bank statement, or null if nothing usable was
 * configured.
 *
 * WHY IT MATTERS MORE THAN IT LOOKS: a cardholder who does not recognise a line
 * on their statement disputes it as fraud. Those disputes are the expensive
 * kind — they count against the account's fraud rate whether or not you win
 * them — and they are entirely preventable by putting a name on the charge that
 * matches the shop the buyer remembers.
 *
 * Stripe prepends the account's own prefix, so this is clamped well short of
 * the 22-character limit to leave room for it. A descriptor with no letters at
 * all is rejected by Stripe, so it is rejected here first.
 */
export function statementDescriptorSuffix(
  raw: string | null | undefined,
  limit: number = 12
): string | null {
  const cap = Math.min(limit, STATEMENT_DESCRIPTOR_LIMIT);
  const cleaned = String(raw ?? "")
    .replace(DESCRIPTOR_FORBIDDEN, "")
    .replace(/\s+/g, " ")
    .trim();

  // Cut at a word boundary where there is a sensible one. A statement reading
  // "E-DRIFT TRIK" looks like a broken charge, which is the exact reaction this
  // field exists to prevent; "E-DRIFT" does not.
  let text = cleaned.slice(0, cap);
  if (cleaned.length > cap) {
    const lastSpace = text.lastIndexOf(" ");
    if (lastSpace >= 4) text = text.slice(0, lastSpace);
  }
  text = text.trim();

  if (text.length < 2) return null;
  // Stripe refuses a descriptor with no latin letter in it, so refuse it here
  // rather than losing a checkout to a rejected session.
  if (!/[A-Za-z]/.test(text)) return null;
  return text;
}

export type FulfillmentEvidence = {
  courier: string | null;
  trackingNumber: string | null;
  /** ISO date the parcel was handed over, if known. */
  shippedAt?: string | null;
  orderNumber: string;
  stage?: string | null;
};

/**
 * Fulfillment facts as PaymentIntent metadata.
 *
 * Metadata keys are capped by Stripe (50 keys, 40-character keys, 500-character
 * values); everything here is well inside that. Empty values are omitted rather
 * than written as "null" strings, because a dispute reviewer reading
 * `shipping_tracking_number: null` learns less than nothing.
 *
 * These key names deliberately mirror the fields of Stripe's own dispute
 * evidence object, so submitting evidence is a copy rather than a translation.
 */
export function fulfillmentMetadata(
  evidence: FulfillmentEvidence
): Record<string, string> {
  const out: Record<string, string> = { order_number: evidence.orderNumber };
  if (evidence.stage) out.fulfillment_stage = evidence.stage;
  if (evidence.courier) out.shipping_carrier = evidence.courier;
  if (evidence.trackingNumber) {
    out.shipping_tracking_number = evidence.trackingNumber;
    const url = trackingUrlFor(evidence.courier, evidence.trackingNumber);
    // Only a link that actually resolves. Attaching a courier's URL to our own
    // internal reference would send a dispute reviewer to a "not found" page,
    // which reads as evidence that nothing shipped.
    if (url) out.shipping_tracking_url = url;
  }
  if (evidence.shippedAt) out.shipping_date = evidence.shippedAt.slice(0, 10);
  return out;
}

/**
 * Is this stored gateway id a Stripe Checkout Session?
 *
 * `orders.stripe_session_id` carries a PayPal order id on the PayPal path — the
 * column predates PayPal and was reused rather than duplicated. Stripe session
 * ids are prefixed `cs_`, which is what tells the two apart.
 */
export function isStripeSessionId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("cs_");
}
