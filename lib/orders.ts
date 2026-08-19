/**
 * Order lifecycle transitions — the ONE implementation of "this order is now
 * paid" and "this order has reached a new stage".
 *
 * Every payment path funnels through here so the behaviour can't drift:
 *   Stripe webhook (Render) → POST /api/internal/order-paid → markOrderPaid()
 *   PayPal capture (app)    → markOrderPaid()
 *   Admin sets status=paid  → markOrderPaid()
 *   Scheduler (cron)        → advanceOrder()
 *
 * IDEMPOTENCY is enforced in the database, not in application logic: the
 * `order_events` table has UNIQUE (order_id, stage), so a duplicate webhook, a
 * PayPal retry and a double-clicked admin button all collide on the insert and
 * only the first one sends an email.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderEvent } from "@/lib/types";
import { sendFulfillmentEmail } from "@/lib/email";
import {
  STAGE_COPY,
  dueStage,
  estimatedDeliveryAt,
  isSchedulable,
  stageMessage,
  stagesBetween,
  type FulfillmentStage,
} from "@/lib/fulfillment";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Admin = SupabaseClient<any, any, any>;

const ORDER_SELECT = "*, items:order_items(*)";

/**
 * Claim a stage for an order.
 *
 * Returns true only for the caller that actually inserted the row — the unique
 * (order_id, stage) constraint makes everyone else lose the race and get false.
 * That boolean is what gates the email, so "send once" survives concurrent
 * webhooks and cron overlap without any locking.
 */
async function claimStage(
  admin: Admin,
  orderId: string,
  stage: FulfillmentStage,
  opts: { email: boolean; detail?: string } = { email: true }
): Promise<boolean> {
  const copy = STAGE_COPY[stage];
  const { error } = await admin.from("order_events").insert({
    order_id: orderId,
    stage,
    title: copy.title,
    detail: opts.detail ?? null,
    email_sent: opts.email,
  });
  // 23505 = unique_violation → another process already claimed this stage.
  if (error) {
    if (error.code === "23505") return false;
    // Anything else (e.g. migration 0006 not run yet) must not silently swallow
    // the transition — log it and let the caller continue without the email.
    console.error(`[orders] could not record ${stage} event:`, error.message);
    return false;
  }
  return true;
}

/** Load an order with its items by id or order_number. */
export async function loadOrder(
  admin: Admin,
  by: { id?: string; orderNumber?: string; paypalOrderId?: string }
): Promise<Order | null> {
  let query = admin.from("orders").select(ORDER_SELECT);
  if (by.id) query = query.eq("id", by.id);
  else if (by.orderNumber) query = query.eq("order_number", by.orderNumber);
  else if (by.paypalOrderId) query = query.eq("stripe_session_id", by.paypalOrderId);
  else return null;
  const { data } = await query.maybeSingle();
  return (data as Order) ?? null;
}

export type PaidResult = {
  ok: boolean;
  /** True when THIS call performed the transition (and sent the email). */
  transitioned: boolean;
  order?: Order;
  reason?: string;
};

/**
 * Mark an order paid and start its delivery journey.
 *
 * Sets paid_at (the anchor every later stage counts from), moves the order to
 * the `confirmed` stage, stores the quoted delivery date, and sends the
 * shipping confirmation email — exactly once, however many times it's called.
 */
export async function markOrderPaid(
  admin: Admin,
  by: { id?: string; orderNumber?: string; paypalOrderId?: string },
  opts: { paidAt?: Date; sendEmail?: boolean } = {}
): Promise<PaidResult> {
  const order = await loadOrder(admin, by);
  if (!order) return { ok: false, transitioned: false, reason: "order_not_found" };

  // A cancelled or refunded order is closed. Capturing against one is a real
  // problem that needs a human, so refuse loudly rather than quietly emailing
  // the customer a shipping confirmation for something they won't receive.
  if (order.status === "cancelled" || order.status === "refunded") {
    console.error(
      `[orders] payment landed on ${order.status} order ${order.order_number} — needs manual review`
    );
    return { ok: false, transitioned: false, order, reason: `order_${order.status}` };
  }

  const alreadyPaid = order.status === "paid" || order.status === "fulfilled";
  const paidAt = opts.paidAt ?? (order.paid_at ? new Date(order.paid_at) : new Date());
  const eta = estimatedDeliveryAt(paidAt);

  // Conditional update: only a row still in a pre-paid state flips. A second
  // webhook matches nothing and can't reset paid_at (which would restart the
  // whole delivery schedule).
  if (!alreadyPaid) {
    const { error } = await admin
      .from("orders")
      .update({
        status: "paid",
        paid_at: paidAt.toISOString(),
        fulfillment_stage: "confirmed",
        stage_updated_at: new Date().toISOString(),
        estimated_delivery_at: eta.toISOString(),
      })
      .eq("id", order.id)
      .in("status", ["pending"]);

    if (error) {
      // Deploy-order safety net. If the code ships before migration 0006 runs,
      // the tracking columns don't exist and the update above fails — which
      // would mean paid orders silently never getting marked paid. Taking the
      // money and losing the order is far worse than losing the tracking, so
      // fall back to flipping the status alone and shout about the migration.
      console.error(
        `[orders] tracking update failed (${error.message}) — retrying status only. ` +
          "Run supabase/migrations/0006_fulfillment_tracking.sql."
      );
      const { error: fallbackError } = await admin
        .from("orders")
        .update({ status: "paid" })
        .eq("id", order.id)
        .in("status", ["pending"]);
      if (fallbackError) {
        console.error("[orders] markOrderPaid failed:", fallbackError.message);
        return { ok: false, transitioned: false, order, reason: fallbackError.message };
      }
    }
  }

  // Claim the stage — this is what decides whether the email is ours to send.
  const claimed = await claimStage(admin, order.id, "confirmed", {
    email: opts.sendEmail !== false,
    detail: stageMessage("confirmed", eta),
  });

  const fresh = (await loadOrder(admin, { id: order.id })) ?? order;

  if (claimed && opts.sendEmail !== false) {
    await sendFulfillmentEmail(fresh, "confirmed").catch((e) =>
      console.error("[orders] confirmed email failed:", e)
    );
  }

  return { ok: true, transitioned: claimed, order: fresh };
}

export type AdvanceResult = {
  orderNumber: string;
  from: FulfillmentStage;
  to: FulfillmentStage;
  emailed: boolean;
};

/**
 * Move one order to whatever stage its age now warrants, and email the customer
 * about it.
 *
 * Catch-up behaviour matters here: if the scheduler was down for a week, an
 * order jumps straight to its correct current stage. Intermediate stages are
 * still written to the timeline (so the customer's history is complete) but
 * only the stage they actually landed on triggers an email — nobody receives
 * four emails in one minute.
 */
export async function advanceOrder(
  admin: Admin,
  order: Order,
  now: Date = new Date()
): Promise<AdvanceResult | null> {
  const current = (order.fulfillment_stage ?? "awaiting_payment") as FulfillmentStage;
  if (!order.paid_at) return null;
  if (!isSchedulable(current, order.status)) return null;

  const target = dueStage(order.paid_at, now);
  const hops = stagesBetween(current, target);
  if (hops.length === 0) return null;

  const eta = order.estimated_delivery_at ?? estimatedDeliveryAt(order.paid_at).toISOString();

  // Backfill the stages that were skipped, silently.
  for (const stage of hops.slice(0, -1)) {
    await claimStage(admin, order.id, stage, {
      email: false,
      detail: stageMessage(stage, eta),
    });
  }

  const landed = hops[hops.length - 1];
  const claimed = await claimStage(admin, order.id, landed, {
    email: true,
    detail: stageMessage(landed, eta),
  });

  await admin
    .from("orders")
    .update({
      fulfillment_stage: landed,
      stage_updated_at: now.toISOString(),
      estimated_delivery_at: eta,
    })
    .eq("id", order.id);

  if (claimed) {
    const fresh = (await loadOrder(admin, { id: order.id })) ?? order;
    await sendFulfillmentEmail(fresh, landed).catch((e) =>
      console.error(`[orders] ${landed} email failed:`, e)
    );
  }

  return {
    orderNumber: order.order_number,
    from: current,
    to: landed,
    emailed: claimed,
  };
}

/**
 * Admin-driven stage change. Same email + timeline guarantees as the automated
 * path, so a manually advanced order is indistinguishable from a scheduled one
 * to the customer.
 */
export async function setOrderStage(
  admin: Admin,
  orderId: string,
  stage: FulfillmentStage,
  opts: { sendEmail?: boolean } = {}
): Promise<{ ok: boolean; emailed: boolean; error?: string }> {
  const order = await loadOrder(admin, { id: orderId });
  if (!order) return { ok: false, emailed: false, error: "Order not found." };

  const { error } = await admin
    .from("orders")
    .update({
      fulfillment_stage: stage,
      stage_updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return { ok: false, emailed: false, error: error.message };

  if (opts.sendEmail === false) return { ok: true, emailed: false };

  const claimed = await claimStage(admin, orderId, stage, {
    email: true,
    detail: stageMessage(stage, order.estimated_delivery_at),
  });
  if (claimed) {
    const fresh = (await loadOrder(admin, { id: orderId })) ?? order;
    await sendFulfillmentEmail(fresh, stage).catch((e) =>
      console.error(`[orders] admin ${stage} email failed:`, e)
    );
  }
  return { ok: true, emailed: claimed };
}

/** Timeline for the customer-facing tracker, oldest first. */
export async function loadOrderEvents(
  admin: Admin,
  orderId: string
): Promise<OrderEvent[]> {
  const { data } = await admin
    .from("order_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  return (data as OrderEvent[]) ?? [];
}
