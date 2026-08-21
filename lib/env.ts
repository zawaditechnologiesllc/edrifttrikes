/**
 * Robust server-side env reader for the Cloudflare Workers runtime (OpenNext)
 * and Node alike.
 *
 * Why this exists: on Cloudflare, `NEXT_PUBLIC_*` values are inlined at BUILD
 * time, while server secrets (service-role key, etc.) are read at RUNTIME from
 * the Worker's bindings. If a secret is set as a *runtime* Worker variable it
 * shows up in `process.env`; if for any reason it doesn't, we fall back to
 * reading the Cloudflare binding env directly. We also accept the non-public
 * `SUPABASE_URL` / `SUPABASE_ANON_KEY` names (same as the Render service uses)
 * so the server keeps working even if the public build-time vars are missing.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Read directly from the Cloudflare binding env (works even if process.env wasn't populated). */
function fromCloudflare(name: string): string | undefined {
  try {
    const env = getCloudflareContext().env as Record<string, unknown> | undefined;
    const v = env?.[name];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  } catch {
    // Not in the Cloudflare runtime (e.g. build/static generation or Node).
    return undefined;
  }
}

/** Read a runtime env var by name from process.env, falling back to the CF binding. */
export function serverEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  return fromCloudflare(name);
}

/**
 * Raw `BLOCKED_COUNTRIES`, preserving an EMPTY value.
 *
 * `serverEnv()` treats an empty string as absent — right for a key, WRONG for
 * this: an empty list is how the owner turns the country block off without a
 * deploy, and it has to stay distinguishable from the variable never having
 * been set (which falls back to the default). Hence `??` on process.env first,
 * not `||`.
 */
export function blockedCountriesRaw(): string | undefined {
  const direct = process.env.BLOCKED_COUNTRIES;
  if (direct !== undefined) return direct;
  return serverEnv("BLOCKED_COUNTRIES");
}

/** Supabase project URL for server code (accepts SUPABASE_URL or the public one). */
export function supabaseUrl(): string | undefined {
  return (
    serverEnv("SUPABASE_URL") ||
    serverEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    // Build-time inlined literal (static access) — final fallback.
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    undefined
  );
}

/** Supabase anon key for server code (accepts SUPABASE_ANON_KEY or the public one). */
export function supabaseAnonKey(): string | undefined {
  return (
    serverEnv("SUPABASE_ANON_KEY") ||
    serverEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    undefined
  );
}

/** Supabase service-role secret (server only; bypasses RLS). */
export function supabaseServiceRoleKey(): string | undefined {
  return serverEnv("SUPABASE_SERVICE_ROLE_KEY");
}

/** Canonical public site URL (redirects, payment return URLs, auth emails). */
export function publicSiteUrl(): string | undefined {
  return (
    serverEnv("NEXT_PUBLIC_SITE_URL") ||
    // Build-time inlined literal (static access) — final fallback.
    process.env.NEXT_PUBLIC_SITE_URL ||
    undefined
  );
}

/**
 * PayPal client id for the BROWSER SDK (inline card fields). The client id is
 * public by design — it ships in the SDK script URL — so this is safe to expose.
 * The SDK infers sandbox vs live from which client id it is.
 */
export function paypalClientId(): string | undefined {
  return (
    serverEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID") ||
    serverEnv("PAYPAL_CLIENT_ID") ||
    undefined
  );
}

/**
 * Opt-in flag: render PayPal's inline card fields on /checkout instead of the
 * redirect. Off by default so production is unchanged until it's set to "1".
 */
export function paypalCardFieldsEnabled(): boolean {
  return (serverEnv("NEXT_PUBLIC_PAYPAL_CARD_FIELDS") || "") === "1";
}

/**
 * Turnstile SITE key for the browser widget. Public by design — it ships in the
 * widget markup.
 *
 * Exists for the same reason as the PayPal/Supabase readers: on Cloudflare,
 * NEXT_PUBLIC_* is inlined at BUILD time, so a key set only as a runtime Worker
 * variable never reaches the client bundle. Without this, the widget silently
 * fails to render while the server still demands a token — which rejects every
 * real submission.
 */
export function turnstileSiteKey(): string | undefined {
  return (
    serverEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY") ||
    serverEnv("TURNSTILE_SITE_KEY") ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    undefined
  );
}
