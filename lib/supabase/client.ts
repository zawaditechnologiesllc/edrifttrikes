"use client";

import { createBrowserClient } from "@supabase/ssr";

declare global {
  interface Window {
    __EDRIFT_ENV?: {
      NEXT_PUBLIC_SUPABASE_URL?: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    };
  }
}

/**
 * Supabase browser client (Client Components).
 *
 * Reads the public env vars inlined at build time when available, falling back
 * to `window.__EDRIFT_ENV` — injected per-request by the root layout from the
 * server's runtime env (see components/PublicEnvScript.tsx). The fallback keeps
 * login/wishlist working on Cloudflare even when NEXT_PUBLIC_* vars were only
 * set as runtime Worker variables, not as build variables.
 */
export function createClient() {
  const injected = typeof window !== "undefined" ? window.__EDRIFT_ENV : undefined;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || injected?.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || injected?.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}
