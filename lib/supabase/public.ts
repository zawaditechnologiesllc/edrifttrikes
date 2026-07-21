import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/env";

/**
 * Cookie-free anon Supabase client for PUBLIC catalog/content reads
 * (products, categories, articles). Because it never touches request cookies,
 * pages that only use this client can be statically rendered / ISR-cached
 * instead of being forced dynamic on every request. RLS still applies —
 * the anon key only sees rows the public policies allow.
 *
 * Use lib/supabase/server.ts for anything user-specific (auth, orders, wishlist).
 */
let client: SupabaseClient | null = null;

export function createPublicClient() {
  if (client) return client;
  client = createSupabaseClient(
    supabaseUrl()!,
    supabaseAnonKey()!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return client;
}
