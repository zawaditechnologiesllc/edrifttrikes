/**
 * PayPal REST helpers for the Render backend — used to verify inbound webhook
 * signatures. The Cloudflare app owns order create/capture (lib/paypal.ts);
 * here we only need to confirm that a webhook really came from PayPal before we
 * act on it, so this is deliberately small.
 *
 * Needs PAYPAL_CLIENT_ID + PAYPAL_SECRET (+ PAYPAL_ENV=live|sandbox) on Render —
 * the same credentials the app uses, plus PAYPAL_WEBHOOK_ID for verification.
 */

function base() {
  const env = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
  return env === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
}

async function accessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!id || !secret) throw new Error("PayPal credentials not set on the backend");
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

/**
 * Ask PayPal to verify a webhook's signature. Returns true only when PayPal
 * confirms the event is authentic. `event` is the parsed JSON body; `headers`
 * is the Express req.headers object (lower-cased keys).
 */
export async function verifyPayPalWebhook(headers, event, webhookId) {
  const token = await accessToken();
  const res = await fetch(`${base()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => ({}));
  return data.verification_status === "SUCCESS";
}
