"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/admin";
import { publicSiteUrl } from "@/lib/env";
import { sendWelcomeEmail } from "@/lib/email";

export type AuthState = { error?: string; message?: string };

const NOT_CONFIGURED =
  "Accounts aren't live yet — the store hasn't been connected to Supabase.";

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email and password are required." };

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
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

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

export async function signOut() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
