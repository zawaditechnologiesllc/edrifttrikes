import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "E-Drift Trikes <onboarding@resend.dev>";
const SITE = process.env.SITE_URL || "";
const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Escape user-controlled text before it goes into an HTML email. Buyer/visitor
 * input (names, emails, subjects, messages, shipping fields) must never be able
 * to inject markup or links into the emails we send to the store owner or back
 * to the rider. Numeric/template values built here are already safe.
 */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(cents, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format((cents || 0) / 100);
}

function shell(title, body) {
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

async function send(to, subject, html) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${subject}" -> ${to}`);
    return { skipped: true };
  }
  const result = await resend.emails.send({ from: FROM, to, subject, html });
  // The Resend SDK returns { data, error } and does NOT throw on rejection.
  // Without this, an unverified EMAIL_FROM domain (or the resend.dev test
  // domain, which only delivers to your own address) failed silently and the
  // customer never got the receipt. Surface it so callers/logs see the reason.
  if (result?.error) {
    const msg = result.error.message || result.error.name || "send failed";
    console.error(`[email] Resend rejected "${subject}" -> ${to}: ${msg}`);
    throw new Error(`Resend: ${msg}`);
  }
  return result;
}

export async function welcomeEmail({ email, name }) {
  const hi = name ? `, ${esc(name)}` : "";
  return send(
    email,
    "Welcome to the Garage",
    shell(
      "Welcome to the garage",
      `<p style="color:#c3c5d9;line-height:1.6">Your rider profile is live${hi}. You're now part of the electric drift era.</p>
       <a href="${SITE}/account" style="display:inline-block;margin-top:20px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Open Dashboard</a>`
    )
  );
}

function orderTable(order) {
  const rows = (order.items || [])
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;color:#e4e1e6">${esc(i.name)} × ${esc(i.qty)}</td>
         <td style="padding:8px 0;text-align:right;color:#e4e1e6">${money(i.price_cents * i.qty, order.currency)}</td></tr>`
    )
    .join("");
  const shippingCell =
    order.shipping_cents === 0 ? "FREE" : money(order.shipping_cents, order.currency);
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:24px">${rows}
      <tr><td style="padding:12px 0;border-top:1px solid rgba(255,255,255,0.1);color:#8d90a2">Subtotal</td><td style="padding:12px 0;border-top:1px solid rgba(255,255,255,0.1);text-align:right;color:#e4e1e6">${money(order.subtotal_cents, order.currency)}</td></tr>
      <tr><td style="padding:4px 0;color:#8d90a2">Shipping</td><td style="padding:4px 0;text-align:right;color:#e4e1e6">${shippingCell}</td></tr>
      <tr><td style="padding:4px 0;color:#8d90a2">Tax</td><td style="padding:4px 0;text-align:right;color:#e4e1e6">${money(order.tax_cents, order.currency)}</td></tr>
      <tr><td style="padding:12px 0;font-weight:700;color:#fff">Total</td><td style="padding:12px 0;text-align:right;font-weight:700;color:#c4f731">${money(order.total_cents, order.currency)}</td></tr>
    </table>`;
}

export async function orderConfirmationEmail(order) {
  const body = `
    <p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${esc(order.order_number)}</strong> is confirmed.</p>
    <p style="color:#c3c5d9;line-height:1.6">Delivery typically takes <strong style="color:#fff">12–20 days</strong> depending on the shipping route to your country. We'll email your tracking link the moment it ships.</p>
    ${orderTable(order)}`;
  const result = await send(
    order.email,
    `Order ${order.order_number} confirmed`,
    shell("Order confirmed", body)
  );

  // New-order alert to the store owner — best-effort, never blocks the
  // buyer's receipt.
  const notify = process.env.ORDERS_NOTIFICATION_EMAIL;
  if (notify) {
    const addr = order.shipping_address
      ? `<p style="color:#c3c5d9;line-height:1.6">Ship to: ${Object.values(order.shipping_address)
          .filter(Boolean)
          .map((v) => esc(v))
          .join(", ")}</p>`
      : "";
    await send(
      notify,
      `New order ${order.order_number} — ${money(order.total_cents, order.currency)}`,
      shell(
        "New order",
        `<p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${esc(order.order_number)}</strong> from ${esc(order.email)} (status: ${esc(order.status)}).</p>
         ${addr}${orderTable(order)}`
      )
    ).catch((e) => console.error("[email] order alert failed", e));
  }
  return result;
}

/**
 * Staged delivery-journey email (shipped / arriving / ready for collection).
 *
 * Fallback path only: when the app has its own RESEND_API_KEY it renders and
 * sends these itself (lib/email.ts). The app passes the already-composed title
 * and body so the wording stays identical across both paths — this file must
 * never re-write the copy.
 */
export async function fulfillmentEmail({ order, stage, title, body }) {
  if (!order?.email) throw new Error("fulfillmentEmail: order.email required");
  const heading = title || "Order update";
  const tracking = order.tracking_number
    ? `<p style="color:#c3c5d9;line-height:1.6;margin-top:16px">Tracking number: <strong style="color:#c4f731">${esc(
        order.tracking_number
      )}</strong>${order.courier ? ` (${esc(order.courier)})` : ""}</p>`
    : "";
  const callout =
    stage === "ready_for_collection"
      ? `<div style="margin-top:24px;border:1px solid #c4f731;border-radius:8px;padding:16px 20px;background:rgba(196,247,49,0.08)">
           <p style="margin:0;color:#c4f731;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:12px">Next step</p>
           <p style="margin:8px 0 0;color:#e4e1e6;line-height:1.6">Please wait for the courier to email or call you to arrange collection or confirm door delivery.</p>
         </div>`
      : "";
  return send(
    order.email,
    `${heading} · ${order.order_number}`,
    shell(
      heading,
      `<p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${esc(
        order.order_number
      )}</strong></p>
       <p style="color:#c3c5d9;line-height:1.6">${esc(body || "")}</p>
       ${tracking}${callout}
       <a href="${SITE}/account" style="display:inline-block;margin-top:24px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Track your order</a>`
    )
  );
}

/**
 * Admin reply to a support message. Fallback path only — when the app has its
 * own RESEND_API_KEY it renders and sends this itself (lib/email.ts).
 */
export async function supportReplyEmail({ to, name, subject, reply, original }) {
  if (!to) throw new Error("supportReplyEmail: `to` required");
  const greeting = name ? `Hi ${esc(name)},` : "Hi,";
  const replyHtml = esc(reply || "").replace(/\n/g, "<br />");
  const originalHtml = esc(original || "").replace(/\n/g, "<br />");
  return send(
    to,
    subject || "Re: your message to E-Drift Trikes",
    shell(
      "Reply from the garage",
      `<p style="color:#c3c5d9;line-height:1.6">${greeting}</p>
       <p style="color:#c3c5d9;line-height:1.6">${replyHtml}</p>
       <div style="margin-top:32px;border-left:2px solid rgba(255,255,255,0.15);padding-left:16px">
         <p style="margin:0 0 8px;color:#8d90a2;font-size:12px;letter-spacing:1px;text-transform:uppercase">Your original message</p>
         <p style="margin:0;color:#8d90a2;line-height:1.6;font-size:14px">${originalHtml}</p>
       </div>
       <a href="${SITE}/support" style="display:inline-block;margin-top:28px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Write to us again</a>`
    )
  );
}

/**
 * Account invite for a guest buyer. Fallback path only — the app renders and
 * sends this itself when it has RESEND_API_KEY.
 */
export async function accountInviteEmail({ to, orderNumber, actionLink, subject }) {
  if (!to || !actionLink) throw new Error("accountInviteEmail: to and actionLink required");
  return send(
    to,
    subject || `Track order ${orderNumber} — set up your E-Drift account`,
    shell(
      "Track your order",
      `<p style="color:#c3c5d9;line-height:1.6">You placed order <strong style="color:#c4f731">${esc(
        orderNumber
      )}</strong> with us as a guest.</p>
       <p style="color:#c3c5d9;line-height:1.6">Set up an account with this email address and that order — plus every delivery update — appears on your rider dashboard automatically.</p>
       <a href="${esc(actionLink)}" style="display:inline-block;margin-top:24px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Create your account</a>
       <p style="color:#8d90a2;line-height:1.6;font-size:12px;margin-top:24px">This link signs you in and is for you alone — please don't forward it. If you didn't order from us, you can ignore this email.</p>`
    )
  );
}

export async function newsletterEmail({ email }) {
  return send(
    email,
    "You're on the drop list",
    shell("You're on the list", `<p style="color:#c3c5d9;line-height:1.6">You'll be first to know about new drops, restocks and garage events.</p>`)
  );
}

/** Non-secret email config snapshot for the diagnostics endpoint. */
export function emailConfig() {
  return {
    resend: Boolean(resend),
    from: FROM,
    ordersNotify: Boolean(process.env.ORDERS_NOTIFICATION_EMAIL),
  };
}

/**
 * Send a test email and return the outcome (throws on Resend rejection via
 * send(), which the caller turns into a readable error). Used by /email/test to
 * verify receipts can actually reach a customer address.
 */
export async function sendTestEmail(to) {
  const result = await send(
    to,
    "E-Drift test email",
    shell(
      "Test email",
      `<p style="color:#c3c5d9;line-height:1.6">If you received this, your store's email is working — order receipts will reach your customers.</p>`
    )
  );
  return { id: result?.data?.id || result?.id || null, skipped: Boolean(result?.skipped) };
}

/**
 * Generic alert to the store owner (refunds, disputes, etc.). Each line is
 * escaped, so identifiers coming from a webhook payload can't inject markup.
 */
export async function sendOwnerAlert(subject, lines = []) {
  const to = process.env.ORDERS_NOTIFICATION_EMAIL;
  if (!to) return { skipped: true };
  const body = lines
    .filter(Boolean)
    .map((l) => `<p style="color:#c3c5d9;line-height:1.6">${esc(l)}</p>`)
    .join("");
  return send(to, subject, shell(subject, body));
}

export async function contactEmails({ name, email, subject, message }) {
  const to = process.env.ORDERS_NOTIFICATION_EMAIL || FROM;
  const safeName = esc(name) || "A rider";
  // Notify the store
  await send(
    to,
    `Support: ${subject || "New message"}`,
    shell(
      "New support message",
      `<p style="color:#c3c5d9"><strong>${safeName}</strong> (${esc(email)})</p>
       <p style="color:#c3c5d9">Subject: ${esc(subject) || "—"}</p>
       <p style="color:#c3c5d9;line-height:1.6">${esc(message)}</p>`
    )
  );
  // Acknowledge the rider
  return send(
    email,
    "We got your message",
    shell("Message received", `<p style="color:#c3c5d9;line-height:1.6">Thanks ${safeName} — the garage crew will get back to you within one business day.</p>`)
  );
}
