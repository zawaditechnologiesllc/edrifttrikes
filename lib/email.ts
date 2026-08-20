import type { Order } from "@/lib/types";
import { serverEnv, publicSiteUrl } from "@/lib/env";
import {
  STAGE_COPY,
  formatDeliveryDate,
  stageMessage,
  type FulfillmentStage,
} from "@/lib/fulfillment";
import { computeDuty, DEFAULT_DUTY_RATE_BPS } from "@/lib/totals";
import { COMPANY } from "@/lib/company";

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

/**
 * The buyer's shipping address, as lines, in the order a courier reads them.
 *
 * Reads only the known checkout fields — an order's shipping_address is JSON,
 * and dumping arbitrary keys into an email would leak whatever a future field
 * happens to be called.
 */
function addressLines(order: Order): string[] {
  const a = (order.shipping_address ?? {}) as Record<string, string>;
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ");
  const locality = [a.city, a.state, a.zip].filter(Boolean).join(", ");
  return [name, a.address, a.address2, locality, a.country, a.phone]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

function addressBlock(order: Order): string {
  const lines = addressLines(order);
  if (lines.length === 0) return "";
  return `
    <div style="margin-top:24px;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px">
      <p style="margin:0 0 8px;color:#8d90a2;font-size:12px;letter-spacing:1px;text-transform:uppercase">Delivering to</p>
      <p style="margin:0;color:#e4e1e6;line-height:1.7">${lines
        .map((l) => esc(l))
        .join("<br />")}</p>
    </div>`;
}

/** "12 March 2026" — long form, because a receipt is read months later. */
function longDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * A COMPLETE RECEIPT: order number, dates, every item, the money, the delivery
 * address, and who to contact.
 *
 * This is the document a customer keeps. It has to answer, months later and
 * without them logging in: what did I buy, what did I pay, where is it going,
 * and who do I chase. Anything missing here becomes a support email.
 */
function receiptBlock(order: Order): string {
  const placed = longDate(order.created_at);
  const paid = longDate(order.paid_at);
  const eta = longDate(order.estimated_delivery_at);

  const meta = [
    ["Order number", esc(order.order_number)],
    placed ? ["Placed", esc(placed)] : null,
    paid ? ["Payment received", esc(paid)] : null,
    eta ? ["Estimated delivery", esc(eta)] : null,
    order.tracking_number
      ? [
          "Tracking",
          `${esc(order.tracking_number)}${order.courier ? ` (${esc(order.courier)})` : ""}`,
        ]
      : null,
  ].filter(Boolean) as [string, string][];

  const metaRows = meta
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 0;color:#8d90a2">${label}</td>
         <td style="padding:4px 0;text-align:right;color:#e4e1e6">${value}</td></tr>`
    )
    .join("");

  return `
    <div style="margin-top:24px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:20px">
      <p style="margin:0 0 12px;color:#c4f731;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700">Your receipt</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${metaRows}</table>
      ${orderTable(order)}
      ${addressBlock(order)}
      <p style="margin:20px 0 0;color:#8d90a2;font-size:12px;line-height:1.6">
        Questions about this order? Reply to this email or write to
        <a href="mailto:${esc(COMPANY.supportEmail)}" style="color:#c4f731">${esc(
          COMPANY.supportEmail
        )}</a> quoting ${esc(order.order_number)}.
      </p>
    </div>`;
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
  // Free shipping is worth saying out loud — it is a benefit the buyer chose
  // this store for, and a bare "0" reads like a missing value.
  const freeShipping = order.shipping_cents === 0;
  const shippingCell = freeShipping
    ? `<span style="color:#c4f731;font-weight:700">FREE</span>`
    : money(order.shipping_cents, currency);
  const freeShippingNote = freeShipping
    ? `<p style="margin:12px 0 0;color:#c4f731;font-size:12px;line-height:1.6">Free shipping applied to this order — you paid nothing for delivery.</p>`
    : "";
  // Import duty is disclosed, never charged — so it sits BELOW the total, in
  // muted type, with the wording that makes clear who collects it.
  const duty = computeDuty(order.subtotal_cents);
  const dutyPct = DEFAULT_DUTY_RATE_BPS / 100;
  const dutyBlock =
    duty > 0
      ? `<div style="margin-top:16px;border-top:1px dashed rgba(255,255,255,0.15);padding-top:12px">
           <table style="width:100%;border-collapse:collapse">
             <tr>
               <td style="color:#8d90a2">Import duty (${dutyPct}%) — not charged by us</td>
               <td style="text-align:right;color:#8d90a2">${money(duty, currency)}</td>
             </tr>
           </table>
           <p style="margin:8px 0 0;color:#8d90a2;font-size:12px;line-height:1.6">
             Estimated customs duty on the value of your goods, payable by you to
             your local government when the shipment arrives. It is not included
             in the total above and we never collect it. Your country's customs
             authority sets the exact amount.
           </p>
         </div>`
      : "";

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:24px">${rows}
      <tr><td style="padding:12px 0;border-top:1px solid rgba(255,255,255,0.1);color:#8d90a2">Subtotal</td><td style="padding:12px 0;border-top:1px solid rgba(255,255,255,0.1);text-align:right;color:#e4e1e6">${money(order.subtotal_cents, currency)}</td></tr>
      <tr><td style="padding:4px 0;color:#8d90a2">Shipping</td><td style="padding:4px 0;text-align:right;color:#e4e1e6">${shippingCell}</td></tr>
      <tr><td style="padding:4px 0;color:#8d90a2">Tax</td><td style="padding:4px 0;text-align:right;color:#e4e1e6">${money(order.tax_cents, currency)}</td></tr>
      <tr><td style="padding:12px 0;font-weight:700;color:#fff">Total</td><td style="padding:12px 0;text-align:right;font-weight:700;color:#c4f731">${money(order.total_cents, currency)}</td></tr>
    </table>
    ${freeShippingNote}
    ${dutyBlock}`;
}

/**
 * What this customer actually bought, as an itemised block.
 *
 * Every stage email carries it. A status update that only says "your order has
 * shipped" is the same message every store sends about every parcel; naming the
 * items makes it unmistakably about THEIR purchase, and saves them opening a
 * receipt to remember what is coming.
 */
function purchasedItemsBlock(order: Order): string {
  const items = order.items ?? [];
  if (items.length === 0) return "";
  const currency = order.currency || "usd";
  const rows = items
    .map(
      (i) =>
        `<tr>
           <td style="padding:6px 0;color:#e4e1e6">${esc(i.name)} × ${esc(i.qty)}</td>
           <td style="padding:6px 0;text-align:right;color:#8d90a2">${money(
             i.price_cents * i.qty,
             currency
           )}</td>
         </tr>`
    )
    .join("");
  return `
    <div style="margin-top:24px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:16px 20px">
      <p style="margin:0 0 8px;color:#8d90a2;font-size:12px;letter-spacing:1px;text-transform:uppercase">In this shipment</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      ${
        order.shipping_cents === 0
          ? `<p style="margin:10px 0 0;color:#c4f731;font-size:12px">Shipped free of charge.</p>`
          : ""
      }
    </div>`;
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
    const hint = resendFailureHint(msg);
    if (hint) console.error(`[email] ${hint}`);
    throw new Error(`Resend: ${msg}`);
  }
  return data;
}

/**
 * Turn a Resend rejection into the action that actually fixes it.
 *
 * The dominant failure in production is sending from an unverified domain (or
 * the shared `onboarding@resend.dev` fallback): mail to your OWN address is
 * accepted, mail to a customer is rejected. That asymmetry is confusing — the
 * store owner sees their copy arrive and assumes email works — so name it
 * explicitly in the logs.
 */
export function resendFailureHint(message: string): string | null {
  const m = (message || "").toLowerCase();
  if (
    m.includes("only send testing emails") ||
    m.includes("not verified") ||
    m.includes("verify a domain") ||
    m.includes("domain is not verified")
  ) {
    return (
      "Resend will only deliver to your own account address until a sending " +
      "domain is verified. Verify your domain at resend.com/domains and set " +
      "EMAIL_FROM to an address on it — mail to customers is being rejected."
    );
  }
  return null;
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
      ${receiptBlock(order)}
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
  stage: FulfillmentStage,
  opts: {
    /**
     * Supabase invite link, when the buyer checked out as a guest and has no
     * account. Included in the payment-confirmed email so the one message that
     * matters most also gets them set up to track it.
     */
    inviteLink?: string;
  } = {}
) {
  const copy = STAGE_COPY[stage];
  const body = stageMessage(stage, order.estimated_delivery_at);
  const site = publicSiteUrl() || "";

  if (!directEmail()) {
    return call("/email/fulfillment", {
      order,
      stage,
      title: copy.title,
      body,
      inviteLink: opts.inviteLink,
      receipt: stage === "confirmed",
    });
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

  // The payment-confirmed email is the one a customer keeps, so it carries the
  // complete receipt. Later stages get the itemised list instead of the full
  // receipt — enough that the message is unmistakably about THEIR order rather
  // than a generic status ping, without repeating the whole document.
  const detail =
    stage === "confirmed" ? receiptBlock(order) : purchasedItemsBlock(order);

  // Delivery date, but only where the stage copy doesn't already carry it —
  // most messages interpolate {date} themselves, and printing it twice in a row
  // reads like a template bug.
  const messageHasDate = STAGE_COPY[stage].message.includes("{date}");
  const stillInFlight = stage !== "delivered" && stage !== "cancelled";
  const eta =
    !messageHasDate && stillInFlight && order.estimated_delivery_at
      ? `<p style="margin:16px 0 0;color:#c3c5d9;line-height:1.6">Estimated delivery: <strong style="color:#fff">${esc(
          formatDeliveryDate(order.estimated_delivery_at)
        )}</strong></p>`
      : "";

  // A guest buyer has no dashboard to send them to yet. Rather than link them
  // somewhere that will look empty, offer the account that makes tracking work
  // — the link confirms their address, which is what attaches this order to it.
  const cta = opts.inviteLink
    ? `<div style="margin-top:28px;border:1px solid #1e5bff;border-radius:8px;padding:20px;background:rgba(30,91,255,0.08)">
         <p style="margin:0;color:#fff;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:12px">Track this order</p>
         <p style="margin:8px 0 0;color:#c3c5d9;line-height:1.6">You checked out as a guest. Set up an account with this email address and this order — plus every update from here to delivery — appears on your dashboard.</p>
         <a href="${esc(
           opts.inviteLink
         )}" style="display:inline-block;margin-top:16px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Create your account</a>
         <p style="margin:12px 0 0;color:#8d90a2;font-size:11px;line-height:1.6">This link signs you in and is for you alone — please don't forward it. You'll keep getting these updates by email either way.</p>
       </div>`
    : `<a href="${site}/account" style="display:inline-block;margin-top:24px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Track your order</a>`;

  return resendSend(
    order.email,
    `${copy.title} · ${order.order_number}`,
    shell(
      copy.title,
      `<p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${esc(
        order.order_number
      )}</strong></p>
       <p style="color:#c3c5d9;line-height:1.6">${esc(body)}</p>
       ${eta}
       ${tracking}${callout}${detail}
       ${cta}`
    )
  );
}

/**
 * An admin's reply to a customer's support message, sent from /admin/messages.
 *
 * Quotes the original underneath the reply so the customer has the context —
 * this may land days after they wrote in, and a bare answer to a forgotten
 * question is worse than no answer.
 */
export async function sendSupportReply(msg: {
  to: string;
  name?: string | null;
  subject?: string | null;
  reply: string;
  original: string;
}) {
  const site = publicSiteUrl() || "";
  const greeting = msg.name ? `Hi ${esc(msg.name)},` : "Hi,";
  const subject = msg.subject
    ? `Re: ${msg.subject}`
    : "Re: your message to E-Drift Trikes";

  // Preserve the admin's line breaks; escape first so the reply text can never
  // inject markup into the email.
  const replyHtml = esc(msg.reply).replace(/\n/g, "<br />");
  const originalHtml = esc(msg.original).replace(/\n/g, "<br />");

  if (!directEmail()) {
    return call("/email/support-reply", { ...msg, subject });
  }

  return resendSend(
    msg.to,
    subject,
    shell(
      "Reply from the garage",
      `<p style="color:#c3c5d9;line-height:1.6">${greeting}</p>
       <p style="color:#c3c5d9;line-height:1.6">${replyHtml}</p>
       <div style="margin-top:32px;border-left:2px solid rgba(255,255,255,0.15);padding-left:16px">
         <p style="margin:0 0 8px;color:#8d90a2;font-size:12px;letter-spacing:1px;text-transform:uppercase">Your original message</p>
         <p style="margin:0;color:#8d90a2;line-height:1.6;font-size:14px">${originalHtml}</p>
       </div>
       <a href="${site}/support" style="display:inline-block;margin-top:28px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Write to us again</a>`
    )
  );
}

/**
 * Invite a guest buyer to create an account so they can track the order they
 * already placed.
 *
 * Sent from the admin order page. The link is a Supabase invite/magic link
 * generated server-side; following it signs them in and confirms the address,
 * which is what lets the order attach to the new account (see
 * claimGuestOrders / migration 0010).
 */
export async function sendAccountInviteEmail(msg: {
  to: string;
  orderNumber: string;
  actionLink: string;
}) {
  const site = publicSiteUrl() || "";
  const subject = `Track order ${msg.orderNumber} — set up your E-Drift account`;

  if (!directEmail()) {
    return call("/email/account-invite", { ...msg, subject });
  }

  return resendSend(
    msg.to,
    subject,
    shell(
      "Track your order",
      `<p style="color:#c3c5d9;line-height:1.6">You placed order <strong style="color:#c4f731">${esc(
        msg.orderNumber
      )}</strong> with us as a guest.</p>
       <p style="color:#c3c5d9;line-height:1.6">Set up an account with this email address and that order — plus every delivery update, from shipped through to ready for collection — appears on your rider dashboard automatically.</p>
       <a href="${esc(
         msg.actionLink
       )}" style="display:inline-block;margin-top:24px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Create your account</a>
       <p style="color:#8d90a2;line-height:1.6;font-size:12px;margin-top:24px">This link signs you in and is for you alone — please don't forward it. If you didn't order from us, you can ignore this email. Your order is unaffected either way, and we'll keep emailing its progress to this address.</p>
       <p style="color:#8d90a2;line-height:1.6;font-size:12px">Or browse the store at <a href="${site}" style="color:#c4f731">${esc(
         site.replace(/^https?:\/\//, "")
       )}</a>.</p>`
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

export type ContactSendResult = {
  /** The store was told about the message — this is the one that matters. */
  ownerNotified: boolean;
  /** The customer got their "we got it" acknowledgement. Nice to have. */
  customerAcknowledged: boolean;
  /** First failure reason, for logging. Never shown to the customer. */
  error?: string;
};

/**
 * Deliver a contact-form message: notify the store, acknowledge to the sender.
 *
 * NEVER THROWS. This is called from a server action, and an uncaught throw
 * there is a 500 in the customer's browser. It previously returned the
 * acknowledgement send un-caught, so any Resend rejection on the CUSTOMER's
 * address — the normal state of affairs until a sending domain is verified —
 * turned a perfectly good support message into a 500.
 *
 * The two sends are reported separately because they are not equally
 * important: losing the acknowledgement is cosmetic, losing the notification
 * means nobody knows the customer wrote in.
 */
export async function sendContactMessage(msg: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<ContactSendResult> {
  if (!directEmail()) {
    const res = (await call("/contact", msg)) as { error?: boolean; skipped?: boolean };
    const ok = Boolean(res) && !res.error && !res.skipped;
    return { ownerNotified: ok, customerAcknowledged: ok };
  }

  const to = ordersNotify() || emailFrom();
  const safeName = esc(msg.name) || "A rider";

  let ownerNotified = false;
  let customerAcknowledged = false;
  let error: string | undefined;

  try {
    await resendSend(
      to,
      `Support: ${msg.subject || "New message"}`,
      shell(
        "New support message",
        `<p style="color:#c3c5d9"><strong>${safeName}</strong> (${esc(msg.email)})</p>
         <p style="color:#c3c5d9">Subject: ${esc(msg.subject) || "—"}</p>
         <p style="color:#c3c5d9;line-height:1.6">${esc(msg.message)}</p>`
      )
    );
    ownerNotified = true;
  } catch (e) {
    error = String((e as Error)?.message || e);
    console.error("[email] contact notify failed:", error);
  }

  try {
    await resendSend(
      msg.email,
      "We got your message",
      shell(
        "Message received",
        `<p style="color:#c3c5d9;line-height:1.6">Thanks ${safeName} — the garage crew will get back to you within one business day.</p>`
      )
    );
    customerAcknowledged = true;
  } catch (e) {
    const reason = String((e as Error)?.message || e);
    error = error ?? reason;
    console.error("[email] contact acknowledgement failed:", reason);
  }

  return { ownerNotified, customerAcknowledged, error };
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
