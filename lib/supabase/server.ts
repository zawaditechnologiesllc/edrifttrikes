import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl, supabaseAnonKey } from "@/lib/env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Supabase server client (Server Components, Route Handlers, Server Actions).
 * Uses the request cookie store so auth sessions are read/written correctly.
 * Reads config via the robust env helper so it works from runtime Worker
 * variables (SUPABASE_URL / SUPABASE_ANON_KEY) as well as build-time NEXT_PUBLIC.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl()!,
    supabaseAnonKey()!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` called from a Server Component — safe to ignore when
            // middleware is responsible for refreshing the session.
          }
        },
      },
    }
  );
}
