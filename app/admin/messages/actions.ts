"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { sendSupportReply } from "@/lib/email";
import type { ContactMessage } from "@/lib/types";

/**
 * Admin actions for the support inbox (/admin/messages).
 *
 * Replies are emailed to the customer through the same Resend path the rest of
 * the store uses, and recorded on the message so the dashboard shows what was
 * actually said rather than just "handled".
 */

async function requireAdmin() {
  if (!adminConfigured()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/login");
  return user;
}

export type ReplyState = { ok?: boolean; error?: string; message?: string };

/**
 * Send a reply to a customer and record it against their message.
 *
 * The email is sent BEFORE the message is marked replied: if Resend rejects it,
 * the message stays in the inbox as unanswered rather than being quietly filed
 * away with a reply the customer never received.
 */
export async function replyToMessage(
  _prev: ReplyState,
  formData: FormData
): Promise<ReplyState> {
  const user = await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  const reply = String(formData.get("reply") || "").trim().slice(0, 5000);
  if (!id) return { error: "Missing message id." };
  if (!reply) return { error: "Write a reply before sending." };

  const admin = createAdminClient();
  const { data, error: readErr } = await admin
    .from("contact_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { error: `Could not load the message: ${readErr.message}` };
  if (!data) return { error: "Message not found." };
  const msg = data as ContactMessage;

  try {
    await sendSupportReply({
      to: msg.email,
      name: msg.name,
      subject: msg.subject,
      reply,
      original: msg.message,
    });
  } catch (e) {
    // Surface the provider's own reason — "could not send" alone leaves the
    // admin with nothing to act on.
    const reason = String((e as Error)?.message || e).slice(0, 200);
    return { error: `Email not sent: ${reason}` };
  }

  const { error: writeErr } = await admin
    .from("contact_messages")
    .update({
      handled: true,
      reply_body: reply,
      replied_at: new Date().toISOString(),
      replied_by: user.id,
    })
    .eq("id", id);

  revalidatePath("/admin/messages");
  revalidatePath("/admin");

  if (writeErr) {
    // The customer HAS their reply — say so, and be clear the record didn't save
    // so nobody sends it twice.
    return {
      ok: true,
      message: `Reply emailed to ${msg.email}, but it could not be recorded (${writeErr.message}). Run migration 0007 if this is a new deploy.`,
    };
  }

  return { ok: true, message: `Reply sent to ${msg.email}.` };
}

/** Toggle handled without replying — for messages dealt with by phone or in person. */
export async function toggleMessageHandled(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;
  const handled = String(formData.get("handled") || "") === "true";
  await createAdminClient()
    .from("contact_messages")
    .update({ handled: !handled })
    .eq("id", id);
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}
