import express from "express";
import cors from "cors";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  welcomeEmail,
  orderConfirmationEmail,
  newsletterEmail,
  contactEmails,
  sendOwnerAlert,
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
    const supabase = adminSupabase();
    if (orderId && supabase) {
      const { data: order } = await supabase
        .from("orders")
        .update({ status: "paid" })
        .eq("id", orderId)
        .select("*, items:order_items(*)")
        .single();
      if (order) await orderConfirmationEmail(order).catch((e) => console.error(e));
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

app.get("/health", (_req, res) => res.json({ ok: true, service: "edrift-backend" }));

app.post("/email/welcome", requireInternalKey, async (req, res) => {
  try { await welcomeEmail(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/email/order-confirmation", requireInternalKey, async (req, res) => {
  try { await orderConfirmationEmail(req.body.order || req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/email/newsletter", requireInternalKey, async (req, res) => {
  try { await newsletterEmail(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/contact", requireInternalKey, async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!email || !message) return res.status(400).json({ error: "email and message required" });
  // Persist (best-effort) + email
  const supabase = adminSupabase();
  if (supabase) {
    await supabase.from("contact_messages").insert({ name, email, subject, message }).catch(() => {});
  }
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
    // Atomic pending→paid: only the transition that actually flips the row
    // gets a non-null result and sends the receipt (dedupes vs the sync capture).
    const { data: updated } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id)
      .eq("status", "pending")
      .select(ORDER_SELECT)
      .maybeSingle();
    if (updated) await orderConfirmationEmail(updated).catch((e) => console.error(e));
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

app.listen(PORT, () => console.log(`edrift-backend listening on :${PORT}`));
