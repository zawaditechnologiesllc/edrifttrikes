import type { Order } from "@/lib/types";

/**
 * Email + contact delivery is handled by the Render backend service
 * (see /server). The Next app calls it server-to-server with a shared key.
 * If RENDER_API_URL isn't set, calls are skipped (logged) so local dev still runs.
 */
// Read at CALL time (not module scope): on Cloudflare these are runtime Worker
// bindings that aren't visible when the module is first evaluated.
import { serverEnv } from "@/lib/env";

function backendBase(): string {
  return serverEnv("RENDER_API_URL") || serverEnv("NEXT_PUBLIC_API_BASE_URL") || "";
}
function internalKey(): string {
  return serverEnv("INTERNAL_API_KEY") || "";
}

// Cap how long we wait on the Render backend. On the free tier it can be cold
// (a ~50s spin-up) — without a bound, a single email/contact call would pin a
// Vercel serverless function until its own timeout, wasting the invocation and
// stalling the user's request. Email is best-effort, so we'd rather fail fast
// and let the caller degrade gracefully.
const BACKEND_TIMEOUT_MS = 8000;

async function call(path: string, body: unknown) {
  const base = backendBase();
  if (!base) {
    console.warn(`[backend] RENDER_API_URL not set — skipped ${path}`);
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
