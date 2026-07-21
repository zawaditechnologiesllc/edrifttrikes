import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

/**
 * Stripe client, or null when not configured (storefront still works, the
 * email-only order path is used). Uses the fetch-based HTTP client so it runs
 * on the Cloudflare Workers runtime (OpenNext) as well as Node.
 */
export const stripe = key
  ? new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

export function stripeConfigured() {
  return Boolean(key);
}
