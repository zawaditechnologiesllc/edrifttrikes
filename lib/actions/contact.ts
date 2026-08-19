"use server";

import { sendContactMessage, type ContactSendResult } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { COMPANY } from "@/lib/company";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Contact form submission: store the message, then email it.
 *
 * STORING IS NOT OPTIONAL. Previously this only emailed, and the row in
 * `contact_messages` was written by the Render backend's /contact endpoint —
 * which is the FALLBACK path. On the primary path (RESEND_API_KEY set on the
 * app) email went direct and nothing was ever persisted, so the admin inbox at
 * /admin/messages had nothing to show and a lost email meant a lost customer.
 * The write happens here now, on every path.
 *
 * Order matters: persist first, email second. If the mail provider is down we
 * still have the message and the admin can reply from the dashboard.
 *
 * NOTHING IN HERE MAY THROW. An uncaught throw in a server action surfaces as
 * a 500 in the customer's browser. Every failure below is caught and turned
 * into a returned state.
 */
export async function submitContact(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  // Bound every field — this is unauthenticated public input that gets stored
  // and later rendered in the admin panel.
  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const email = String(formData.get("email") || "").trim().toLowerCase().slice(0, 254);
  const subject = String(formData.get("subject") || "").trim().slice(0, 200);
  const message = String(formData.get("message") || "").trim().slice(0, 5000);

  if (!email || !message) return { error: "Email and message are required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const passed = await verifyTurnstile(String(formData.get("cf-turnstile-response") || ""));
  if (!passed) return { error: "Verification failed. Please try again." };

  // --- 1. Capture the message ------------------------------------------------
  let stored = false;
  if (adminConfigured()) {
    try {
      const { error } = await createAdminClient()
        .from("contact_messages")
        .insert({ name: name || null, email, subject: subject || null, message });
      if (error) {
        console.error("[contact] could not store message:", error.message);
      } else {
        stored = true;
      }
    } catch (e) {
      console.error("[contact] storage threw:", String((e as Error)?.message || e));
    }
  }

  // --- 2. Notify the store and acknowledge the sender ------------------------
  let sent: ContactSendResult = { ownerNotified: false, customerAcknowledged: false };
  try {
    sent = await sendContactMessage({ name, email, subject, message });
  } catch (e) {
    // sendContactMessage is written not to throw; this is the belt to its
    // braces, because the cost of being wrong is a 500 on a support form.
    console.error("[contact] send threw:", String((e as Error)?.message || e));
  }

  // --- 3. Decide what to tell the customer -----------------------------------
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
    return { ok: true };
  }

  // Nothing captured it — say so honestly and give them another way through.
  console.error(`[contact] LOST message from ${email}${sent.error ? `: ${sent.error}` : ""}`);
  return {
    error: `We couldn't record your message just now. Please email us directly at ${COMPANY.supportEmail} and we'll pick it up.`,
  };
}
