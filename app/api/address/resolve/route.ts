import { NextResponse } from "next/server";
import { resolveAddress } from "@/lib/address-lookup";

/**
 * GET /api/address/resolve?id=…
 *
 * The address components for one picked suggestion. Called only when the buyer
 * actually clicks an address, which is what keeps the provider bill down —
 * Google charges for the details lookup, not the predictions.
 *
 * Suggestions that already carry their components (the keyless Census
 * fallback) never reach here.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const prefill = await resolveAddress(id);
  return NextResponse.json(
    { prefill },
    { headers: { "cache-control": "private, no-store" } }
  );
}
