import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Email diagnostic (admin only). Verifies the app can actually deliver mail.
 *   GET /api/health/email               → reports the Render backend's email config
 *   GET /api/health/email?to=you@x.com  → sends a real test email to that address
 *
 * Admin-gated so it can't be used to send mail to arbitrary addresses. Returns
 * Resend's exact error (e.g. unverified domain, or the resend.dev test domain
 * that only delivers to your own address) — never a secret.
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

  const base = serverEnv("RENDER_API_URL") || "";
  const key = serverEnv("INTERNAL_API_KEY") || "";
  if (!base) {
    return NextResponse.json({ error: "RENDER_API_URL is not set on Cloudflare — the app can't reach the email backend." });
  }

  const to = new URL(request.url).searchParams.get("to");

  try {
    if (!to) {
      // Just report the backend's email config (no send).
      const res = await fetch(`${base}/health`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ renderReachable: res.ok, ...data, hint: "Add ?to=you@example.com to send a real test email." });
    }
    const res = await fetch(`${base}/email/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": key },
      body: JSON.stringify({ to }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ renderStatus: res.status, ...data });
  } catch (e) {
    return NextResponse.json({ error: `Could not reach the email backend: ${String((e as Error)?.message || e)}` });
  }
}
