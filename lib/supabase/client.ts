import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client (Client Components).
 * Reads the public env vars injected at build time by Vercel.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
