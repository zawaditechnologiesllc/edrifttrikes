import { NextResponse } from "next/server";
import { createAdminClient, supabaseConfigured } from "@/lib/supabase/admin";
import {
  apiLoginId,
  authorizeNetConfigured,
  fetchTransaction,
} from "@/lib/authorize-net";
import { markOrderPaid, loadOrder, recordGatewayIds } from "@/lib/orders";
import { publicSiteUrl } from "@/lib/env";
import type { Order } from "@/lib/types";

/**
 * Where Authorize.Net sends the buyer back after the hosted payment page.
 *
 * ═══ THE BUYER CONTROLS THIS REQUEST ═══════════════════════════════════════
 *
 * Every value that arrives here — the order number in the query string, the
 * transaction id in the form body — came back through the buyer's browser and
 * can be changed. NOTHING here is taken on trust. The order is only marked paid
 * after the gateway itself, asked directly, says the transaction is approved,
 * belongs to this order, and is for the right amount.
 *
 * Without that, a buyer approves a cheap order and points the return at an
 * expensive one. The PayPal capture route guards the same attack the same way.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Authorize.Net POSTs the return, so this handles POST; GET is accepted too
 * because a buyer who reloads the page lands on one.
 */

export const dynamic = "force-dynamic";

type Verdict =
  | { ok: true; order: Order }
  | { ok: false; reason: string; order?: Order };

/** Does what the gateway says actually match the order we are about to pay? */
async function verify(
  orderNumber: string,
  transId: string
): Promise<Verdict> {
  if (!supabaseConfigured()) return { ok: false, reason: "not_configured" };
  const admin = createAdminClient();
  const order = await loadOrder(admin, { orderNumber });
  if (!order) return { ok: false, reason: "order not found" };

  if (!authorizeNetConfigured()) {
    return { ok: false, reason: "not_configured", order };
  }

  // The account that CREATED the payment page must be the one asked about it.
  // Credentials get swapped; a lookup with the new account's keys cannot see
  // the old account's transaction, and the gateway's error for that is opaque.
  // Refusing here is deliberate — the money did move, but nothing we can reach
  // proves it, so an admin marks the order paid by hand rather than the site
  // taking the buyer's word for it.
  const recorded = (order.gateway_account || "").trim();
  if (recorded && recorded !== apiLoginId()) {
    return {
      ok: false,
      reason: `order was taken on gateway account ${recorded}, which is no longer configured`,
      order,
    };
  }

  let transaction;
  try {
    transaction = await fetchTransaction(transId);
  } catch (e) {
    return {
      ok: false,
      reason: String((e as Error)?.message || e).slice(0, 200),
      order,
    };
  }

  // HELD FOR REVIEW IS NOT PAID. The gateway has the transaction but has not
  // approved it; the webhook resolves it later. Marking it paid here ships
  // goods against money that may never arrive.
  if (transaction.heldForReview) {
    return { ok: false, reason: "held_for_review", order };
  }
  if (!transaction.paid) {
    return { ok: false, reason: transaction.message || "not approved", order };
  }

  // IDENTITY — the gateway's own record must name this order.
  if (transaction.orderNumber && transaction.orderNumber !== order.order_number) {
    return {
      ok: false,
      reason: `transaction belongs to ${transaction.orderNumber}`,
      order,
    };
  }

  // AMOUNT — what was taken must be what was owed. A stale or tampered
  // transaction could otherwise settle a large order for a small sum.
  if (transaction.amountCents !== order.total_cents) {
    return {
      ok: false,
      reason: `amount mismatch: took ${transaction.amountCents}, owed ${order.total_cents}`,
      order,
    };
  }

  await recordGatewayIds(admin, order.id, {
    reference: transaction.transId,
    account: apiLoginId(),
  });

  // The shared transition: sets paid_at, moves to `confirmed`, emails the
  // receipt, and is idempotent — so the webhook arriving later is a no-op.
  const paid = await markOrderPaid(
    admin,
    { id: order.id },
    { paidVia: "authorizenet" }
  );
  if (!paid.ok) return { ok: false, reason: paid.reason ?? "could not mark paid", order };

  return { ok: true, order: paid.order ?? order };
}

/** Read the transaction id out of whichever shape the return took. */
async function transactionId(request: Request): Promise<string> {
  const url = new URL(request.url);
  const fromQuery =
    url.searchParams.get("transId") || url.searchParams.get("transactionId") || "";
  if (fromQuery) return fromQuery;
  if (request.method !== "POST") return "";
  try {
    const form = await request.formData();
    // Authorize.Net posts a JSON blob under `response` on some configurations
    // and flat fields on others; accept both rather than depending on one.
    const flat = String(form.get("transId") || form.get("x_trans_id") || "");
    if (flat) return flat;
    const blob = String(form.get("response") || "");
    if (!blob) return "";
    const parsed = JSON.parse(blob) as { transId?: string };
    return String(parsed.transId || "");
  } catch {
    return "";
  }
}

async function handle(request: Request) {
  const site = publicSiteUrl() || new URL(request.url).origin;
  const orderNumber = (new URL(request.url).searchParams.get("order") || "").trim();
  const transId = await transactionId(request);

  if (!orderNumber || !transId) {
    return NextResponse.redirect(`${site}/checkout?payment=incomplete`, 303);
  }

  const verdict = await verify(orderNumber, transId);

  if (verdict.ok) {
    return NextResponse.redirect(
      `${site}/order-confirmation?order=${encodeURIComponent(verdict.order.order_number)}`,
      303
    );
  }

  // Held for review is not a failure the buyer caused, and telling them the
  // card was declined would be wrong — the order stands, pending the outcome.
  if (verdict.reason === "held_for_review") {
    console.warn(`[authorize-net] ${orderNumber} held for review`);
    return NextResponse.redirect(
      `${site}/order-confirmation?order=${encodeURIComponent(orderNumber)}&payment=review`,
      303
    );
  }

  console.error(`[authorize-net] return refused for ${orderNumber}: ${verdict.reason}`);
  return NextResponse.redirect(`${site}/checkout?payment=failed`, 303);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
