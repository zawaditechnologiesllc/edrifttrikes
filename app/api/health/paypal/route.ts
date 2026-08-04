import { NextResponse } from "next/server";
import { probePayPal } from "@/lib/paypal";

export const dynamic = "force-dynamic";

/**
 * PayPal connectivity diagnostic. Visit on the live site:
 *   /api/health/paypal        → tests OAuth (safe, creates nothing)
 *   /api/health/paypal?full=1 → also creates a throwaway $1 order (never
 *                               captured; exercises landing_page etc.)
 *
 * Returns booleans + PayPal's own error text — never any secret. Use it to see
 * exactly why checkout says "PayPal is unavailable": a 401 invalid_client means
 * the credentials are wrong or don't match `env` (sandbox vs live).
 */
export async function GET(request: Request) {
  const full = new URL(request.url).searchParams.get("full") === "1";
  return NextResponse.json(await probePayPal(full));
}
