import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

/** Stripe client, or null when not configured (storefront still works, email-only order path is used). */
export const stripe = key
  ? new Stripe(key, { apiVersion: "2025-02-24.acacia" })
  : null;

export function stripeConfigured() {
  return Boolean(key);
}
