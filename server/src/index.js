import express from "express";
import cors from "cors";
import cron from "node-cron";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  welcomeEmail,
  abandonedCartEmail,
  fulfillmentEmail,
  refundEmail,
  supportReplyEmail,
  accountInviteEmail,
  newsletterEmail,
  contactEmails,
  sendOwnerAlert,
  sendTestEmail,
  emailConfig,
} from "./email.js";
import { verifyPayPalWebhook } from "./paypal.js";

const app = express();
const PORT = process.env.PORT || 8080;

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

function adminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Tell the Cloudflare app that an order has been paid.
 *
 * The app owns the whole post-payment journey (paid_at, fulfillment stage,
 * timeline events, emails) — this service only proves the payment really came
 * from Stripe, which has to happen here because signature verification needs
 * the raw request body.
 */
async function markOrderPaidInApp(payload) {
  const base = process.env.SITE_URL;
  if (!base) throw new Error("SITE_URL not set — cannot reach the app");
  const res = await fetch(`${base.replace(/\/$/, "")}/api/internal/order-paid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": process.env.INTERNAL_API_KEY || "",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`order-paid responded ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

app.use(cors({ origin: process.env.SITE_URL || true }));

// ---- Stripe webhook (raw body, must precede express.json) ----
app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(503).json({ error: "Stripe not configured" });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], secret);
  } catch (err) {
    return res.status(400).json({ error: `Signature failed: ${err.message}` });
  }
  if (event.type === "checkout.session.completed") {
    const orderId = event.data.object?.metadata?.order_id;
    if (orderId) {
      // Hand the transition to the app rather than doing it here. The app owns
      // the delivery schedule, the stage timeline and the email templates, and
      // its /api/internal/order-paid is idempotent — so a Stripe retry (or a
      // replayed event) cannot double-charge the customer's inbox.
      await markOrderPaidInApp({ orderId, paidVia: "stripe" }).catch((e) =>
        console.error("[stripe webhook] order-paid failed:", e.message)
      );
    }
  }
  res.json({ received: true });
});

app.use(express.json({ limit: "1mb" }));

// ---- internal auth for app -> backend calls ----
function requireInternalKey(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY;
  if (expected && req.header("x-internal-key") !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "edrift-backend", email: emailConfig() })
);

// Diagnostic: send a test email and report Resend's exact result/error. Internal
// key required (the app proxies it from an admin-gated route). Returns 200 with
// ok:false + error on failure so the reason is easy to read.
app.post("/email/test", requireInternalKey, async (req, res) => {
  const to = (req.body && req.body.to) || process.env.ORDERS_NOTIFICATION_EMAIL;
  if (!to) return res.status(400).json({ ok: false, error: "No recipient (pass `to` or set ORDERS_NOTIFICATION_EMAIL)" });
  try {
    const out = await sendTestEmail(to);
    res.json({ ok: !out.skipped, to, ...out, ...emailConfig() });
  } catch (e) {
    res.json({ ok: false, to, error: e.message, ...emailConfig() });
  }
});

app.post("/email/welcome", requireInternalKey, async (req, res) => {
  try { await welcomeEmail(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/email/abandoned-cart", requireInternalKey, async (req, res) => {
  try { await abandonedCartEmail(req.body || {}); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/email/fulfillment", requireInternalKey, async (req, res) => {
  try { await fulfillmentEmail(req.body || {}); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/email/refund", requireInternalKey, async (req, res) => {
  try { await refundEmail(req.body || {}); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/email/support-reply", requireInternalKey, async (req, res) => {
  try { await supportReplyEmail(req.body || {}); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/email/account-invite", requireInternalKey, async (req, res) => {
  try { await accountInviteEmail(req.body || {}); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/email/newsletter", requireInternalKey, async (req, res) => {
  try { await newsletterEmail(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/contact", requireInternalKey, async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!email || !message) return res.status(400).json({ error: "email and message required" });
  // Email only — the APP now writes the contact_messages row before it calls
  // here (lib/actions/contact.ts), so persisting again would double every
  // message in the admin inbox.
  try { await contactEmails({ name, email, subject, message }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- PayPal webhook (safety net for the synchronous capture) ----
// The app captures PayPal orders synchronously on return (/api/paypal/capture),
// so this webhook is the reconciliation layer, not the primary path:
//  - CAPTURE.COMPLETED  → mark paid + email, but ONLY if still pending, so it
//    never double-sends alongside the synchronous capture (atomic status guard).
//  - CAPTURE.DENIED     → cancel the order (only while still pending).
//  - CAPTURE.REFUNDED / REVERSED → mark refunded + alert the owner.
//  - CUSTOMER.DISPUTE.CREATED → alert the owner (no reliable order mapping).
// Every event is verified against PayPal's signature API first.
//
// NOTE: these UPPER.DOTTED strings are PayPal's canonical `event_type` values as
// sent in the webhook payload — NOT the friendlier descriptions the PayPal
// dashboard shows when you tick event checkboxes ("A payment capture completes",
// etc.). We match the payload names, so subscribing via the dashboard's "All
// events" option is safe: any event we don't handle just falls through to a 200.
const ORDER_SELECT = "*, items:order_items(*)";

// Resolve OUR order from a PayPal resource by the identifiers we set at create
// time (custom_id = order id, invoice_id = order number) or the PayPal order id
// we stored (stripe_session_id), whichever the event carries.
async function findOrder(supabase, resource) {
  const candidates = [
    ["id", resource?.custom_id],
    ["order_number", resource?.invoice_id],
    ["stripe_session_id", resource?.supplementary_data?.related_ids?.order_id],
  ];
  for (const [col, val] of candidates) {
    if (!val) continue;
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq(col, val)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function handlePayPalEvent(supabase, type, resource) {
  if (type === "PAYMENT.CAPTURE.COMPLETED") {
    const order = await findOrder(supabase, resource);
    if (!order) return console.warn("[paypal webhook] completed: no order match");
    // Same path as Stripe and the synchronous capture: the app performs the
    // transition and owns the emails. Its idempotency guard is what dedupes
    // this webhook against the capture that already ran in the app.
    await markOrderPaidInApp({ orderId: order.id, paidVia: "paypal" }).catch((e) =>
      console.error("[paypal webhook] order-paid failed:", e.message)
    );
    return;
  }

  if (type === "PAYMENT.CAPTURE.DENIED") {
    const order = await findOrder(supabase, resource);
    if (!order) return;
    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("status", "pending");
    return;
  }

  if (type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.CAPTURE.REVERSED") {
    const order = await findOrder(supabase, resource);
    const amt = resource?.amount
      ? `${resource.amount.value} ${resource.amount.currency_code}`
      : "";
    if (order && order.status !== "refunded") {
      await supabase.from("orders").update({ status: "refunded" }).eq("id", order.id);
    }
    await sendOwnerAlert("PayPal refund processed", [
      order ? `Order ${order.order_number} was refunded.` : "A PayPal payment was refunded.",
      amt && `Amount: ${amt}`,
      `PayPal refund id: ${resource?.id || "unknown"}`,
    ]).catch((e) => console.error(e));
    return;
  }

  if (type === "CUSTOMER.DISPUTE.CREATED") {
    const amt = resource?.dispute_amount
      ? `${resource.dispute_amount.value} ${resource.dispute_amount.currency_code}`
      : "";
    await sendOwnerAlert("PayPal dispute opened", [
      "A buyer opened a PayPal dispute — review it in your PayPal Resolution Center.",
      `Dispute id: ${resource?.dispute_id || "unknown"}`,
      resource?.reason && `Reason: ${resource.reason}`,
      amt && `Amount: ${amt}`,
    ]).catch((e) => console.error(e));
    return;
  }
  // Other event types: acknowledged, no action.
}

app.post("/paypal/webhook", async (req, res) => {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return res.status(503).json({ error: "PayPal webhook not configured" });

  let verified = false;
  try {
    verified = await verifyPayPalWebhook(req.headers, req.body, webhookId);
  } catch (e) {
    console.error("[paypal webhook] verify error", e);
  }
  if (!verified) return res.status(400).json({ error: "Invalid signature" });

  const event = req.body || {};
  const supabase = adminSupabase();
  if (supabase) {
    try {
      await handlePayPalEvent(supabase, event.event_type, event.resource || {});
    } catch (e) {
      // Ack anyway (we return 200 below) so PayPal doesn't hammer retries on a
      // transient DB hiccup; the event is logged for manual reconciliation.
      console.error("[paypal webhook]", event.event_type, e);
    }
  }
  res.json({ received: true });
});

// ---------------------------------------------------------------------------
// Order fulfillment scheduler
//
// This service is the always-on process in the stack, so it owns the CLOCK.
// The work itself lives in the app (POST /api/cron/orders) where the delivery
// schedule, the stage timeline and the email templates already are — keeping
// one implementation instead of a second, drifting copy here.
//
// Runs hourly. The app's endpoint is idempotent (unique (order_id, stage) in
// the database), so extra runs, overlapping runs and retries are all harmless.
// A GitHub Actions schedule pings the same endpoint as a backup for when this
// service is asleep or redeploying.
// ---------------------------------------------------------------------------

const CRON_SCHEDULE = process.env.FULFILLMENT_CRON || "0 * * * *"; // hourly
// The app processes a bounded batch per call and reports `remaining`; loop
// until the queue is drained, with a hard cap so a bug can't spin forever.
const MAX_CRON_PAGES = 40;

async function runFulfillmentSweep(trigger = "cron") {
  const base = process.env.SITE_URL;
  if (!base) return console.warn("[fulfillment] SITE_URL not set — sweep skipped");
  if (!process.env.INTERNAL_API_KEY) {
    return console.warn("[fulfillment] INTERNAL_API_KEY not set — sweep skipped");
  }

  let advanced = 0;
  let scanned = 0;
  for (let page = 0; page < MAX_CRON_PAGES; page++) {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/cron/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": process.env.INTERNAL_API_KEY,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`cron/orders responded ${res.status} ${body.slice(0, 200)}`);
    }
    const data = await res.json().catch(() => ({}));
    advanced += data.advanced || 0;
    scanned += data.scanned || 0;
    if (!data.remaining) break;
  }

  if (advanced > 0 || trigger !== "cron") {
    console.log(
      `[fulfillment] ${trigger}: scanned ${scanned}, advanced ${advanced} order(s)`
    );
  }
  return { scanned, advanced };
}

cron.schedule(CRON_SCHEDULE, () => {
  runFulfillmentSweep("cron").catch((e) =>
    console.error("[fulfillment] sweep failed:", e.message)
  );
});

// Manual trigger — for testing the journey without waiting for the hour, and
// as the target for any external cron service you'd rather use.
app.post("/orders/advance", requireInternalKey, async (_req, res) => {
  try {
    const out = await runFulfillmentSweep("manual");
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () =>
  console.log(
    `edrift-backend listening on :${PORT} — fulfillment cron "${CRON_SCHEDULE}"`
  )
);
