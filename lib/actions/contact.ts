"use server";

import { headers } from "next/headers";
import { sendContactMessage, type ContactSendResult } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { COMPANY } from "@/lib/company";
import { serverEnv } from "@/lib/env";
import {
  CONTACT_COOLDOWN_SECONDS,
  cooldownRemaining,
  formatWait,
} from "@/lib/rate-limit";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ContactState = {
  ok?: boolean;
  error?: string;
  /** Seconds the sender must wait before trying again. Drives the countdown. */
  retryAfterSeconds?: number;
};

/**
 * Salted hash of the sender's IP, for rate limiting without storing the address.
 *
 * The salt is a server secret, so the stored hashes cannot be brute-forced back
 * to IPs by anyone who obtains the table (the IPv4 space is small enough to
 * enumerate without one).
 */
async function hashSenderIp(): Promise<string | null> {
  try {
    const h = await headers();
    // Cloudflare sets cf-connecting-ip; the others are fallbacks for other hosts.
    const ip =
      h.get("cf-connecting-ip") ||
      h.get("x-real-ip") ||
      (h.get("x-forwarded-for") || "").split(",")[0].trim();
    if (!ip) return null;

    const salt = serverEnv("INTERNAL_API_KEY") || "edrift-contact-salt";
    const data = new TextEncoder().encode(`${salt}:${ip}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // No header access or no Web Crypto — rate limiting falls back to email only.
    return null;
  }
}

/**
 * How long this sender must wait, based on their most recent message.
 *
 * Checks the email AND the IP hash: email alone is defeated by typing a
 * different address, which is precisely what a spammer does.
 */
async function waitRequired(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  ipHash: string | null
): Promise<number> {
  // A failed lookup (e.g. migration 0009 not run) must not block a legitimate
  // sender, so each resolves to null rather than rejecting. Wrapped in an async
  // function because the Supabase builder is a PromiseLike with no .catch().
  const lastSentWhere = async (
    column: "email" | "sender_ip_hash",
    value: string
  ): Promise<string | null> => {
    try {
      const { data, error } = await admin
        .from("contact_messages")
        .select("created_at")
        .eq(column, value)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data?.created_at as string) ?? null;
    } catch {
      return null;
    }
  };

  const results = await Promise.all([
    lastSentWhere("email", email),
    ...(ipHash ? [lastSentWhere("sender_ip_hash", ipHash)] : []),
  ]);

  // The longest outstanding cooldown wins.
  return Math.max(0, ...results.map((at) => cooldownRemaining(at)));
}

/**
 * Contact form submission: rate limit, store the message, then email it.
 *
 * STORING IS NOT OPTIONAL. On the primary path (RESEND_API_KEY on the app)
 * email goes direct, so nothing else persists the message — without this write
 * the admin inbox at /admin/messages would be empty and a lost email would mean
 * a lost customer.
 *
 * Order matters: persist first, email second. If the mail provider is down we
 * still have the message and the admin can reply from the dashboard.
 *
 * NOTHING IN HERE MAY THROW. An uncaught throw in a server action surfaces as a
 * 500 in the customer's browser. Every failure below is caught and returned.
 */
export async function submitContact(
  _prev: ContactState | undefined,
  formData: FormData
): Promise<ContactState> {
  // Bound every field — this is unauthenticated public input that gets stored
  // and later rendered in the admin panel.
  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const email = String(formData.get("email") || "").trim().toLowerCase().slice(0, 254);
  const subject = String(formData.get("subject") || "").trim().slice(0, 200);
  const message = String(formData.get("message") || "").trim().slice(0, 5000);

  if (!email || !message) return { error: "Email and message are required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const passed = await verifyTurnstile(String(formData.get("cf-turnstile-response") || ""));
  if (!passed) {
    return {
      error:
        "We couldn't verify you're human. Complete the check above and try again — " +
        "if you don't see one, reload the page.",
    };
  }

  const ipHash = await hashSenderIp();

  // --- 1. Rate limit -------------------------------------------------------
  // Enforced server-side against stored timestamps, so it survives a page
  // reload, a new tab, or a script — the client countdown is only the courtesy.
  if (adminConfigured()) {
    try {
      const wait = await waitRequired(createAdminClient(), email, ipHash);
      if (wait > 0) {
        return {
          error: `You've just sent us a message. Please wait ${formatWait(
            wait
          )} before sending another — we'll reply to the first one.`,
          retryAfterSeconds: wait,
        };
      }
    } catch (e) {
      // Never let the limiter itself block a genuine message.
      console.error("[contact] rate-limit check failed:", String((e as Error)?.message || e));
    }
  }

  // --- 2. Capture the message ----------------------------------------------
  let stored = false;
  if (adminConfigured()) {
    const admin = createAdminClient();
    const row: Record<string, unknown> = {
      name: name || null,
      email,
      subject: subject || null,
      message,
      sender_ip_hash: ipHash,
    };
    try {
      let { error } = await admin.from("contact_messages").insert(row);
      // Migration 0009 not run yet → the column doesn't exist. Store the
      // message anyway; losing rate limiting beats losing the customer.
      if (error && ipHash) {
        delete row.sender_ip_hash;
        ({ error } = await admin.from("contact_messages").insert(row));
      }
      if (error) console.error("[contact] could not store message:", error.message);
      else stored = true;
    } catch (e) {
      console.error("[contact] storage threw:", String((e as Error)?.message || e));
    }
  }

  // --- 3. Notify the store and acknowledge the sender ----------------------
  let sent: ContactSendResult = { ownerNotified: false, customerAcknowledged: false };
  try {
    sent = await sendContactMessage({ name, email, subject, message });
  } catch (e) {
    // sendContactMessage is written not to throw; this is the belt to its
    // braces, because the cost of being wrong is a 500 on a support form.
    console.error("[contact] send threw:", String((e as Error)?.message || e));
  }

  // --- 4. Decide what to tell the customer ---------------------------------
  // The message counts as delivered if it landed ANYWHERE we'll see it: the
  // admin inbox or the store's mailbox. A failed acknowledgement email is not
  // the customer's problem and must not be reported as a failure — telling
  // someone their message failed when it is sitting in /admin/messages is worse
  // than saying nothing, because they give up instead of waiting for a reply.
  if (stored || sent.ownerNotified) {
    if (!sent.customerAcknowledged) {
      console.warn(
        `[contact] message from ${email} captured but no acknowledgement sent` +
          (sent.error ? `: ${sent.error}` : "")
      );
    }
    return { ok: true, retryAfterSeconds: CONTACT_COOLDOWN_SECONDS };
  }

  // Nothing captured it — say so honestly and give them another way through.
  console.error(`[contact] LOST message from ${email}${sent.error ? `: ${sent.error}` : ""}`);
  return {
    error: `We couldn't record your message just now. Please email us directly at ${COMPANY.supportEmail} and we'll pick it up.`,
  };
}
