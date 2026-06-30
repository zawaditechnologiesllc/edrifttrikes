import express from "express";
import cors from "cors";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  welcomeEmail,
  orderConfirmationEmail,
  newsletterEmail,
  contactEmails,
} from "./email.js";

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

app.listen(PORT, () => console.log(`edrift-backend listening on :${PORT}`));
