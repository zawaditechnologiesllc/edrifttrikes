import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "E-Drift Trikes <onboarding@resend.dev>";
const SITE = process.env.SITE_URL || "";
const resend = apiKey ? new Resend(apiKey) : null;

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
      <h1 style="font-family:Anton,Arial,sans-serif;font-weight:400;font-size:26px;color:#fff;text-transform:uppercase;margin:0 0 16px">${title}</h1>
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
  return resend.emails.send({ from: FROM, to, subject, html });
}

export async function welcomeEmail({ email, name }) {
  const hi = name ? `, ${name}` : "";
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
        `<tr><td style="padding:8px 0;color:#e4e1e6">${i.name} × ${i.qty}</td>
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
    <p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${order.order_number}</strong> is confirmed.</p>
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
          .map((v) => String(v).replace(/</g, "&lt;"))
          .join(", ")}</p>`
      : "";
    await send(
      notify,
      `New order ${order.order_number} — ${money(order.total_cents, order.currency)}`,
      shell(
        "New order",
        `<p style="color:#c3c5d9;line-height:1.6">Order <strong style="color:#c4f731">${order.order_number}</strong> from ${order.email} (status: ${order.status}).</p>
         ${addr}${orderTable(order)}`
      )
    ).catch((e) => console.error("[email] order alert failed", e));
  }
  return result;
}

export async function newsletterEmail({ email }) {
  return send(
    email,
    "You're on the drop list",
    shell("You're on the list", `<p style="color:#c3c5d9;line-height:1.6">You'll be first to know about new drops, restocks and garage events.</p>`)
  );
}

export async function contactEmails({ name, email, subject, message }) {
  const to = process.env.ORDERS_NOTIFICATION_EMAIL || FROM;
  // Notify the store
  await send(
    to,
    `Support: ${subject || "New message"}`,
    shell("New support message", `<p style="color:#c3c5d9"><strong>${name}</strong> (${email})</p><p style="color:#c3c5d9;line-height:1.6">${(message || "").replace(/</g, "&lt;")}</p>`)
  );
  // Acknowledge the rider
  return send(
    email,
    "We got your message",
    shell("Message received", `<p style="color:#c3c5d9;line-height:1.6">Thanks ${name} — the garage crew will get back to you within one business day.</p>`)
  );
}
