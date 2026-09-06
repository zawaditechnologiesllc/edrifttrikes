import Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import {
  fulfillmentMetadata,
  isStripeSessionId,
  type FulfillmentEvidence,
} from "@/lib/stripe-fulfillment";

/**
 * Stripe client, or null when not configured (storefront still works, the
 * email-only order path is used). Uses the fetch-based HTTP client so it runs
 * on the Cloudflare Workers runtime (OpenNext) as well as Node.
 *
 * The key is read at CALL time (not module scope): on Cloudflare, secrets are
 * runtime Worker bindings that aren't visible when the module is first
 * evaluated, so a module-scope read would silently disable Stripe.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = serverEnv("STRIPE_SECRET_KEY");
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return cached;
}

export function stripeConfigured() {
  return Boolean(serverEnv("STRIPE_SECRET_KEY"));
}

export type AttachResult = { ok: boolean; reason?: string };

/**
 * Attach proof of shipment to the payment that bought it.
 *
 * When an admin saves a courier and tracking number, those facts go back onto
 * the Stripe PaymentIntent as metadata. Nothing about the charge changes — it is
 * purely a record.
 *
 * WHY BOTHER, when the same data is already in our database: if this charge is
 * ever disputed as "goods not received", the evidence is already sitting on it
 * under the same field names Stripe's own dispute-evidence object uses, so
 * responding is a copy rather than an archaeology exercise across two systems
 * months after the fact. Physical-goods merchants who can produce a carrier and
 * a tracking number win those disputes; the ones who cannot, do not.
 *
 * NEVER THROWS. A tracking number that saved correctly must not look like a
 * failure because Stripe was slow, and the write is a nice-to-have on top of a
 * database row that is already correct.
 */
export async function attachFulfillmentToPayment(
  order: {
    stripe_session_id?: string | null;
    order_number: string;
    courier?: string | null;
    tracking_number?: string | null;
    stage_updated_at?: string | null;
    fulfillment_stage?: string | null;
  }
): Promise<AttachResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, reason: "stripe_not_configured" };
  // `stripe_session_id` carries a PayPal order id on the PayPal path — the
  // column predates PayPal and was reused. Only a `cs_` id is ours to look up.
  if (!isStripeSessionId(order.stripe_session_id)) {
    return { ok: false, reason: "not_a_stripe_payment" };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(
      order.stripe_session_id as string
    );
    const intent = session.payment_intent;
    const intentId = typeof intent === "string" ? intent : intent?.id;
    // A session that was never completed has no PaymentIntent to write to.
    if (!intentId) return { ok: false, reason: "no_payment_intent" };

    const evidence: FulfillmentEvidence = {
      orderNumber: order.order_number,
      courier: order.courier ?? null,
      trackingNumber: order.tracking_number ?? null,
      shippedAt: order.stage_updated_at ?? null,
      stage: order.fulfillment_stage ?? null,
    };
    // Stripe MERGES metadata on update, so the order_id written at checkout
    // survives this and only the fulfillment keys are added or refreshed.
    await stripe.paymentIntents.update(intentId, {
      metadata: fulfillmentMetadata(evidence),
    });
    return { ok: true };
  } catch (e) {
    const reason = String((e as Error)?.message || e).slice(0, 200);
    console.error("[stripe] could not attach fulfillment:", reason);
    return { ok: false, reason };
  }
}
