import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase auth session on every request and forwards the
 * updated cookies. Wired up from the root `middleware.ts`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // No Supabase configured yet — let the request through untouched so the
  // storefront still renders during local/static previews.
  if (!url || !anonKey) return response;

  // Fast path for anonymous visitors: if the request carries no Supabase auth
  // cookie there is no session to refresh, so we skip creating a client and
  // the network round-trip to Supabase Auth entirely. Under a traffic spike
  // (e.g. an Instagram drop) the overwhelming majority of requests are
  // logged-out browsers — this keeps that path off Supabase Auth's rate limit
  // and shaves the auth latency from every cached page hit.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasAuthCookie) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
