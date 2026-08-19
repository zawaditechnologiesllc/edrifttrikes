import { NextResponse } from "next/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { isInternalRequest } from "@/lib/internal-auth";
import { advanceOrder } from "@/lib/orders";
import { SCHEDULED_STAGES } from "@/lib/fulfillment";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * THE SCHEDULER — advances paid orders through the delivery journey and emails
 * the customer at each step.
 *
 *   day 0   confirmed            (sent by markOrderPaid, not here)
 *   day 3   shipped
 *   day 25  arriving  ("shipping complete", quotes the arrival date)
 *   day 28  ready_for_collection (final)
 *
 * The timings live in lib/fulfillment.ts. This route is only the engine.
 *
 * WHO CALLS IT: the Render service runs node-cron hourly and pings this
 * endpoint (server/src/index.js), with a GitHub Actions schedule as a backup in
 * case Render is asleep or redeploying. Both authenticate with INTERNAL_API_KEY.
 * Running it more often than the schedule is harmless — see idempotency below.
 *
 * IDEMPOTENT BY CONSTRUCTION: each stage transition inserts a row into
 * order_events, which is UNIQUE on (order_id, stage). Two overlapping cron runs
 * race on that insert and exactly one wins, so a customer can never be emailed
 * the same stage twice.
 *
 * BATCHED: Workers have a per-request CPU budget, so each invocation handles at
 * most BATCH_LIMIT orders and reports `remaining`. Callers loop until it is 0.
 */

// Comfortably inside the Workers free-plan CPU budget, allowing for a Resend
// round-trip per advanced order.
const BATCH_LIMIT = 25;

async function runScheduler(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!adminConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const started = Date.now();
  const now = new Date();
  const admin = createAdminClient();

  // Only paid orders that are still moving. `ready_for_collection` is the last
  // scheduled stage, so orders there are excluded — as are delivered and
  // cancelled ones, which the automation must never touch.
  //
  // `awaiting_payment` is included on purpose: an order paid while migration
  // 0006 was still pending gets status=paid but never leaves the default stage,
  // and would otherwise be stranded outside the scheduler forever.
  const movingStages: string[] = [
    "awaiting_payment",
    ...SCHEDULED_STAGES.filter((s) => s !== "ready_for_collection"),
  ];

  const { data, error } = await admin
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("status", "paid")
    .not("paid_at", "is", null)
    .in("fulfillment_stage", movingStages)
    // Oldest first: the orders furthest behind are the ones a customer is most
    // likely to be waiting on an update for.
    .order("paid_at", { ascending: true })
    .limit(BATCH_LIMIT + 1);

  if (error) {
    // The most likely cause on a fresh deploy is migration 0006 not having been
    // run yet, so say that rather than a bare Postgres error.
    console.error("[cron/orders] query failed:", error.message);
    return NextResponse.json(
      {
        error:
          "Could not read orders. If this is a new deploy, run supabase/migrations/0006_fulfillment_tracking.sql.",
        detail: error.message,
      },
      { status: 500 }
    );
  }

  const orders = (data ?? []) as Order[];
  const hasMore = orders.length > BATCH_LIMIT;
  const batch = orders.slice(0, BATCH_LIMIT);

  const advanced: { order: string; from: string; to: string; emailed: boolean }[] = [];
  for (const order of batch) {
    try {
      const result = await advanceOrder(admin, order, now);
      if (result) {
        advanced.push({
          order: result.orderNumber,
          from: result.from,
          to: result.to,
          emailed: result.emailed,
        });
      }
    } catch (e) {
      // One bad order must never stop the batch — the rest of the queue still
      // needs to move.
      console.error(`[cron/orders] ${order.order_number} failed:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: batch.length,
    advanced: advanced.length,
    // `remaining` is a hint, not a count: the caller loops while it is true.
    remaining: hasMore,
    ms: Date.now() - started,
    changes: advanced,
  });
}

/** Primary entry point — used by the Render scheduler. */
export async function POST(request: Request) {
  return runScheduler(request);
}

/**
 * GET does the same thing, for cron services that can only issue GETs
 * (cron-job.org, UptimeRobot). Still requires the internal key.
 */
export async function GET(request: Request) {
  return runScheduler(request);
}
