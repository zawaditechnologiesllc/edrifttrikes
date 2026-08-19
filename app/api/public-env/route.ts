import { NextResponse } from "next/server";
import { turnstileSiteKey, paypalClientId, paypalCardFieldsEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Public runtime configuration for the browser.
 *
 * Everything here is public by design (a Turnstile site key and a PayPal client
 * id both ship in markup) — never add a server secret.
 *
 * WHY THIS EXISTS, when the root layout already injects the same values via
 * components/PublicEnvScript.tsx: that script only carries runtime values on
 * DYNAMICALLY rendered pages. A statically prerendered page (e.g. /support)
 * has its layout rendered at BUILD time, so the injected object is baked with
 * whatever the build saw — empty, when the variable is set only as a runtime
 * Worker variable.
 *
 * That was the exact cause of the contact form's "Verification failed": the
 * Turnstile widget never rendered because the site key was empty in the static
 * HTML, so no token was ever submitted, and the server — whose secret IS
 * readable at runtime — rejected every genuine message.
 *
 * Components fetch this on mount to fill the gap, the same way
 * SiteSettingsProvider re-fetches /api/settings.
 */
export async function GET() {
  return NextResponse.json(
    {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: turnstileSiteKey() ?? "",
      NEXT_PUBLIC_PAYPAL_CLIENT_ID: paypalClientId() ?? "",
      NEXT_PUBLIC_PAYPAL_CARD_FIELDS: paypalCardFieldsEnabled() ? "1" : "",
    },
    // Short cache: these change only on redeploy, but a stale key would break
    // the forms, so keep the window small.
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
