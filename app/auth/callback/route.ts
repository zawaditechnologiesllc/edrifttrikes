import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Only allow same-site relative redirect targets. Anything that isn't a plain
 * `/path` (absolute URLs, protocol-relative `//host`, backslash tricks) falls
 * back to the account page — this closes the open-redirect vector on `next`.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/account";
  // Must start with a single "/", and must not begin with "//" or "/\" which
  // browsers can treat as a protocol-relative URL to another host.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/account";
  }
  return raw;
}

// Handles the email-confirmation / magic-link / password-recovery redirect
// from Supabase.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // This is the moment an address becomes proven — email confirmation, a
      // magic link, or an accepted invite. Attach any orders placed with it
      // BEFORE redirecting, so the dashboard is already correct on arrival
      // rather than filling in on some later visit.
      const { syncOrdersForCurrentUser } = await import("@/lib/orders");
      await syncOrdersForCurrentUser();
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
