"use server";

import { createAdminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { sendNewsletterConfirmation } from "@/lib/email";

export async function subscribeNewsletter(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { error: "Enter a valid email." };
  if (!supabaseConfigured()) return { ok: true };

  try {
    const supabase = createAdminClient();
    await supabase.from("newsletter_subscribers").upsert({ email }, { onConflict: "email" });
    await sendNewsletterConfirmation(email).catch(() => {});
    return { ok: true };
  } catch {
    return { error: "Could not subscribe. Try again." };
  }
}
