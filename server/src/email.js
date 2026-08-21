import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "E-Drift Trikes <onboarding@resend.dev>";
const SITE = process.env.SITE_URL || "";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@edrifttrikes.shop";

/**
 * Sender for mail nobody should reply to. Resend verifies a DOMAIN, so
 * no-reply@ on the same domain as EMAIL_FROM can send too — but on the shared
 * resend.dev sandbox only onboarding@ may, so there the normal sender stands.
 * Mirrors noReplyFrom() in lib/email.ts — keep the two in step.
 */
const NO_REPLY_FROM = (() => {
  if (process.env.EMAIL_FROM_NOREPLY) return process.env.EMAIL_FROM_NOREPLY;
  const match = /^\s*(?:(.*?)\s*<\s*([^>]+)\s*>|(\S+@\S+))\s*$/.exec(FROM);
  const address = (match?.[2] || match?.[3] || "").trim();
  const label = (match?.[1] || "E-Drift Trikes").replace(/["<>]/g, "").trim();
  const domain = address.split("@")[1] || "";
  if (!domain || domain.toLowerCase().endsWith("resend.dev")) return FROM;
  return `${label} <no-reply@${domain}>`;
})();
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

async function send(to, subject, html, opts = {}) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${subject}" -> ${to}`);
    return { skipped: true };
  }
  const result = await resend.emails.send({
    from: opts.from || FROM,
    to,
    subject,
    html,
    ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
  });
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

/**
 * The cart-recovery email an UNPAID order gets.
 *
 * Fallback path only — the app sends this itself when it has its own Resend
 * key (lib/email.ts). It replaced the old order-confirmation email here for
 * the same reason it did there: an order is created before any money moves, so
 * confirming it at that point confirms something that may never be paid for.
 * The confirmation now goes out from the fulfilment email when the order is
 * actually marked paid.
 */
export async function abandonedCartEmail({ order, subject, title, paragraphs, href, cta }) {
  // The app composes the wording for the day 3/7/12 reminders and passes it in,
  // so the escalation lives in one place (lib/abandoned.ts) rather than being
  // written twice. Without it, this is the first email.
  const lead =
    Array.isArray(paragraphs) && paragraphs.length
      ? paragraphs.map((p) => `<p style="color:#c3c5d9;line-height:1.6">${esc(p)}</p>`).join("")
      : `<p style="color:#c3c5d9;line-height:1.6">We've saved order <strong style="color:#c4f731">${esc(order.order_number)}</strong> for you, but we haven't received payment for it yet — so nothing has been charged and nothing has shipped.</p>
         <p style="color:#c3c5d9;line-height:1.6">If you were interrupted at the payment step, everything below is still reserved. Pick up where you left off and we'll get straight to work on your build.</p>`;
  // The link carries the order id so the cart page can restore exactly what
  // they picked, colours included.
  const link = href || `${process.env.SITE_URL || ""}/cart?recover=${encodeURIComponent(order.id || "")}`;
  const body = `
    ${lead}
    <a href="${link}" style="display:inline-block;margin:8px 0;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">${esc(cta || "Complete your order")}</a>
    ${orderTable(order)}
    <p style="margin-top:28px;color:#8d90a2;font-size:12px;line-height:1.7">Changed your mind? No action is needed — an unpaid order simply expires and you will not be charged.</p>`;
  const result = await send(
    order.email,
    subject || `Your order ${order.order_number} is waiting`,
    shell(title || "Finish your order", body)
  );

  // New-order alert to the store owner. It fires on an UNPAID order because
  // that is precisely what the admin needs to see — they mark it paid.
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
      `New order ${order.order_number} — ${money(order.total_cents, order.currency)} (unpaid)`,
      shell(
        "New order — awaiting payment",
        `<p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${esc(order.order_number)}</strong> from ${esc(order.email)} (status: ${esc(order.status)}).</p>
         <p style="color:#c3c5d9;line-height:1.6">Mark it paid in the admin panel once payment is confirmed — that is what starts the delivery schedule and sends the customer their confirmation.</p>
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
export async function fulfillmentEmail({ order, stage, title, body, inviteLink }) {
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
  // Guest buyers get the account link instead of a dashboard link they can't
  // use yet. Mirrors lib/email.ts — keep the two in step.
  const cta = inviteLink
    ? `<div style="margin-top:28px;border:1px solid #1e5bff;border-radius:8px;padding:20px;background:rgba(30,91,255,0.08)">
         <p style="margin:0;color:#fff;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:12px">Track this order</p>
         <p style="margin:8px 0 0;color:#c3c5d9;line-height:1.6">You checked out as a guest. Set up an account with this email address and this order — plus every update from here to delivery — appears on your dashboard.</p>
         <a href="${esc(inviteLink)}" style="display:inline-block;margin-top:16px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Create your account</a>
       </div>`
    : `<a href="${SITE}/account" style="display:inline-block;margin-top:24px;background:#1e5bff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">Track your order</a>`;

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
       ${cta}`
    )
  );
}

/**
 * Refund notice. Fallback path only — when the app has its own RESEND_API_KEY it
 * renders and sends this itself (lib/email.ts).
 *
 * The wording arrives from the app (refundCopy in lib/email.ts) rather than
 * being written again here: a customer must not read different sentences about
 * their money depending on which mail path a deployment happens to use.
 */
export async function refundEmail({ order, subject, title, paragraphs }) {
  if (!order?.email) throw new Error("refundEmail: order.email required");
  const heading = title || "Refund initiated";
  const body = `
    <p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${esc(
      order.order_number
    )}</strong></p>
    <div style="margin-top:24px;border:1px solid #c4f731;border-radius:8px;padding:20px;background:rgba(196,247,49,0.08)">
      <p style="margin:0;color:#8d90a2;font-size:12px;letter-spacing:1px;text-transform:uppercase">Refund amount</p>
      <p style="margin:6px 0 0;color:#c4f731;font-size:26px;font-weight:700">${money(
        order.total_cents,
        order.currency
      )}</p>
    </div>
    ${(paragraphs || [])
      .map((p) => `<p style="color:#c3c5d9;line-height:1.6">${esc(p)}</p>`)
      .join("")}
    <p style="margin-top:28px;color:#8d90a2;font-size:12px;line-height:1.7">
      This message was sent from an unmonitored address. If you have a question
      about this refund, email
      <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:#c4f731">${esc(
        SUPPORT_EMAIL
      )}</a> and quote order ${esc(order.order_number)}.
    </p>`;

  return send(order.email, subject || `Refund initiated · Order ${order.order_number}`, shell(heading, body), {
    from: NO_REPLY_FROM,
    replyTo: SUPPORT_EMAIL,
  });
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
