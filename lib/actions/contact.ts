"use server";

import { sendContactMessage } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";

export async function submitContact(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  if (!email || !message) return { error: "Email and message are required." };

  const passed = await verifyTurnstile(String(formData.get("cf-turnstile-response") || ""));
  if (!passed) return { error: "Verification failed. Please try again." };

  const res = await sendContactMessage({ name, email, subject, message });
  if ((res as { error?: boolean })?.error) return { error: "Could not send. Try again." };
  return { ok: true };
}
