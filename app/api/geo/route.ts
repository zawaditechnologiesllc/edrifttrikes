import { NextResponse } from "next/server";
import { originFromRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * The visitor's country, as Cloudflare's edge sees it.
 *
 * ═══ WHY THIS IS ITS OWN ENDPOINT ══════════════════════════════════════════
 *
 * /api/settings already exists and the browser already fetches it on mount, so
 * riding along there would cost nothing. It would also be a serious bug: that
 * response carries `Cache-Control: public, max-age=60`, which means a shared
 * cache may hand one visitor's body to the next one. Per-visitor data in a
 * shared-cached response is how a German buyer gets told they look American —
 * or worse, how any future personalisation leaks.
 *
 * So this is separate and explicitly `no-store`. One small request, on the
 * pages that actually have a question to ask, and never reused between people.
 *
 * ⚠️ IT RETURNS A COUNTRY, NOT A DECISION. Nothing here redirects, sets a
 * preference or writes anything down. The browser decides whether that country
 * is worth mentioning (lib/geo.ts) and the visitor decides whether to act on
 * it. See RegionSwitchNotice for why that separation is the whole point.
 */
export function GET(request: Request): Response {
  // Null off-Cloudflare (local development, a plain Node host), which is the
  // right answer: no signal is not the same as "nowhere in particular", and
  // the client shows nothing at all for null.
  const { country } = originFromRequest(request);

  return NextResponse.json(
    { country: country ?? null },
    {
      headers: {
        // Per-visitor. Never a shared cache, never a disk cache, and `Vary` so
        // any intermediary that ignores the first two still keys on the header
        // this is derived from.
        "Cache-Control": "no-store, private",
        Vary: "CF-IPCountry",
      },
    }
  );
}
