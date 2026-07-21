import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } from "@/lib/env";

/**
 * Service-role Supabase client — SERVER ONLY.
 * Bypasses RLS for privileged operations (creating orders, webhooks, seeding).
 * Never import this into a Client Component.
 */
export function createAdminClient() {
  const url = supabaseUrl();
  const serviceKey = supabaseServiceRoleKey();
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) as RUNTIME variables on the Cloudflare Worker."
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** True when Supabase env is present, so pages can render gracefully without it. */
export function supabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

/** True when the server-side service role is also present (admin features). */
export function adminConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey());
}
