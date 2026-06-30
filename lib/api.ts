/**
 * Thin client for the backend API hosted on Render.
 *
 * Set NEXT_PUBLIC_API_BASE_URL in your environment (see .env.example). All
 * storefront data calls (products, inventory, orders) should go through here so
 * the Render service stays the single source of truth for commerce data.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set — point it at your Render backend."
    );
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
