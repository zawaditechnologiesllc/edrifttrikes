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
// Credentials are read at CALL time (not module scope): on Cloudflare, secrets
// are runtime Worker bindings that aren't visible when the module is first
// evaluated, so module-scope reads would silently disable PayPal.
import { serverEnv } from "@/lib/env";

function base(): string {
  const env = (serverEnv("PAYPAL_ENV") || "sandbox").toLowerCase();
  return env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}
function clientId(): string {
  return serverEnv("PAYPAL_CLIENT_ID") || "";
}
function secret(): string {
  return serverEnv("PAYPAL_SECRET") || "";
}

export function paypalConfigured() {
  return Boolean(clientId() && secret());
}

async function accessToken(): Promise<string> {
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId()}:${secret()}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    // Include PayPal's body — a 401 here returns {"error":"invalid_client"},
    // which is the tell-tale of wrong credentials OR a sandbox/live mismatch
    // (PAYPAL_ENV pointing at the wrong endpoint for the keys in use).
    const body = await res.text().catch(() => "");
    throw new Error(`PayPal auth failed: ${res.status} ${body}`.slice(0, 300));
  }
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
  const res = await fetch(`${base()}/v2/checkout/orders`, {
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
        // Land buyers on PayPal's guest card-entry page so they can pay with a
        // debit/credit card WITHOUT a PayPal account. This is what makes the
        // redirect flow capture card payments. It requires "PayPal account
        // optional" to be ENABLED on the PayPal Business account (see
        // docs/DEPLOYMENT.md §4b) — otherwise PayPal falls back to the login
        // page and cards won't be offered.
        landing_page: "GUEST_CHECKOUT",
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
  const res = await fetch(`${base()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string };
  return { ok: res.ok && data.status === "COMPLETED", status: data.status };
}

/**
 * Connectivity diagnostic — exposes exactly why checkout can't reach PayPal,
 * without leaking any secret. Returns the effective `env` (so a sandbox/live
 * mismatch is obvious), whether OAuth succeeds, and — when `full` is set — the
 * result of a throwaway order-create (which also exercises `landing_page`).
 * Surfaced at GET /api/health/paypal.
 */
export async function probePayPal(full = false): Promise<{
  configured: boolean;
  env: string;
  auth?: { ok: boolean; status?: number; reason?: string };
  order?: { ok: boolean; status?: number; reason?: string };
}> {
  const env = (serverEnv("PAYPAL_ENV") || "sandbox").toLowerCase();
  if (!paypalConfigured()) return { configured: false, env };

  // 1) OAuth — a 401 {"error":"invalid_client"} means wrong creds or the keys
  // don't match `env` (sandbox keys with env=live, or vice versa).
  const tokenRes = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId()}:${secret()}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  }).catch((e) => ({ ok: false, status: 0, text: async () => String((e as Error).message) }) as unknown as Response);

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    return { configured: true, env, auth: { ok: false, status: tokenRes.status, reason: body.slice(0, 300) } };
  }
  const { access_token: token } = (await tokenRes.json()) as { access_token: string };
  if (!full) return { configured: true, env, auth: { ok: true } };

  // 2) Throwaway $1 order create — exercises the real create path incl.
  // landing_page. It is never captured, so it just expires.
  const orderRes = await fetch(`${base()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: "1.00" } }],
      application_context: {
        brand_name: "E-Drift Trikes & Go Carts",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        landing_page: "GUEST_CHECKOUT",
        return_url: "https://edrifttrikes.shop/api/paypal/capture",
        cancel_url: "https://edrifttrikes.shop/checkout",
      },
    }),
  });
  const orderData = (await orderRes.json().catch(() => ({}))) as { id?: string };
  if (orderRes.ok && orderData.id) {
    return { configured: true, env, auth: { ok: true }, order: { ok: true } };
  }
  return {
    configured: true,
    env,
    auth: { ok: true },
    order: { ok: false, status: orderRes.status, reason: JSON.stringify(orderData).slice(0, 400) },
  };
}
