import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailConfig, sendTestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Email diagnostic (admin only). Reflects the app's ACTUAL send path.
 *   GET /api/health/email               → how email is wired (direct Resend vs backend)
 *   GET /api/health/email?to=you@x.com  → sends a real test email, returns the result
 *
 * Admin-gated so it can't be used to send mail to arbitrary addresses. Returns
 * booleans + Resend's exact error (e.g. unverified domain, or the resend.dev
 * test domain that only delivers to your own address) — never a secret.
 */
async function requireAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return data?.role === "admin";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin only. Sign in as an admin first." }, { status: 403 });
  }

  const config = emailConfig();
  const to = new URL(request.url).searchParams.get("to");

  if (!to) {
    return NextResponse.json({
      ...config,
      hint:
        config.via === "none"
          ? "No email configured. Set RESEND_API_KEY (+ EMAIL_FROM) on the app host, then redeploy."
          : "Add ?to=you@example.com to send a real test email.",
    });
  }

  try {
    const result = await sendTestEmail(to);
    return NextResponse.json({ ...config, ...result });
  } catch (e) {
    return NextResponse.json({
      ...config,
      ok: false,
      to,
      error: String((e as Error)?.message || e),
    });
  }
}
