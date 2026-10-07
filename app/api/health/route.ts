import { NextResponse } from "next/server";
import { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, serverEnv } from "@/lib/env";
import { authorizeNetConfigured } from "@/lib/authorize-net";
import { getStripe } from "@/lib/stripe";
import { learnedAdjustments } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";

/** Adjustments the live Stripe client has learned, or [] when there is none. */
function stripeSessionShape(): string[] {
  const stripe = getStripe();
  return stripe ? learnedAdjustments(stripe as object) : [];
}

/**
 * Configuration health check. Reports which server-side settings the *running*
 * Worker can actually see — as booleans only, never the values. Visit
 * `/api/health` on the deployed site to confirm what's wired.
 *
 * `adminReady: true` means the admin dashboard has everything it needs. If it's
 * false, `supabase.serviceRoleKey` tells you the missing piece — set it as a
 * RUNTIME variable on the Cloudflare Worker (Settings → Variables and Secrets),
 * not only as a build variable, then redeploy.
 */
export async function GET() {
  const has = (v?: string) => Boolean(v && v.length > 0);

  const supabase = {
    url: has(supabaseUrl()),
    anonKey: has(supabaseAnonKey()),
    serviceRoleKey: has(supabaseServiceRoleKey()),
  };

  return NextResponse.json({
    ok: true,
    // Bump on each debug push — if this value doesn't change after a redeploy,
    // your deployment pipeline is serving a stale build.
    diag: "release-2026-10-07b-email-never-blocks-an-order",
    adminReady: supabase.url && supabase.serviceRoleKey,
    supabase,
    render: {
      apiUrl: has(serverEnv("RENDER_API_URL")),
      internalKey: has(serverEnv("INTERNAL_API_KEY")),
    },
    // Direct email from the app (no backend needed) when RESEND_API_KEY is set.
    email: {
      resend: has(serverEnv("RESEND_API_KEY")),
      from: has(serverEnv("EMAIL_FROM")),
    },
    payments: {
      stripe: has(serverEnv("STRIPE_SECRET_KEY")),
      /**
       * What this Stripe account turned out to accept on a Checkout Session.
       *
       * Empty is the normal, healthy answer: either no session has been created
       * since this Worker started, or the account took the request exactly as
       * sent. A value like ["managed_payments=off"] means the account needed
       * negotiating with — see lib/stripe-checkout.ts — and is the first thing
       * to look at after attaching a different Stripe account. Names of
       * parameters only; never a key, never a buyer's details.
       */
      stripeSessionShape: stripeSessionShape(),
      paypal: has(serverEnv("PAYPAL_CLIENT_ID")) && has(serverEnv("PAYPAL_SECRET")),
      // A boolean, never the login id or the key: enough to answer the actual
      // question when Authorize.Net is not appearing at checkout.
      authorizenet: authorizeNetConfigured(),
    },
    turnstile: has(serverEnv("TURNSTILE_SECRET_KEY")),
  });
}
