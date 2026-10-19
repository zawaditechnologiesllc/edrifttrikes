import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { OrderOrigin } from "@/lib/risk";

/**
 * Where a request came from, as far as the edge can tell.
 *
 * SERVER ONLY, and kept apart from lib/risk.ts (which scores what this
 * collects) because this is the one piece that has to reach into the Cloudflare
 * runtime — everything downstream of it is plain data and plain functions.
 *
 * COSTS NOTHING AND SLOWS NOTHING DOWN. Cloudflare has already resolved all of
 * this by the time the Worker runs — it rides along on the request. There is no
 * lookup, no third-party API, no added latency, and no IP address leaves the
 * store. That was the requirement: get the location without disrupting
 * anything.
 *
 * WHAT IS DELIBERATELY NOT COLLECTED: the visitor's IP address. It is the most
 * sensitive field available and the least useful for review — country, city and
 * network answer "does this add up?" without the store holding an identifier it
 * would then have to protect, disclose and delete on request.
 */

/** The `cf` object, or nothing when we're not running on Cloudflare. */
function cfProperties(): Record<string, unknown> | null {
  try {
    const cf = getCloudflareContext().cf as Record<string, unknown> | undefined;
    return cf ?? null;
  } catch {
    // Local dev, `next build`, or a Node runtime. Headers still work.
    return null;
  }
}

function str(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** What the browser volunteered about itself. Never trusted, only compared. */
export type ClientHints = {
  /** `Intl.DateTimeFormat().resolvedOptions().timeZone` from the checkout page. */
  timezone?: unknown;
};

/**
 * Read the origin off a request.
 *
 * `XX` — Cloudflare's "could not place it" — becomes null, because it is not a
 * country and storing it as one would put "XX" in the admin panel. `T1` (Tor)
 * is KEPT: it is not a country either, but it is a fact worth recording, and
 * lib/risk.ts knows to treat it as a signal rather than a place.
 */
export function originFromRequest(
  request: Request,
  hints: ClientHints = {}
): OrderOrigin {
  const cf = cfProperties();
  const header = (name: string) => str(request.headers.get(name));

  const rawCountry =
    str(cf?.country)?.toUpperCase() ?? header("cf-ipcountry")?.toUpperCase() ?? null;

  return {
    country: rawCountry === "XX" ? null : rawCountry,
    // These three come from `cf` normally. The header forms only exist when the
    // "Add visitor location headers" managed transform is switched on, so they
    // are a fallback rather than the source.
    region: str(cf?.region) ?? header("cf-region"),
    city: str(cf?.city) ?? header("cf-ipcity"),
    timezone: str(cf?.timezone) ?? header("cf-timezone"),
    asn: num(cf?.asn),
    network: str(cf?.asOrganization),
    // The browser's own clock. A VPN moves the IP but not the operating
    // system's timezone, which is what makes the pair worth comparing.
    clientTimezone: str(hints.timezone, 64),
  };
}

/**
 * The hostname a request was made to, normalised.
 *
 * ⚠️ THE HOST HEADER IS ATTACKER-CONTROLLED, so this is a RECORD, never a
 * decision. Nothing branches on it: `regionFromHost` does its own verification
 * before a host selects a storefront, and this only writes down what arrived.
 * Even so it is normalised and length-capped — an order row is rendered in the
 * admin, and an unbounded attacker-supplied string has no business going into
 * a database column that a human will later read.
 */
export function checkoutHost(request: Request): string | null {
  const raw = String(request.headers.get("host") ?? "")
    .trim()
    .toLowerCase()
    .split(",")[0]          // a proxy may append; the first is this request's
    .replace(/:\d+$/, "")   // drop the port
    .replace(/\.$/, "");    // and a fully-qualified trailing dot
  if (!raw) return null;
  // Hostnames are letters, digits, dots and hyphens. Anything else did not
  // come from a browser addressing this site.
  if (!/^[a-z0-9.-]+$/.test(raw)) return null;
  return raw.slice(0, 253) || null;
}
