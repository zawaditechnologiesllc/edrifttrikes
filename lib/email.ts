import type { Order } from "@/lib/types";
import { serverEnv, publicSiteUrl } from "@/lib/env";
import {
  STAGE_COPY,
  stageMessage,
  type FulfillmentStage,
} from "@/lib/fulfillment";

/**
 * Email delivery. Primary path: send DIRECTLY via the Resend HTTP API from the
 * app itself (works on Cloudflare Workers — no separate backend needed) whenever
 * RESEND_API_KEY is configured on the app. Fallback: proxy to the Render
 * backend (/server) if that's how you're set up. If neither is configured,
 * calls are skipped (logged) so local dev / unconfigured previews still run.
 *
 * All values are read at CALL time — on Cloudflare these are runtime Worker
 * bindings not visible at module load.
 */

function resendApiKey(): string {
  return serverEnv("RESEND_API_KEY") || "";
}
function emailFrom(): string {
  return serverEnv("EMAIL_FROM") || "E-Drift Trikes <onboarding@resend.dev>";
}
function ordersNotify(): string {
  return serverEnv("ORDERS_NOTIFICATION_EMAIL") || "";
}
function backendBase(): string {
  return serverEnv("RENDER_API_URL") || serverEnv("NEXT_PUBLIC_API_BASE_URL") || "";
}
function internalKey(): string {
  return serverEnv("INTERNAL_API_KEY") || "";
}

/** True when the app can send email itself (no separate backend required). */
export function directEmail(): boolean {
  return Boolean(resendApiKey());
}

// ---- HTML templates (kept identical to the branded backend emails) ----

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format((cents || 0) / 100);
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0e0e11;font-family:Inter,Arial,sans-serif;color:#e4e1e6">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <div style="font-family:Anton,Arial,sans-serif;font-size:28px;letter-spacing:1px;color:#c4f731">E-DRIFT</div>
      <div style="height:3px;width:48px;background:#c4f731;margin:12px 0 28px"></div>
      <h1 style="font-family:Anton,Arial,sans-serif;font-weight:400;font-size:26px;color:#fff;text-transform:uppercase;margin:0 0 16px">${esc(title)}</h1>
      ${body}
      <div style="margin-top:40px;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;color:#8d90a2;font-size:12px;letter-spacing:1px;text-transform:uppercase">
        E-Drift Motors · Engineered for adrenaline
      </div>
    </div></body></html>`;
}

function orderTable(order: Order): string {
  const currency = order.currency || "usd";
  const rows = (order.items || [])
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;color:#e4e1e6">${esc(i.name)} × ${esc(i.qty)}</td>
         <td style="padding:8px 0;text-align:right;color:#e4e1e6">${money(i.price_cents * i.qty, currency)}</td></tr>`
    )
    .join("");
  const shippingCell = order.shipping_cents === 0 ? "FREE" : money(order.shipping_cents, currency);
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:24px">${rows}
      <tr><td style="padding:12px 0;border-top:1px solid rgba(255,255,255,0.1);color:#8d90a2">Subtotal</td><td style="padding:12px 0;border-top:1px solid rgba(255,255,255,0.1);text-align:right;color:#e4e1e6">${money(order.subtotal_cents, currency)}</td></tr>
      <tr><td style="padding:4px 0;color:#8d90a2">Shipping</td><td style="padding:4px 0;text-align:right;color:#e4e1e6">${shippingCell}</td></tr>
      <tr><td style="padding:4px 0;color:#8d90a2">Tax</td><td style="padding:4px 0;text-align:right;color:#e4e1e6">${money(order.tax_cents, currency)}</td></tr>
      <tr><td style="padding:12px 0;font-weight:700;color:#fff">Total</td><td style="padding:12px 0;text-align:right;font-weight:700;color:#c4f731">${money(order.total_cents, currency)}</td></tr>
    </table>`;
}

// ---- Resend direct send (Workers-safe: plain HTTPS, no SDK) ----

async function resendSend(to: string, subject: string, html: string): Promise<{ id?: string }> {
  const key = resendApiKey();
  if (!key) return {};
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: emailFrom(), to, subject, html }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    const msg = data?.message || data?.name || `HTTP ${res.status}`;
    console.error(`[email] Resend rejected "${subject}" -> ${to}: ${msg}`);
    throw new Error(`Resend: ${msg}`);
  }
  return data;
}

// ---- Render backend fallback (legacy path) ----

const BACKEND_TIMEOUT_MS = 8000;

async function call(path: string, body: unknown) {
  const base = backendBase();
  if (!base) {
    console.warn(`[email] no RESEND_API_KEY and no RENDER_API_URL — skipped ${path}`);
    return { skipped: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": internalKey() },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) console.error(`[backend] ${path} -> ${res.status}`);
    return res.json().catch(() => ({}));
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      console.error(`[backend] ${path} timed out after ${BACKEND_TIMEOUT_MS}ms`);
    } else {
      console.error(`[backend] ${path} failed`, e);
    }
    return { error: true };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Public API (same signatures; direct-first, backend fallback) ----

export async function sendWelcomeEmail(email: string, name?: string) {
  if (directEmail()) {
    const hi = name ? `, ${esc(name)}` : "";
    const site = publicSiteUrl() || "";
    return resendSend(
      email,
      "Welcome to the Garage",
      shell(
        "Welcome to the garage",
        `<p style="color:#c3c5d9;line-height:1.6">Your rider profile is live${hi}. You're now part of the electric drift era.</p>
         <a href="${site}/account" style="display:inline-block;margin-top:20px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Open Dashboard</a>`
      )
    );
  }
  return call("/email/welcome", { email, name });
}

export async function sendOrderConfirmationEmail(order: Order) {
  if (directEmail()) {
    const site = publicSiteUrl() || "";
    const body = `
      <p style="color:#c3c5d9;line-height:1.6">Thanks for your order — <strong style="color:#c4f731">${esc(order.order_number)}</strong> is in.</p>
      <p style="color:#c3c5d9;line-height:1.6">We'll send a second email confirming your payment and the start of your shipment as soon as it clears. From there you can follow every step — shipped, arriving, ready for collection — on your rider dashboard.</p>
      ${orderTable(order)}
      <a href="${site}/account" style="display:inline-block;margin-top:24px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Track your order</a>`;
    const result = await resendSend(
      order.email,
      `Order ${order.order_number} received`,
      shell("Order confirmed", body)
    );

    // Best-effort new-order alert to the owner — never blocks the buyer receipt.
    const notify = ordersNotify();
    if (notify) {
      const addr = order.shipping_address
        ? `<p style="color:#c3c5d9;line-height:1.6">Ship to: ${Object.values(order.shipping_address)
            .filter(Boolean)
            .map((v) => esc(v))
            .join(", ")}</p>`
        : "";
      await resendSend(
        notify,
        `New order ${order.order_number} — ${money(order.total_cents, order.currency || "usd")}`,
        shell(
          "New order",
          `<p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${esc(order.order_number)}</strong> from ${esc(order.email)} (status: ${esc(order.status)}).</p>
           ${addr}${orderTable(order)}`
        )
      ).catch((e) => console.error("[email] order alert failed", e));
    }
    return result;
  }
  return call("/email/order-confirmation", { order });
}

/**
 * A staged delivery-journey email — sent when an order reaches a new
 * fulfillment stage, whether that came from the scheduler (day 3 / 25 / 28),
 * the payment webhook, or an admin moving the order by hand.
 *
 * The subject and body come from STAGE_COPY in lib/fulfillment.ts, so the
 * wording a customer reads in the email is byte-for-byte the wording they see
 * on their dashboard tracker.
 */
export async function sendFulfillmentEmail(
  order: Order,
  stage: FulfillmentStage
) {
  const copy = STAGE_COPY[stage];
  const body = stageMessage(stage, order.estimated_delivery_at);
  const site = publicSiteUrl() || "";

  if (!directEmail()) {
    return call("/email/fulfillment", { order, stage, title: copy.title, body });
  }

  const tracking = order.tracking_number
    ? `<p style="color:#c3c5d9;line-height:1.6;margin-top:16px">Tracking number: <strong style="color:#c4f731">${esc(
        order.tracking_number
      )}</strong>${order.courier ? ` (${esc(order.courier)})` : ""}</p>`
    : "";

  // The final stage is an action for the customer, so it gets a callout box
  // rather than another line of body copy they might skim past.
  const callout =
    stage === "ready_for_collection"
      ? `<div style="margin-top:24px;border:1px solid #c4f731;border-radius:8px;padding:16px 20px;background:rgba(196,247,49,0.08)">
           <p style="margin:0;color:#c4f731;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:12px">Next step</p>
           <p style="margin:8px 0 0;color:#e4e1e6;line-height:1.6">Please wait for the courier to email or call you to arrange collection or confirm door delivery.</p>
         </div>`
      : "";

  return resendSend(
    order.email,
    `${copy.title} · ${order.order_number}`,
    shell(
      copy.title,
      `<p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${esc(
        order.order_number
      )}</strong></p>
       <p style="color:#c3c5d9;line-height:1.6">${esc(body)}</p>
       ${tracking}${callout}
       <a href="${site}/account" style="display:inline-block;margin-top:24px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Track your order</a>`
    )
  );
}

export async function sendNewsletterConfirmation(email: string) {
  if (directEmail()) {
    return resendSend(
      email,
      "You're on the drop list",
      shell(
        "You're on the list",
        `<p style="color:#c3c5d9;line-height:1.6">You'll be first to know about new drops, restocks and garage events.</p>`
      )
    );
  }
  return call("/email/newsletter", { email });
}

export async function sendContactMessage(msg: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  if (directEmail()) {
    const to = ordersNotify() || emailFrom();
    const safeName = esc(msg.name) || "A rider";
    await resendSend(
      to,
      `Support: ${msg.subject || "New message"}`,
      shell(
        "New support message",
        `<p style="color:#c3c5d9"><strong>${safeName}</strong> (${esc(msg.email)})</p>
         <p style="color:#c3c5d9">Subject: ${esc(msg.subject) || "—"}</p>
         <p style="color:#c3c5d9;line-height:1.6">${esc(msg.message)}</p>`
      )
    ).catch((e) => console.error("[email] contact notify failed", e));
    return resendSend(
      msg.email,
      "We got your message",
      shell(
        "Message received",
        `<p style="color:#c3c5d9;line-height:1.6">Thanks ${safeName} — the garage crew will get back to you within one business day.</p>`
      )
    );
  }
  return call("/contact", msg);
}

// ---- Diagnostics (used by /api/health/email) ----

/** Non-secret snapshot of how email is (or isn't) wired. */
export function emailConfig() {
  const via = directEmail() ? "resend-direct" : backendBase() ? "render-backend" : "none";
  return {
    via,
    resendConfigured: directEmail(),
    from: emailFrom(),
    ordersNotify: Boolean(ordersNotify()),
    renderApiUrl: backendBase() || null,
  };
}

/** Send a real test email through the active path; throws with the reason on failure. */
export async function sendTestEmail(to: string) {
  const html = shell(
    "Test email",
    `<p style="color:#c3c5d9;line-height:1.6">If you received this, your store's email is working — order receipts will reach your customers.</p>`
  );
  if (directEmail()) {
    const data = await resendSend(to, "E-Drift test email", html);
    return { ok: true, to, id: data?.id ?? null, via: "resend-direct" as const };
  }
  if (backendBase()) {
    const data = (await call("/email/test", { to })) as Record<string, unknown>;
    return { ok: Boolean((data as { ok?: boolean }).ok), to, via: "render-backend" as const, ...data };
  }
  return {
    ok: false,
    to,
    via: "none" as const,
    error: "No email path configured. Set RESEND_API_KEY (+ EMAIL_FROM) on the app.",
  };
}
