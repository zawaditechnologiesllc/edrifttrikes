import { NextResponse } from "next/server";
import { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

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
    diag: "admin-debug-1",
    adminReady: supabase.url && supabase.serviceRoleKey,
    supabase,
    render: {
      apiUrl: has(serverEnv("RENDER_API_URL")),
      internalKey: has(serverEnv("INTERNAL_API_KEY")),
    },
    payments: {
      stripe: has(serverEnv("STRIPE_SECRET_KEY")),
      paypal: has(serverEnv("PAYPAL_CLIENT_ID")) && has(serverEnv("PAYPAL_SECRET")),
    },
    turnstile: has(serverEnv("TURNSTILE_SECRET_KEY")),
  });
}
