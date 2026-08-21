import { NextResponse } from "next/server";
import { MIN_QUERY_LENGTH, suggestAddresses, usableQuery } from "@/lib/address-lookup";

/**
 * GET /api/address/suggest?q=…&country=US
 *
 * Addresses matching what the buyer has typed. Exists so the geocoding key
 * stays on the server — see lib/address-lookup.ts.
 *
 * Deliberately returns 200 with an empty list for anything it won't look up.
 * The caller is a keystroke handler on a checkout form; a 400 there would put a
 * red error under a field the buyer is still typing into.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? "";
  const country = params.get("country");

  if (!usableQuery(q)) {
    return NextResponse.json({ suggestions: [], minLength: MIN_QUERY_LENGTH });
  }

  const { suggestions, provider } = await suggestAddresses(q, country);
  return NextResponse.json(
    { suggestions, provider },
    {
      headers: {
        // Per-buyer, half-typed input: never store it anywhere shared.
        "cache-control": "private, no-store",
      },
    }
  );
}
