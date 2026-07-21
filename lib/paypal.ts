/**
 * PayPal (REST v2) — used as an optional alternative to Stripe.
 *
 * The app creates an order, redirects the buyer to PayPal to approve, then
 * captures it on return (see app/api/paypal/capture/route.ts). Pure fetch, so
 * it runs on Cloudflare Workers (OpenNext) and Node alike.
 *
 * Configure with PAYPAL_CLIENT_ID + PAYPAL_SECRET (and PAYPAL_ENV=live|sandbox).
 * When these are absent, paypalConfigured() is false and PayPal simply isn't
 * offered at checkout.
 */
const ENV = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
const BASE = ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const SECRET = process.env.PAYPAL_SECRET || "";

export function paypalConfigured() {
  return Boolean(CLIENT_ID && SECRET);
}

async function accessToken(): Promise<string> {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type PayPalLink = { rel: string; href: string };

export async function createPayPalOrder(params: {
  amountCents: number;
  currency?: string;
  orderNumber: string;
  orderId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; approveUrl: string | undefined }> {
  const token = await accessToken();
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.orderNumber,
          custom_id: params.orderId,
          invoice_id: params.orderNumber,
          amount: {
            currency_code: (params.currency || "USD").toUpperCase(),
            value: (params.amountCents / 100).toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "E-Drift Trikes & Go Carts",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
  });
  const data = (await res.json()) as { id: string; links?: PayPalLink[] };
  if (!res.ok || !data.id) {
    throw new Error(`PayPal order create failed: ${res.status} ${JSON.stringify(data)}`);
  }
  const approveUrl = (data.links || []).find((l) => l.rel === "approve")?.href;
  return { id: data.id, approveUrl };
}

export async function capturePayPalOrder(
  paypalOrderId: string
): Promise<{ ok: boolean; status?: string }> {
  const token = await accessToken();
  const res = await fetch(`${BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string };
  return { ok: res.ok && data.status === "COMPLETED", status: data.status };
}
