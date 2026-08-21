import {
  serverEnv,
  supabaseUrl,
  supabaseAnonKey,
  paypalClientId,
  paypalCardFieldsEnabled,
  turnstileSiteKey,
} from "@/lib/env";

/**
 * Server component that exposes PUBLIC config to the browser as
 * `window.__EDRIFT_ENV`. Every value here is public by design (the Supabase anon
 * key ships to browsers and RLS is the security boundary; the PayPal client id
 * ships in the SDK URL) — never add server secrets here.
 *
 * Why: on Cloudflare, NEXT_PUBLIC_* vars are only inlined into the client
 * bundle if they were present at BUILD time. When they're set only as runtime
 * Worker variables, the client bundle ships with empty strings and browser
 * auth/payments break. This script fills that gap from the server's runtime env.
 */
export default function PublicEnvScript() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl() ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey() ?? "",
    NEXT_PUBLIC_PAYPAL_CLIENT_ID: paypalClientId() ?? "",
    NEXT_PUBLIC_PAYPAL_CARD_FIELDS: paypalCardFieldsEnabled() ? "1" : "",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: turnstileSiteKey() ?? "",
    CLOUDFLARE_ANALYTICS_TOKEN: serverEnv("CLOUDFLARE_ANALYTICS_TOKEN") ?? "",
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
