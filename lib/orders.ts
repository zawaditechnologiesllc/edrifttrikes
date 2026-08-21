/**
 * Order lifecycle transitions — the ONE implementation of "this order is now
 * paid" and "this order has reached a new stage".
 *
 * Every payment path funnels through here so the behaviour can't drift:
 *   Stripe webhook (Render) → POST /api/internal/order-paid → markOrderPaid()
 *   PayPal webhook (Render) → POST /api/internal/order-paid → markOrderPaid()
 *   PayPal capture (app)    → markOrderPaid()
 *   Admin sets status=paid  → markOrderPaid()
 *   Scheduler (cron)        → advanceOrder()
 *
 * Each records HOW it was paid (`paid_via`), which the admin Paid Orders view
 * reads back.
 *
 * IDEMPOTENCY is enforced in the database, not in application logic: the
 * `order_events` table has UNIQUE (order_id, stage), so a duplicate webhook, a
 * PayPal retry and a double-clicked admin button all collide on the insert and
 * only the first one sends an email.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderEvent } from "@/lib/types";
import { sendFulfillmentEmail } from "@/lib/email";
import { publicSiteUrl } from "@/lib/env";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { verifiedUserEmail } from "@/lib/account";
import {
  STAGE_COPY,
  addDays,
  dueStage,
  estimatedDeliveryAt,
  isSchedulable,
  stageMessage,
  stageOffsetDays,
  stagesBetween,
  type FulfillmentStage,
} from "@/lib/fulfillment";
import { deliveryDaysFor } from "@/lib/delivery";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Admin = SupabaseClient<any, any, any>;

const ORDER_SELECT = "*, items:order_items(*)";

/**
 * How many days after payment THIS order is due, from where it is going.
 *
 * The date stored on the order has to be the one the buyer was quoted at
 * checkout — a confirmation email promising a different day than the checkout
 * page did is the store contradicting itself in writing. An order with no
 * usable country falls back to the base window.
 */
function orderDeliveryDays(order: Pick<Order, "shipping_address">): number {
  const address = (order.shipping_address ?? {}) as Record<string, unknown>;
  const country = typeof address.country === "string" ? address.country : null;
  return deliveryDaysFor(country);
}

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

/**
 * How an order came to be paid. Recorded on the order so the admin Paid Orders
 * view can distinguish a gateway-confirmed payment from one an admin flipped by
 * hand — which matters when reconciling takings.
 */
export type PaidVia = "stripe" | "paypal" | "manual";

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
  opts: {
    paidAt?: Date;
    sendEmail?: boolean;
    paidVia?: PaidVia;
    /**
     * Send the confirmation even if the `confirmed` stage was already recorded.
     * For the ADMIN path only: a human clicking "mark paid" with notifications
     * on is a deliberate instruction, and the claim-once rule — which exists to
     * stop webhook retries double-emailing — must not swallow it.
     */
    force?: boolean;
  } = {}
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
  const eta = estimatedDeliveryAt(paidAt, orderDeliveryDays(order));

  // Conditional update: only a row still in a pre-paid state flips. A second
  // webhook matches nothing and can't reset paid_at (which would restart the
  // whole delivery schedule).
  if (!alreadyPaid) {
    const { error } = await admin
      .from("orders")
      .update({
        status: "paid",
        paid_at: paidAt.toISOString(),
        paid_via: opts.paidVia ?? "manual",
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

  if ((claimed || opts.force) && opts.sendEmail !== false) {
    // A guest buyer has nowhere to track this yet. Resolve that BEFORE the
    // email goes out so the one message they're most likely to keep carries
    // the link that sets them up — rather than sending a second email later,
    // or pointing them at a dashboard that would look empty.
    const link = await ensureCustomerAccountLink(
      admin,
      fresh,
      publicSiteUrl() || ""
    );

    await sendFulfillmentEmail(fresh, "confirmed", {
      inviteLink: link.linked ? undefined : link.inviteLink,
    }).catch((e) => console.error("[orders] confirmed email failed:", e));
  }

  return { ok: true, transitioned: claimed || Boolean(opts.force), order: fresh };
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

  const eta =
    order.estimated_delivery_at ??
    estimatedDeliveryAt(order.paid_at, orderDeliveryDays(order)).toISOString();

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
): Promise<{ ok: boolean; emailed: boolean; error?: string; warning?: string }> {
  const order = await loadOrder(admin, { id: orderId });
  if (!order) return { ok: false, emailed: false, error: "Order not found." };

  const now = new Date();
  const update: Record<string, unknown> = {
    fulfillment_stage: stage,
    stage_updated_at: now.toISOString(),
  };

  // ANCHOR THE SCHEDULE so automation carries on from here.
  //
  // advanceOrder counts every later stage from paid_at. Moving an order forward
  // by hand without one left it frozen — the admin's change stuck, but nothing
  // ever advanced it again. Back-date the anchor to when this stage would have
  // fallen due, so the remaining stages land on the correct days rather than
  // all at once.
  const offset = stageOffsetDays(stage);
  if (offset !== null && !order.paid_at) {
    const anchor = addDays(now, -offset);
    update.paid_at = anchor.toISOString();
    update.estimated_delivery_at = estimatedDeliveryAt(
      anchor,
      orderDeliveryDays(order)
    ).toISOString();
  } else if (offset !== null && !order.estimated_delivery_at && order.paid_at) {
    update.estimated_delivery_at = estimatedDeliveryAt(
      order.paid_at,
      orderDeliveryDays(order)
    ).toISOString();
  }

  const { error } = await admin.from("orders").update(update).eq("id", orderId);
  if (error) return { ok: false, emailed: false, error: error.message };

  // Record the stage on the timeline. A stage the order has already passed
  // through is a no-op here — but that must NOT decide whether the email goes.
  await claimStage(admin, orderId, stage, {
    email: opts.sendEmail !== false,
    detail: stageMessage(stage, order.estimated_delivery_at),
  });

  if (opts.sendEmail === false) return { ok: true, emailed: false, ...stageWarning(order, stage) };

  // An admin ticking "email the customer" is a deliberate instruction, so it
  // sends whether or not the stage was already on the timeline. The
  // claim-once rule exists to stop webhook retries and overlapping cron runs
  // double-emailing — it was never meant to swallow a human's click, which is
  // exactly what it did: re-confirming an order sent nothing at all.
  const fresh = (await loadOrder(admin, { id: orderId })) ?? order;

  // Guest buyers get the account link in the same email, same as the automatic
  // path, so a manually confirmed order isn't a second-class one.
  const link = fresh.user_id
    ? { linked: true as const, inviteLink: undefined }
    : await ensureCustomerAccountLink(admin, fresh, publicSiteUrl() || "");

  let emailed = true;
  try {
    await sendFulfillmentEmail(fresh, stage, {
      inviteLink: link.linked ? undefined : link.inviteLink,
    });
  } catch (e) {
    emailed = false;
    console.error(`[orders] admin ${stage} email failed:`, e);
  }

  return { ok: true, emailed, ...stageWarning(fresh, stage) };
}

/**
 * Tell the admin when a manual stage change will NOT keep advancing on its own.
 *
 * The scheduler only touches orders whose status is `paid`. Silently leaving a
 * stage stranded is the failure this surfaces.
 */
function stageWarning(
  order: Pick<Order, "status">,
  stage: FulfillmentStage
): { warning?: string } {
  const offset = stageOffsetDays(stage);
  if (offset === null) return {};
  if (order.status === "paid") return {};
  return {
    warning:
      `The order is marked "${order.status}", so the scheduler will not advance it further. ` +
      `Set the payment status to "paid" for the remaining updates to send automatically.`,
  };
}

export type AccountLinkResult = {
  /** True when the order now belongs to an account. */
  linked: boolean;
  /** Supabase invite link, when there was no account to link to. */
  inviteLink?: string;
  reason?: string;
};

/**
 * Make sure an order belongs to a customer account — or produce the invite
 * that would create one.
 *
 * Called automatically when payment clears, and by the admin "connect order"
 * button, so both routes behave identically.
 *
 *  - Order already owned            → nothing to do.
 *  - An account exists for its email → claim the order for it.
 *  - No account                      → generate a Supabase invite link. The
 *    ORDER IS NOT TOUCHED: it stays a guest order until the customer actually
 *    accepts, so an unaccepted invite leaves no trace of a relationship that
 *    doesn't exist yet.
 *
 * Never throws. It runs inside the payment path, where taking the money and
 * then failing on an invite would be a far worse outcome than no invite.
 */
export async function ensureCustomerAccountLink(
  admin: Admin,
  order: Pick<Order, "id" | "email" | "user_id">,
  siteUrl: string
): Promise<AccountLinkResult> {
  try {
    if (order.user_id) return { linked: true, reason: "already_linked" };

    const email = String(order.email || "").trim().toLowerCase();
    if (!email) return { linked: false, reason: "no_email" };

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) {
      const claimed = await claimGuestOrders(admin, existing.id as string, email);
      return { linked: claimed > 0, reason: claimed > 0 ? "claimed" : "claim_failed" };
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${siteUrl}/auth/callback?next=/account` },
    });
    if (error) {
      // The commonest cause is an auth user existing without a profile row —
      // not worth failing a payment over.
      console.error("[orders] invite link failed:", error.message);
      return { linked: false, reason: error.message };
    }
    const inviteLink = data?.properties?.action_link;
    if (!inviteLink) return { linked: false, reason: "no_link_returned" };
    return { linked: false, inviteLink };
  } catch (e) {
    console.error("[orders] account link failed:", String((e as Error)?.message || e));
    return { linked: false, reason: String((e as Error)?.message || e) };
  }
}

/**
 * Attach a buyer's guest orders to their account.
 *
 * Buyers check out without an account, so those orders carry user_id = NULL.
 * When the same person registers, this links every order placed with their
 * email so their history is permanently theirs — visible on the dashboard,
 * and owned by them at the RLS level rather than only matched by email.
 *
 * ⚠️ The CALLER must have established that the email is confirmed. This
 * function trusts what it is given; passing an unverified address here would
 * hand one person another's orders — name, address, phone and all. See
 * verifiedUserEmail() in lib/db.ts, which is the only intended caller path.
 *
 * Idempotent: rows already claimed have a non-null user_id and are skipped, so
 * running it on every dashboard view costs one indexed read and nothing else.
 */
export async function claimGuestOrders(
  admin: Admin,
  userId: string,
  verifiedEmail: string
): Promise<number> {
  const email = verifiedEmail.trim().toLowerCase();
  if (!userId || !email) return 0;

  const { data, error } = await admin
    .from("orders")
    .update({ user_id: userId })
    .is("user_id", null)
    .eq("email", email)
    .select("id");

  if (error) {
    // Never let this break the dashboard — RLS already lets the user read
    // unclaimed orders placed with their confirmed email (migration 0010), so
    // a failure here costs the permanent link, not the visibility.
    console.error("[orders] could not claim guest orders:", error.message);
    return 0;
  }

  const claimed = data?.length ?? 0;
  if (claimed > 0) {
    console.log(`[orders] linked ${claimed} guest order(s) to account ${userId}`);
  }
  return claimed;
}

/**
 * Link the signed-in user's guest orders to their account, right now.
 *
 * Called at every point a session begins or is proven — sign-in, sign-up, and
 * the auth callback that handles email confirmation, magic links and accepted
 * invites — so a customer's history is theirs before they reach any page,
 * rather than whenever they next happen to open the dashboard.
 *
 * Migration 0011 does the same thing in a database trigger, which is the real
 * guarantee. This is the belt to that trigger's braces: it keeps the behaviour
 * correct on a database where the trigger could not be installed, and costs one
 * indexed read when there is nothing to claim.
 *
 * Never throws — it sits on the sign-in path, where failing would lock someone
 * out of their account over a bookkeeping detail.
 */
export async function syncOrdersForCurrentUser(): Promise<number> {
  try {
    if (!adminConfigured()) return 0;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const email = verifiedUserEmail(user);
    if (!email) return 0;

    return await claimGuestOrders(createAdminClient(), user.id, email);
  } catch (e) {
    console.error("[orders] order sync failed:", String((e as Error)?.message || e));
    return 0;
  }
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
