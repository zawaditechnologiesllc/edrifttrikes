import { serverEnv } from "@/lib/env";

/**
 * Letting someone stop the mail, and proving it was them who asked.
 *
 * ═══ WHY THIS BECAME NECESSARY ═════════════════════════════════════════════
 *
 * The old reminder sequence was four emails about an order the recipient had
 * themselves placed, days earlier. That is TRANSACTIONAL: it is about a
 * transaction they started, and no opt-out is required for it.
 *
 * Three a week for two months, carrying a product offer, is not. It is
 * commercial email, and that changes three things at once:
 *
 *   - US CAN-SPAM requires a working opt-out on commercial mail;
 *   - the EU/UK rules this shop already documents (docs/EU-COMPLIANCE.md)
 *     require the same, and this shop sells there;
 *   - Gmail and Yahoo have required one-click List-Unsubscribe from bulk
 *     senders since February 2024, and treat its absence as a spam signal.
 *
 * The third is the one that bites soonest. A spam complaint is scored against
 * the whole sending domain, which is the same domain the ORDER CONFIRMATIONS
 * go out on — so a campaign without an unsubscribe does not merely annoy
 * people, it can stop paying customers hearing that their money arrived. On a
 * domain already carrying an ISP blocklist entry, that is not a small risk.
 *
 * ⚠️ NO UNSUBSCRIBE, NO CAMPAIGN. The sweep refuses to send a reminder that
 * carries an offer if it cannot build an opt-out link for it.
 */

/** How long a token stays valid. Long, because an email sits in an inbox. */
const TOKEN_TTL_DAYS = 400;

const enc = new TextEncoder();

function secret(): string {
  // Reuses the server-to-server secret rather than adding another one to
  // configure and forget. It never leaves the server; only the digest does.
  return serverEnv("INTERNAL_API_KEY") || "";
}

/** Normalised so "A@B.com " and "a@b.com" cannot opt out separately. */
export function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

function toBase64Url(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

/**
 * A token that proves the holder was sent this address's email.
 *
 * ⚠️ SIGNED, NOT GUESSABLE. A bare `?email=` link would let anyone unsubscribe
 * anyone — including a competitor walking a customer list — and the victim
 * would never know, because the only symptom is email that stops arriving.
 *
 * The expiry is baked into the signed payload rather than checked separately,
 * so it cannot be edited off the end of the URL.
 */
export async function optOutToken(
  email: string,
  now: Date = new Date()
): Promise<string> {
  const expires = Math.floor(now.getTime() / 1000) + TOKEN_TTL_DAYS * 86_400;
  const payload = `${normalizeEmail(email)}.${expires}`;
  return `${expires}.${await sign(payload)}`;
}

export type TokenCheck =
  | { ok: true }
  | { ok: false; reason: "malformed" | "expired" | "bad_signature" | "not_configured" };

/** Is this token one we issued for this address, and still live? */
export async function checkOptOutToken(
  email: string,
  token: string,
  now: Date = new Date()
): Promise<TokenCheck> {
  if (!secret()) return { ok: false, reason: "not_configured" };
  const [expiresRaw, signature] = String(token ?? "").split(".");
  const expires = Number(expiresRaw);
  if (!expiresRaw || !signature || !Number.isFinite(expires)) {
    return { ok: false, reason: "malformed" };
  }

  // Signature FIRST, then expiry: checking expiry first tells an attacker
  // which half of a forged token was wrong.
  const expected = await sign(`${normalizeEmail(email)}.${expires}`);
  if (!safeEqual(expected, signature)) return { ok: false, reason: "bad_signature" };
  if (expires * 1000 < now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}

/** Constant-time compare — see lib/internal-auth.ts for why. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The link that appears in the footer of every reminder. */
export async function optOutLink(email: string, siteUrl: string): Promise<string> {
  const base = String(siteUrl || "").replace(/\/+$/, "");
  const token = await optOutToken(email);
  return `${base}/unsubscribe?e=${encodeURIComponent(normalizeEmail(email))}&t=${token}`;
}
