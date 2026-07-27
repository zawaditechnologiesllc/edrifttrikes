"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/admin";
import { publicSiteUrl } from "@/lib/env";
import { sendWelcomeEmail } from "@/lib/email";

export type AuthState = { error?: string; message?: string };

const NOT_CONFIGURED =
  "Accounts aren't live yet — the store hasn't been connected to Supabase.";

// Basic, permissive email shape check. Supabase does the authoritative
// validation; this just catches obvious typos before the round-trip and
// bounds what we forward.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cleanEmail(formData: FormData): string {
  return String(formData.get("email") || "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  const email = cleanEmail(formData);
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email and password are required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/account");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  const email = cleanEmail(formData);
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm_password") || "");
  const fullName = String(formData.get("full_name") || "").trim().slice(0, 120);
  if (!email || !password) return { error: "Email and password are required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  // Confirm is optional-but-checked: the client always sends it on register,
  // and if it's present it must match. (Blank means an old/edge client.)
  if (confirm && confirm !== password)
    return { error: "Passwords don't match." };

  const supabase = await createClient();
  const siteUrl = publicSiteUrl() || "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  // Fire a branded welcome email (best-effort).
  try {
    await sendWelcomeEmail(email, fullName);
  } catch {
    /* non-fatal */
  }

  if (data.session) redirect("/account");
  return {
    message:
      "Check your email to confirm your account, then sign in to access the garage.",
  };
}

/**
 * Send a password-reset email. The link lands on /auth/callback (which
 * exchanges the recovery code for a session) and then forwards to the
 * update-password page. Always returns a success-shaped message so we never
 * leak whether an email is registered.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  const email = cleanEmail(formData);
  if (!email || !EMAIL_RE.test(email))
    return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const siteUrl = publicSiteUrl() || "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/account/update-password`,
  });
  // Don't reveal account existence — same message either way.
  return {
    message:
      "If that email is registered, a reset link is on its way. Check your inbox.",
  };
}

/** Set a new password for the user in the current (recovery) session. */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm_password") || "");
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error: "Your reset link has expired. Request a new one from the login page.",
    };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/account");
}

export async function signOut() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
