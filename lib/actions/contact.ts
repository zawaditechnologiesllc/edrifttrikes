"use server";

import { sendContactMessage } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";

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

  // Best-effort persist. A storage failure must not lose the customer their
  // message — the email still goes out and we log the reason.
  if (adminConfigured()) {
    const { error } = await createAdminClient()
      .from("contact_messages")
      .insert({ name: name || null, email, subject: subject || null, message });
    if (error) {
      console.error("[contact] could not store message:", error.message);
    }
  }

  const res = await sendContactMessage({ name, email, subject, message });
  if ((res as { error?: boolean })?.error) return { error: "Could not send. Try again." };
  return { ok: true };
}
