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
  // The backend URL isn't a secret; showing it (admin only) lets you spot a
  // RENDER_API_URL that points at the wrong service.
  const renderApiUrl = base.replace(/\/+$/, "");

  const statusHint = (status: number, body: string) => {
    if (status === 404)
      return "404 — RENDER_API_URL is almost certainly pointing at the wrong service. It must be the /server Express backend (e.g. https://edrift-backend.onrender.com), NOT the Next.js storefront.";
    if (status === 502 || status === 503)
      return `${status} — this is usually a Render free-tier COLD START. The backend was asleep; this request wakes it. Wait ~60s and try again. To stop it sleeping, set the RENDER_BACKEND_URL repo variable so the keep-warm workflow runs (and note: a cold backend also drops order emails, since the app only waits 8s for it).`;
    if (status === 401)
      return "401 — INTERNAL_API_KEY on Cloudflare doesn't match the one on Render.";
    return `Backend returned HTTP ${status}. Body: ${body.slice(0, 160)}`;
  };

  try {
    if (!to) {
      const res = await fetch(`${renderApiUrl}/health`, { cache: "no-store" });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text);
      } catch {
        /* non-JSON body (e.g. a Render error page) */
      }
      return NextResponse.json({
        renderApiUrl,
        renderReachable: res.ok,
        renderStatus: res.status,
        ...(res.ok
          ? { ...data, hint: "Backend reachable. Add ?to=you@example.com to send a real test email." }
          : { hint: statusHint(res.status, text) }),
      });
    }
    const res = await fetch(`${renderApiUrl}/email/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": key },
      body: JSON.stringify({ to }),
      cache: "no-store",
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON */
    }
    return NextResponse.json({
      renderApiUrl,
      renderStatus: res.status,
      ...(res.ok ? data : { hint: statusHint(res.status, text) }),
    });
  } catch (e) {
    return NextResponse.json({
      renderApiUrl,
      renderReachable: false,
      error: `Could not connect to the backend: ${String((e as Error)?.message || e)}`,
      hint: "The host is unreachable — check RENDER_API_URL is the correct backend URL and the service is deployed/running.",
    });
  }
}
