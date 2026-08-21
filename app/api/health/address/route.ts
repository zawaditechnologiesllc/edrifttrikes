import { NextResponse } from "next/server";
import { probeAddressLookup } from "@/lib/address-lookup";

export const dynamic = "force-dynamic";

/**
 * Is address autocomplete actually working on THIS deployment?
 *
 * Visit `/api/health/address` on the live site. It runs a real lookup against
 * whichever provider is configured and reports what came back — which provider
 * is active, whether it answered, and if not, the reason in plain words
 * ("the key is valid but the Places API (New) is not enabled for that project").
 *
 * It exists because a failed lookup is deliberately invisible to buyers: the
 * dropdown simply never appears, which looks identical to "no matches". That is
 * right for a checkout and useless for diagnosis, so the diagnosis lives here.
 *
 * Public, like /api/health, and reports the same kind of thing: booleans and
 * reasons, never a key. Provider error text is mapped to a fixed set of
 * messages rather than passed through.
 */
export async function GET(request: Request) {
  // An optional ?q= lets you check a specific address the geocoder is refusing.
  const q = new URL(request.url).searchParams.get("q") || undefined;
  const result = await probeAddressLookup(q);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
