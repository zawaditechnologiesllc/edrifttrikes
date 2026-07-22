import { supabaseUrl, supabaseAnonKey } from "@/lib/env";

/**
 * Server component that exposes the PUBLIC Supabase config to the browser as
 * `window.__EDRIFT_ENV`. Both values are public by design (the anon key is
 * meant to ship to browsers; RLS is the security boundary) — never add server
 * secrets here.
 *
 * Why: on Cloudflare, NEXT_PUBLIC_* vars are only inlined into the client
 * bundle if they were present at BUILD time. When they're set only as runtime
 * Worker variables, the client bundle ships with empty strings and browser
 * auth breaks. This script fills that gap from the server's runtime env.
 * lib/supabase/client.ts falls back to it.
 */
export default function PublicEnvScript() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl() ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey() ?? "",
  };
  return (
    <script
      dangerouslySetInnerHTML={{
        // <-escape so no value can ever close the script tag early.
        __html: `window.__EDRIFT_ENV=${JSON.stringify(env).replace(/</g, "\\u003c")};`,
      }}
    />
  );
}
