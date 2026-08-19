import { serverEnv } from "@/lib/env";

/**
 * Shared-secret auth for server-to-server calls (Render → the app, scheduled
 * cron pings). The secret is INTERNAL_API_KEY, set to the same value on both
 * Cloudflare and Render.
 */

/**
 * Constant-time string compare.
 *
 * A plain `===` on a secret leaks its prefix through response timing, which is
 * enough to recover the key one byte at a time given enough requests. Workers
 * has no crypto.timingSafeEqual, so this compares every byte regardless of
 * where the first mismatch is.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True when the request carries the internal shared secret, via the
 * `x-internal-key` header or an `Authorization: Bearer` token.
 *
 * Returns FALSE when no key is configured: an unset secret must fail closed,
 * or these endpoints would be wide open on a half-configured deployment.
 */
export function isInternalRequest(request: Request): boolean {
  const expected = serverEnv("INTERNAL_API_KEY") || "";
  if (!expected) return false;

  const header = request.headers.get("x-internal-key") || "";
  if (header && safeEqual(header, expected)) return true;

  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    return safeEqual(auth.slice(7), expected);
  }
  return false;
}
