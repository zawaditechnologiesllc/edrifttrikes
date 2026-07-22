/**
 * Cloudflare Turnstile — invisible/CAPTCHA bot protection for public forms
 * (contact, newsletter). Server-side token verification.
 *
 * Configure with TURNSTILE_SECRET_KEY (server) and NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * (client widget). When the secret is absent, verifyTurnstile() returns true so
 * forms keep working locally / before you wire it up — exactly like the payment
 * providers. Add both keys in Cloudflare + redeploy to switch protection on.
 */
// Read at CALL time (not module scope): on Cloudflare the secret is a runtime
// Worker binding that isn't visible when the module is first evaluated.
import { serverEnv } from "@/lib/env";

function secretKey(): string {
  return serverEnv("TURNSTILE_SECRET_KEY") || "";
}

/** True when server-side verification is active. */
export function turnstileConfigured() {
  return Boolean(secretKey());
}

/**
 * Verify a Turnstile token with Cloudflare. Returns true when Turnstile isn't
 * configured (so nothing breaks pre-setup), false only when configured AND the
 * token is missing/invalid.
 */
export async function verifyTurnstile(token: string | null, remoteip?: string): Promise<boolean> {
  const secret = secretKey();
  if (!secret) return true; // not configured — don't block
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.append("secret", secret);
    body.append("response", token);
    if (remoteip) body.append("remoteip", remoteip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({ success: false }))) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
