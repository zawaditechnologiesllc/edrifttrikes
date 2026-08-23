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
import { sendAbandonedReminderEmail, sendFulfillmentEmail } from "@/lib/email";
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
import { colorsFromDescription, productColors } from "@/lib/colors";
import {
  ABANDONED_SCHEDULE,
  ABANDONED_WINDOW_DAYS,
  reminderStage,
  shouldRemind,
  stepsUpTo,
} from "@/lib/abandoned";

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

// ---------------------------------------------------------------------------
// Chasing orders that were never paid for
// ---------------------------------------------------------------------------

/**
 * Has the person behind this email bought anything?
 *
 * The condition the whole follow-up sequence turns on. It looks at EVERY order
 * for the address, not just this one, because a buyer who abandoned one order
 * and then placed a fresh one has bought — and chasing them about the first is
 * the kind of thing that makes a shop look like it is not paying attention.
 *
 * Matched on the email rather than the account, because most abandoned orders
 * are from guests who have no account at all.
 */
async function hasBoughtSince(admin: Admin, email: string): Promise<boolean> {
  const address = String(email ?? "").trim().toLowerCase();
  if (!address) return false;
  const { data, error } = await admin
    .from("orders")
    .select("id")
    .eq("email", address)
    .in("status", ["paid", "fulfilled"])
    .limit(1);
  if (error) {
    // Fail SAFE: if we cannot tell whether they bought, do not chase them. A
    // missed reminder costs a maybe; a reminder to a paying customer costs
    // their confidence in the shop.
    console.error("[orders] could not check purchase history:", error.message);
    return true;
  }
  return (data ?? []).length > 0;
}

export type SweepResult = {
  scanned: number;
  emailed: number;
  skipped: Record<string, number>;
};

/**
 * Send the follow-up that is due on each unpaid order — day 3, 7 and 12.
 *
 * IDEMPOTENT the same way the delivery scheduler is: each reminder inserts a
 * row into order_events keyed `abandoned_<step>`, and the unique
 * (order_id, stage) constraint means two overlapping cron runs race on the
 * insert and exactly one wins. No locking, no "last sent" column to drift.
 *
 * A LATE SWEEP CLAIMS THE STEPS IT SKIPPED. If the cron was down for a week,
 * dueReminder returns the furthest due step and the earlier ones are claimed
 * silently — so the buyer gets one correct email, and a later run cannot come
 * back and send them the day-3 note after the day-12 one.
 *
 * Only looks back ABANDONED_WINDOW_DAYS, which is what makes switching this on
 * safe: every pending order older than the window is left alone rather than
 * mailed out of the blue.
 */
export async function sweepAbandonedOrders(
  admin: Admin,
  opts: { now?: Date; limit?: number } = {}
): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 25;
  const since = new Date(now.getTime() - ABANDONED_WINDOW_DAYS * 86_400_000);

  const skipped: Record<string, number> = {};
  const note = (reason: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };

  const { data, error } = await admin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("status", "pending")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[orders] abandoned sweep query failed:", error.message);
    return { scanned: 0, emailed: 0, skipped: { query_failed: 1 } };
  }

  const orders = (data as Order[]) ?? [];
  let emailed = 0;

  for (const order of orders) {
    const due = shouldRemind(
      { status: order.status, created_at: order.created_at },
      now
    );
    if (!due.send) {
      note(due.reason);
      continue;
    }

    // Only ask the database about purchase history for orders that are
    // otherwise ready to be chased — it is a query per order.
    if (await hasBoughtSince(admin, order.email)) {
      note("already_bought");
      continue;
    }

    // Claim every step up to the due one. The earlier claims are what stop a
    // recovered scheduler from working backwards through the sequence.
    let sendThis = false;
    for (const step of stepsUpTo(due.step)) {
      const won = await claimReminder(admin, order.id, step);
      if (step === due.step) sendThis = won;
    }
    if (!sendThis) {
      note("already_sent");
      continue;
    }

    try {
      await sendAbandonedReminderEmail(order, due.step);
      emailed++;
    } catch (e) {
      // The claim already stands, so this order will not be retried. That is
      // the deliberate trade: a missed reminder beats a duplicate one.
      console.error(
        `[orders] reminder ${due.step} for ${order.order_number} failed:`,
        String((e as Error)?.message || e)
      );
      note("send_failed");
    }
  }

  return { scanned: orders.length, emailed, skipped };
}

/** claimStage's sibling for reminder steps, which are not fulfilment stages. */
async function claimReminder(
  admin: Admin,
  orderId: string,
  step: number
): Promise<boolean> {
  const { error } = await admin.from("order_events").insert({
    order_id: orderId,
    stage: reminderStage(step),
    // Rendered verbatim in the admin timeline, which does not look these up in
    // STAGE_COPY — so it has to read as a sentence on its own.
    title: `Unpaid-order reminder sent (day ${
      ABANDONED_SCHEDULE.find((s) => s.step === step)?.afterDays ?? "?"
    })`,
    detail: null,
    email_sent: true,
  });
  if (error) {
    if (error.code === "23505") return false; // already claimed
    console.error(`[orders] could not record reminder ${step}:`, error.message);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Colours on products uploaded before colours had a column
// ---------------------------------------------------------------------------

export type ColorSyncResult = {
  /** Products looked at that had no colours of their own. */
  scanned: number;
  /** Products written to. */
  updated: number;
  /** Products that already had colours and were left alone. */
  alreadyHad: number;
  /**
   * Names of products with no colours anywhere — not on the row, not in the
   * description. This is the useful half of the report: it tells the owner
   * exactly which product sheets still need a `Colors:` line.
   */
  missing: string[];
};

/** Rows fetched per query. Bounded so one page can't blow the Worker's memory. */
const COLOR_SYNC_PAGE = 200;

/**
 * Write colours onto products that only have them in their description text.
 *
 * productColorOptions() already falls back to the description at read time, so
 * the picker appears immediately either way. This makes the fallback permanent:
 * the colours become real data on the row, which means the admin sees and can
 * edit them in the product form, the PDF sheet lists them, and nothing
 * downstream has to re-derive them on every render.
 *
 * PAGES THROUGH THE WHOLE CATALOGUE. It used to read one page of 200 and stop,
 * which quietly meant a 201st product could never be filled in no matter how
 * many times the cron ran.
 *
 * IDEMPOTENT AND NON-DESTRUCTIVE. Only products whose `colors` is empty are
 * considered, so a product that has been filled in is never looked at again and
 * an admin's hand-edited list is never overwritten. Clearing a colour list by
 * hand only gets it back if the description still names one — which is what the
 * read-time fallback would show anyway.
 *
 * `limit` caps WRITES, not reads: the cron passes a small number to stay well
 * inside its time budget, while the admin button passes Infinity to do the lot
 * in one go.
 */
export async function syncProductColors(
  admin: Admin,
  opts: { limit?: number; pageSize?: number } = {}
): Promise<ColorSyncResult> {
  const limit = opts.limit ?? 25;
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? COLOR_SYNC_PAGE, 1000));

  let scanned = 0;
  let updated = 0;
  let alreadyHad = 0;
  const missing: string[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("products")
      .select("id, name, colors, description")
      // By id, not created_at: paging needs a total order, and two products
      // created in the same millisecond would otherwise shuffle between pages
      // and let one slip through unread.
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      // Most likely migration 0012 has not run, in which case there is no
      // column to write to and the read-time fallback is doing the work.
      console.error("[orders] colour sync query failed:", error.message);
      break;
    }

    const rows = (data ?? []) as {
      id: string;
      name: string | null;
      colors: unknown;
      description: string | null;
    }[];

    for (const row of rows) {
      if (productColors(row.colors).length > 0) {
        alreadyHad++;
        continue;
      }
      scanned++;

      const derived = colorsFromDescription(row.description);
      if (derived.length === 0) {
        // Worth naming: the owner can only fix what they can see.
        if (missing.length < 50) missing.push(row.name?.trim() || row.id);
        continue;
      }

      // The write cap stops the loop, but only AFTER everything has been
      // counted — a truncated report would misreport the catalogue.
      if (updated >= limit) continue;

      const { error: writeError } = await admin
        .from("products")
        .update({ colors: derived })
        .eq("id", row.id);
      if (writeError) {
        console.error(`[orders] colour sync failed for ${row.id}:`, writeError.message);
        continue;
      }
      updated++;
    }

    // A short page is the last page.
    if (rows.length < pageSize) break;
  }

  return { scanned, updated, alreadyHad, missing };
}
