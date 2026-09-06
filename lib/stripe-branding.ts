import { COMPANY } from "@/lib/company";
import { normalizeCountry } from "@/lib/countries";
import { formatDeliveryWindow } from "@/lib/delivery";
import { STAGE_COPY, TRACKER_STAGES } from "@/lib/fulfillment";

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
 * receipt and tracking timeline.
 *
 * WHY THIS FILE EXISTS RATHER THAN INLINE STRINGS: the wording is derived from
 * the same constants as our own checkout, our emails and the customer tracker.
 * A delivery estimate quoted on Stripe's page that disagrees with the email we
 * send minutes later is how a store ends up arguing with its own customers.
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

/**
 * How the destination is named on Stripe's page.
 *
 * The buyer has already typed their address, so naming the country makes the
 * quoted window read as theirs rather than as generic marketing copy. An
 * unrecognised country falls back to neutral wording rather than echoing
 * whatever string arrived.
 */
function destination(country?: string | null): string {
  const name = country ? normalizeCountry(country) : null;
  return name ?? "your address";
}

/**
 * The charge amount, in USD, always with cents.
 *
 * `formatMoney` drops the decimals on a round figure, which is right in a
 * catalogue and wrong on a payment page: "US$1,446" next to a card form reads
 * as an estimate, "US$1,446.00" reads as the amount being taken. "US$" rather
 * than a bare "$" because this page is read in Canada, Australia and Singapore
 * too, where a lone dollar sign is genuinely ambiguous.
 */
export function formatUsd(cents: number): string {
  const amount = Number.isFinite(cents) && cents >= 0 ? cents : 0;
  return `US$${(amount / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Text shown alongside the pay button — the last thing a buyer reads before
 * committing, so it says who is charging them, HOW MUCH, when it arrives, and
 * where to ask.
 *
 * THE AMOUNT IS HERE ON PURPOSE. Stripe renders its own order summary, but it
 * is a separate column on desktop and a collapsed bar at the top on mobile —
 * and with Adaptive Pricing on, the figure in it is the buyer's LOCAL currency.
 * Putting the USD total in our own copy means the amount being charged is
 * always on screen, in the currency the order is actually denominated in,
 * whatever Stripe does with the layout around it.
 */
export function submitMessage(
  country?: string | null,
  opts: { totalCents?: number; orderNumber?: string } = {}
): string {
  const amount =
    typeof opts.totalCents === "number"
      ? ` ${formatUsd(opts.totalCents)}`
      : "";
  const order = opts.orderNumber ? ` for order ${opts.orderNumber}` : "";
  return clampCustomText(
    `You're paying ${COMPANY.name}${amount}${order}. ` +
      `Delivery to ${destination(country)} is tracked end to end and takes ${formatDeliveryWindow(country)}. ` +
      `Your card may be billed in your own currency at your bank's rate. ` +
      `Questions before you pay? ${COMPANY.supportEmail}`
  );
}

/**
 * Text Stripe shows after the payment confirmation button — what happens next,
 * worded to match the emails that follow so the two never disagree.
 */
export function afterSubmitMessage(): string {
  // DERIVED, not written out. This list was hard-coded once and immediately went
  // stale when the journey grew from four steps to seven — leaving Stripe's page
  // promising a shorter journey than the emails delivered. Reading the rail means
  // it cannot happen twice.
  const steps = TRACKER_STAGES.map((s) => STAGE_COPY[s].label.toLowerCase()).join(
    ", "
  );
  return clampCustomText(
    `Thank you. ${COMPANY.name} will email you as soon as your payment is confirmed, then at every step after that — ` +
      `${steps}. ` +
      `You can follow the same timeline live on your rider dashboard. ` +
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
export function stripeCompanyContent(
  orderNumber: string,
  country?: string | null,
  totalCents?: number
) {
  return {
    // "Pay" rather than the default "Subscribe"/"Donate" wording.
    submit_type: "pay" as const,
    /**
     * Show the price in the buyer's own currency.
     *
     * Stripe converts and presents the total in the local currency, and charges
     * in it — the order stays denominated in USD on our side either way. Our
     * submit message states the USD figure, so the page carries both: Stripe's
     * summary in their currency, our line in ours.
     *
     * ⚠️ ALSO A DASHBOARD SETTING. This flag defaults to whatever is configured
     * at dashboard.stripe.com/settings/adaptive-pricing, and the feature has to
     * be available to the account at all. Sending it explicitly is the half we
     * control; if the account rejects it, the checkout route retries without it
     * rather than losing the sale over a display feature.
     */
    adaptive_pricing: { enabled: true },
    custom_text: {
      submit: { message: submitMessage(country, { totalCents, orderNumber }) },
      after_submit: { message: afterSubmitMessage() },
    },
    payment_intent_data: {
      description: paymentDescription(orderNumber),
    },
  };
}
