import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

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
