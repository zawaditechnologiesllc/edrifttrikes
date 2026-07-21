/**
 * Thin client for the backend API hosted on Render.
 *
 * Set NEXT_PUBLIC_API_BASE_URL in your environment (see .env.example). All
 * storefront data calls (products, inventory, orders) should go through here so
 * the Render service stays the single source of truth for commerce data.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// Bound every backend call so a cold Render instance (free-tier spin-up can be
// ~50s) can't hang the caller. Overridable per-call for genuinely slow paths.
const DEFAULT_TIMEOUT_MS = 8000;

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set — point it at your Render backend."
    );
  }

  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...requestInit } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
      signal: requestInit.signal ?? controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(requestInit.headers ?? {}),
      },
    });

    if (!res.ok) {
      throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}
