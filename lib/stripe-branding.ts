import { COMPANY } from "@/lib/company";
import { ESTIMATED_DELIVERY_DAYS } from "@/lib/fulfillment";
import { DEFAULT_DUTY_RATE_BPS } from "@/lib/totals";

/**
 * Company content for the Stripe-hosted Checkout page.
 *
 * WHAT STRIPE ALLOWS. Stripe Checkout is hosted by Stripe — you cannot inject
 * HTML, CSS or scripts into it. What you CAN place there is:
 *   - branding (logo, icon, brand + accent colour, font) — set in the Stripe
 *     Dashboard under Settings → Branding, not from code;
 *   - four `custom_text` slots, up to 1200 characters each, built here;
 *   - `custom_fields` for extra questions;
 *   - the payment description, which follows the charge into Stripe's own
 *     receipt and the customer's dashboard.
 *
 * The page the buyer lands on AFTER paying is `success_url` — our own
 * /order-confirmation — which is entirely ours and already carries the full
 * receipt, tracking timeline and duty notice.
 *
 * WHY THIS FILE EXISTS RATHER THAN INLINE STRINGS: the wording is derived from
 * the same constants as our own checkout, our emails and the customer tracker.
 * A delivery estimate or duty rate quoted on Stripe's page that disagrees with
 * the email we send minutes later is how a store ends up arguing with its own
 * customers.
 */

/** Stripe rejects any custom_text message longer than this. */
export const STRIPE_CUSTOM_TEXT_LIMIT = 1200;

/**
 * Trim to Stripe's limit at a word boundary.
 *
 * Belt and braces: every message below is well inside the limit, but an
 * over-length string fails the whole session create — which means no checkout
 * at all — so it is clamped rather than trusted.
 */
export function clampCustomText(
  text: string,
  limit: number = STRIPE_CUSTOM_TEXT_LIMIT
): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= limit) return t;
  const cut = t.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

const dutyPct = DEFAULT_DUTY_RATE_BPS / 100;

/**
 * Text shown alongside the pay button — the last thing a buyer reads before
 * committing, so it carries the two facts most likely to cause a dispute
 * later: who is charging them, and the customs duty they will owe separately.
 */
export function submitMessage(): string {
  return clampCustomText(
    `You're paying ${COMPANY.name}. Delivery is tracked end to end and takes around ${ESTIMATED_DELIVERY_DAYS} days. ` +
      `An estimated ${dutyPct}% import duty is payable by you to your local customs authority on arrival — it is not included in this total and we never collect it. ` +
      `Questions before you pay? ${COMPANY.supportEmail}`
  );
}

/**
 * Text Stripe shows after the payment confirmation button — what happens next,
 * worded to match the emails that follow so the two never disagree.
 */
export function afterSubmitMessage(): string {
  return clampCustomText(
    `Thank you. ${COMPANY.name} will email your confirmation straight away, then again when your order ships. ` +
      `You can follow every step — shipped, arriving, ready for collection — on your rider dashboard. ` +
      `Need help with this order? Email ${COMPANY.supportEmail} and quote your order number.`
  );
}

/** Description attached to the charge; follows it into Stripe's own receipt. */
export function paymentDescription(orderNumber: string): string {
  return `${COMPANY.name} — order ${orderNumber}`;
}

/**
 * The complete set of company content to spread into a Checkout session.
 *
 * Kept as one object so every caller gets the same treatment and nothing drifts
 * between the redirect flow and any future embedded one.
 */
export function stripeCompanyContent(orderNumber: string) {
  return {
    // "Pay" rather than the default "Subscribe"/"Donate" wording.
    submit_type: "pay" as const,
    custom_text: {
      submit: { message: submitMessage() },
      after_submit: { message: afterSubmitMessage() },
    },
    payment_intent_data: {
      description: paymentDescription(orderNumber),
    },
  };
}
