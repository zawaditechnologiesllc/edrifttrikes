/**
 * What we can tell about where an order came from, and how much of it is worth
 * an admin's attention.
 *
 * WHY THIS EXISTS: stolen-card attempts arrive from somewhere, and until now an
 * order carried no record of where. This gives the owner the same view a
 * payment processor has — the visitor's country, their network, and whether the
 * story those tell hangs together with the address they typed.
 *
 * ═══ READ THIS BEFORE TRUSTING IT ═══════════════════════════════════════════
 *
 * THIS DOES NOT DETECT VPNs. Nothing does, reliably. What it detects is a
 * connection that does not look residential, and facts that contradict each
 * other. A commercial VPN is caught because it runs on rented server hardware
 * whose network is named in public routing data. A RESIDENTIAL PROXY — the kind
 * card fraudsters actually buy, which routes through a compromised home router
 * in the victim's own city — looks exactly like a customer and will pass every
 * check here.
 *
 * So this is a REVIEW TOOL, not a gate. Nothing in this file refuses an order,
 * and nothing should: a corporate VPN, a privacy-minded customer, an expat and
 * a business traveller all trip these flags, and every one of them is a real
 * sale. The control that actually stops a stolen card is at the payment layer —
 * Stripe Radar, issuing-country mismatch, CVC and postcode checks, 3DS
 * liability shift. See docs/PAYMENTS.md §7.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DEPENDENCY-FREE so the checkout route, the admin pages and the tests all read
 * one definition.
 */

/** Everything the edge and the browser told us about one checkout. */
export type OrderOrigin = {
  /** ISO alpha-2 the edge resolved the IP to. */
  country: string | null;
  region: string | null;
  city: string | null;
  /** IANA zone the edge resolved the IP to ("America/New_York"). */
  timezone: string | null;
  /** Autonomous system number — who announces the IP range. */
  asn: number | null;
  /** Human name of that network ("Comcast Cable", "DigitalOcean, LLC"). */
  network: string | null;
  /** What the BROWSER's own clock says its zone is. The interesting one. */
  clientTimezone: string | null;
};

export type RiskFlag =
  | "tor"
  | "known_vpn"
  | "hosting_network"
  | "timezone_mismatch"
  | "country_mismatch"
  | "unknown_origin";

export type RiskLevel = "clear" | "review" | "high";

export type RiskAssessment = {
  level: RiskLevel;
  /** Sum of the weights below. Only meaningful relative to the thresholds. */
  score: number;
  flags: RiskFlag[];
};

/**
 * Plain English for the admin panel.
 *
 * Every `detail` says what the signal is AND what it isn't, because a flag
 * without that second half turns into an excuse to cancel a real customer's
 * order.
 */
export const RISK_FLAG_COPY: Record<RiskFlag, { label: string; detail: string }> = {
  tor: {
    label: "Tor exit node",
    detail:
      "The connection arrived through Tor, so the real location is unknowable. Legitimate customers do use Tor — treat it as a reason to look, not a verdict.",
  },
  known_vpn: {
    label: "Commercial VPN",
    detail:
      "The network belongs to a company that sells VPN access. Millions of ordinary people pay for one; this only means the stated location isn't where they are.",
  },
  hosting_network: {
    label: "Datacentre connection",
    detail:
      "The IP belongs to a hosting or cloud provider, not a home or mobile ISP. That is what a VPN, a proxy or a script looks like — but also what a corporate network sometimes looks like.",
  },
  timezone_mismatch: {
    label: "Clock doesn't match the IP",
    detail:
      "The browser's own timezone disagrees with the one the IP resolves to. A VPN changes the IP but not the computer's clock, so this is the strongest single hint here. A traveller whose laptop hasn't caught up looks the same.",
  },
  country_mismatch: {
    label: "Browsing from another country",
    detail:
      "They are connecting from one country and shipping to another. Completely normal for gifts, expats and people abroad — worth noticing only next to the other flags.",
  },
  unknown_origin: {
    label: "No location data",
    detail:
      "The edge could not place this connection at all. Usually means a direct hit that bypassed the CDN, or a local test — not by itself suspicious.",
  },
};

/**
 * Weights.
 *
 * Deliberately arranged so that NO SINGLE FLAG reaches "high" on its own except
 * Tor: one fact about a connection is never a fraud case, and an owner who gets
 * a red badge on every VPN user stops reading the badges within a week.
 */
const WEIGHTS: Record<RiskFlag, number> = {
  tor: 45,
  known_vpn: 35,
  hosting_network: 30,
  timezone_mismatch: 25,
  country_mismatch: 15,
  unknown_origin: 10,
};

/** score >= this is worth stopping for. */
export const HIGH_THRESHOLD = 40;
/** score >= this is worth a glance. */
export const REVIEW_THRESHOLD = 15;

/**
 * Networks that sell VPN access, or are known mostly for hosting it.
 *
 * Matched against the AS organisation name, lower-cased. Short and
 * conservative on purpose: a false positive here is a real customer wearing a
 * warning label, and the list is only useful for as long as the owner still
 * believes it.
 */
const VPN_NETWORKS = [
  "nordvpn",
  "expressvpn",
  "surfshark",
  "mullvad",
  "private internet access",
  "protonvpn",
  "proton ag",
  "cyberghost",
  "ipvanish",
  "windscribe",
  "tunnelbear",
  "hide.me",
  "purevpn",
  "torguard",
  "m247",
  "datacamp limited",
  "packethub",
  "cdn77",
  "perfect privacy",
  "oxylabs",
  "bright data",
  "luminati",
  "smartproxy",
  "cloudflare warp",
];

/**
 * Hosting and cloud providers — a connection from here is not somebody's sofa.
 *
 * NOT a fraud list. Half the internet's traffic legitimately originates in
 * these networks; it just isn't retail customer traffic.
 */
const HOSTING_NETWORKS = [
  "amazon",
  "aws",
  "google cloud",
  "google llc",
  "microsoft azure",
  "microsoft corporation",
  "digitalocean",
  "linode",
  "akamai",
  "ovh",
  "hetzner",
  "contabo",
  "vultr",
  "choopa",
  "scaleway",
  "leaseweb",
  "oracle",
  "alibaba",
  "tencent",
  "quadranet",
  "psychz",
  "zenlayer",
  "hostinger",
  "godaddy",
  "namecheap",
  "ionos",
  "rackspace",
  "equinix",
  "servers.com",
  "hosting",
  "datacenter",
  "data center",
  "colocation",
  "cloudflare",
];

function matchesAny(haystack: string, needles: string[]): boolean {
  const value = haystack.toLowerCase();
  return needles.some((n) => value.includes(n));
}

/** True when the network name looks like a company that sells VPN access. */
export function isVpnNetwork(network: string | null | undefined): boolean {
  const name = String(network ?? "").trim();
  if (!name) return false;
  // "VPN" as a standalone word catches the long tail of small operators
  // without matching, say, "Vpnet Telecom".
  if (/\bvpns?\b/i.test(name)) return true;
  return matchesAny(name, VPN_NETWORKS);
}

/** True when the network name looks like hosting rather than a consumer ISP. */
export function isHostingNetwork(network: string | null | undefined): boolean {
  const name = String(network ?? "").trim();
  if (!name) return false;
  return matchesAny(name, HOSTING_NETWORKS);
}

/**
 * The UTC offset of an IANA zone right now, in minutes, or null.
 *
 * Compared as OFFSETS rather than names because "Europe/London" and
 * "Europe/Belfast" are the same place, and a customer must not be flagged over
 * which alias their browser happens to report. Returns null on any runtime
 * without the timezone data, which is the same as "don't flag it".
 */
export function zoneOffsetMinutes(zone: string | null | undefined, at: Date = new Date()): number | null {
  const tz = String(zone ?? "").trim();
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // "GMT+05:30", "GMT-4", or plain "GMT" at zero.
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
    if (!m) return /^GMT$/.test(name.trim()) ? 0 : null;
    const sign = m[1] === "-" ? -1 : 1;
    return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  } catch {
    // An unknown zone string, or a runtime without full timezone data.
    return null;
  }
}

/**
 * How far apart two zones are, in hours, or null when either is unusable.
 *
 * Exposed so the admin panel can say "8 hours out" rather than just "mismatch"
 * — the size of the gap is what tells you whether it is a VPN or a laptop that
 * crossed a border yesterday.
 */
export function zoneGapHours(
  a: string | null | undefined,
  b: string | null | undefined,
  at: Date = new Date()
): number | null {
  const first = zoneOffsetMinutes(a, at);
  const second = zoneOffsetMinutes(b, at);
  if (first === null || second === null) return null;
  return Math.abs(first - second) / 60;
}

/**
 * Cloudflare's placeholders. `T1` is a Tor exit and `XX` is "could not place
 * it" — both are two characters long and neither is a country, so they have to
 * be excluded explicitly or "browsing from another country" gets reported about
 * a connection that has no country.
 */
const NOT_A_COUNTRY = new Set(["T1", "XX"]);

/** Two-letter comparison that treats blanks as "don't know", never as unequal. */
function differentCountry(a: string | null | undefined, b: string | null | undefined): boolean {
  const first = String(a ?? "").trim().toUpperCase();
  const second = String(b ?? "").trim().toUpperCase();
  if (first.length !== 2 || second.length !== 2) return false;
  if (NOT_A_COUNTRY.has(first) || NOT_A_COUNTRY.has(second)) return false;
  return first !== second;
}

/**
 * Score one checkout.
 *
 * `shippingCountry` is the ISO code off the address they typed. Pass null when
 * it isn't known and the mismatch check simply doesn't run — a missing fact
 * must never become a flag.
 */
export function assessOrigin(
  origin: Partial<OrderOrigin>,
  shippingCountry?: string | null,
  at: Date = new Date()
): RiskAssessment {
  const flags: RiskFlag[] = [];

  // Cloudflare reports Tor exits as T1 rather than a country.
  const country = String(origin.country ?? "").trim().toUpperCase();
  if (country === "T1") flags.push("tor");

  if (isVpnNetwork(origin.network)) flags.push("known_vpn");
  else if (isHostingNetwork(origin.network)) {
    // Not both: a VPN company IS a hosting company, and counting it twice
    // would push every VPN user straight past the "high" threshold.
    flags.push("hosting_network");
  }

  const gap = zoneGapHours(origin.timezone, origin.clientTimezone, at);
  if (gap !== null && gap > 0) flags.push("timezone_mismatch");

  if (differentCountry(country, shippingCountry)) flags.push("country_mismatch");

  // Only when we learned nothing at all. A partial record is still a record,
  // and a placeholder country is not a fact we learned.
  // Not alongside Tor: "no location data" is what Tor IS, and saying both makes
  // the panel look like it found two problems where it found one.
  const placedSomewhere = Boolean(country) && !NOT_A_COUNTRY.has(country);
  if (!placedSomewhere && !origin.network && !origin.timezone && !flags.includes("tor")) {
    flags.push("unknown_origin");
  }

  const score = flags.reduce((total, f) => total + WEIGHTS[f], 0);
  const level: RiskLevel =
    score >= HIGH_THRESHOLD ? "high" : score >= REVIEW_THRESHOLD ? "review" : "clear";

  return { level, score, flags };
}

/** One line for the admin list. */
export function riskSummary(assessment: RiskAssessment): string {
  if (assessment.flags.length === 0) return "Nothing unusual";
  return assessment.flags.map((f) => RISK_FLAG_COPY[f].label).join(" · ");
}
