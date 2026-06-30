import type { Order } from "@/lib/types";

/**
 * Email + contact delivery is handled by the Render backend service
 * (see /server). The Next app calls it server-to-server with a shared key.
 * If RENDER_API_URL isn't set, calls are skipped (logged) so local dev still runs.
 */
const BASE = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
const KEY = process.env.INTERNAL_API_KEY || "";

async function call(path: string, body: unknown) {
  if (!BASE) {
    console.warn(`[backend] RENDER_API_URL not set — skipped ${path}`);
    return { skipped: true };
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": KEY },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) console.error(`[backend] ${path} -> ${res.status}`);
    return res.json().catch(() => ({}));
  } catch (e) {
    console.error(`[backend] ${path} failed`, e);
    return { error: true };
  }
}

export function sendWelcomeEmail(email: string, name?: string) {
  return call("/email/welcome", { email, name });
}

export function sendOrderConfirmationEmail(order: Order) {
  return call("/email/order-confirmation", { order });
}

export function sendNewsletterConfirmation(email: string) {
  return call("/email/newsletter", { email });
}

export function sendContactMessage(msg: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  return call("/contact", msg);
}
