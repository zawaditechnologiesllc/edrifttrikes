import { countryName, flagEmoji } from "@/lib/countries";
import {
  RISK_FLAG_COPY,
  zoneGapHours,
  type RiskFlag,
  type RiskLevel,
} from "@/lib/risk";

/**
 * Where an order was placed from, for the admin.
 *
 * Two views of the same record: a compact cell for the order list, and a full
 * panel for the detail page. Both are read-only server components — there is
 * nothing here to click, because there is nothing here that should trigger an
 * action. It is evidence for a person to weigh, not a verdict.
 */

type OriginRow = {
  origin_country?: string | null;
  origin_region?: string | null;
  origin_city?: string | null;
  origin_timezone?: string | null;
  origin_asn?: number | null;
  origin_network?: string | null;
  client_timezone?: string | null;
  risk_level?: string | null;
  risk_score?: number | null;
  risk_flags?: string[] | null;
  shipping_address?: Record<string, unknown> | null;
};

const LEVEL_STYLE: Record<RiskLevel, string> = {
  clear: "text-outline",
  review: "text-secondary border-secondary/50 bg-secondary/10",
  high: "text-error border-error/50 bg-error/10",
};

const LEVEL_LABEL: Record<RiskLevel, string> = {
  clear: "Clear",
  review: "Check",
  high: "Review",
};

function level(row: OriginRow): RiskLevel | null {
  const v = row.risk_level;
  return v === "clear" || v === "review" || v === "high" ? v : null;
}

/** Flags we have copy for; anything unrecognised is ignored rather than shown raw. */
function flags(row: OriginRow): RiskFlag[] {
  return (row.risk_flags ?? []).filter(
    (f): f is RiskFlag => Object.prototype.hasOwnProperty.call(RISK_FLAG_COPY, f)
  );
}

/** "Nairobi, Kenya" / "Kenya" / null — as much place as we actually know. */
function place(row: OriginRow): string | null {
  const country = countryName(row.origin_country);
  const city = row.origin_city?.trim() || null;
  if (city && country) return `${city}, ${country}`;
  return country || city;
}

/* -------------------------------------------------------------------------
 * The order list
 * ---------------------------------------------------------------------- */

/**
 * One table cell: the flag, and a badge only when there is something to say.
 *
 * A "Clear" badge on every ordinary order would be noise that trains the owner
 * to skim past the column — so a clear order shows its flag and nothing else.
 */
export function OriginCell({ order }: { order: OriginRow }) {
  const code = (order.origin_country ?? "").toUpperCase();
  const tor = code === "T1";
  const flag = tor ? null : flagEmoji(code);
  const risk = level(order);
  const named = flags(order);

  if (!code && !risk) {
    return <span className="text-outline text-sm">—</span>;
  }

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span
        title={tor ? "Tor exit node" : (place(order) ?? code)}
        className="text-base leading-none"
      >
        {tor ? "🧅" : (flag ?? "🌐")}
      </span>
      <span className="text-on-surface-variant text-xs font-label-bold uppercase tracking-widest">
        {tor ? "Tor" : code || "??"}
      </span>
      {risk && risk !== "clear" && (
        <span
          title={named.map((f) => RISK_FLAG_COPY[f].label).join(" · ")}
          className={`border rounded px-1.5 py-0.5 text-[10px] font-label-bold uppercase tracking-widest ${LEVEL_STYLE[risk]}`}
        >
          {LEVEL_LABEL[risk]}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * The order detail page
 * ---------------------------------------------------------------------- */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-on-surface-variant text-xs uppercase tracking-widest shrink-0">
        {label}
      </span>
      <span className="text-white text-sm text-right break-words">{value}</span>
    </div>
  );
}

/**
 * The full record, with every flag explained.
 *
 * The explanations are the important half. A flag on its own invites the owner
 * to cancel a real customer's order; a flag next to "millions of ordinary
 * people pay for a VPN" invites them to look at the payment instead.
 */
export function OriginPanel({ order }: { order: OriginRow }) {
  const code = (order.origin_country ?? "").toUpperCase();
  const risk = level(order);
  const named = flags(order);
  const gap = zoneGapHours(order.origin_timezone, order.client_timezone);
  const shippingCountry = String(
    (order.shipping_address as Record<string, unknown> | null)?.country ?? ""
  ).trim();

  const known = code || order.origin_network || order.origin_timezone;

  return (
    <div className="bg-surface-container border border-white/10 rounded-lg p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="font-headline-md text-headline-md text-white uppercase">
          Where it came from
        </h2>
        {risk && (
          <span
            className={`border rounded px-2 py-1 text-[10px] font-label-bold uppercase tracking-widest ${LEVEL_STYLE[risk]}`}
          >
            {LEVEL_LABEL[risk]}
          </span>
        )}
      </div>

      {!known ? (
        <p className="text-on-surface-variant text-sm leading-relaxed">
          Nothing was recorded for this order. Orders placed before this was
          added don&apos;t carry it, and a request that reached the store without
          passing the CDN can&apos;t be placed.
        </p>
      ) : (
        <>
          <div className="mb-4">
            {code === "T1" ? (
              <Row label="Connection" value="🧅 Tor exit node — location unknowable" />
            ) : (
              <Row
                label="Connecting from"
                value={`${flagEmoji(code) ?? "🌐"} ${place(order) ?? code ?? "Unknown"}`}
              />
            )}
            {order.origin_region && <Row label="Region" value={order.origin_region} />}
            {shippingCountry && <Row label="Shipping to" value={shippingCountry} />}
            {order.origin_network && (
              <Row
                label="Network"
                value={
                  order.origin_asn
                    ? `${order.origin_network} (AS${order.origin_asn})`
                    : order.origin_network
                }
              />
            )}
            {order.origin_timezone && (
              <Row label="Timezone (from IP)" value={order.origin_timezone} />
            )}
            {order.client_timezone && (
              <Row
                label="Timezone (their device)"
                value={
                  gap && gap > 0
                    ? `${order.client_timezone} — ${gap} hour${gap === 1 ? "" : "s"} out`
                    : order.client_timezone
                }
              />
            )}
          </div>

          {named.length > 0 ? (
            <div className="space-y-3">
              {named.map((f) => (
                <div key={f} className="border-l-2 border-secondary/50 pl-3">
                  <p className="text-white text-xs font-label-bold uppercase tracking-widest">
                    {RISK_FLAG_COPY[f].label}
                  </p>
                  <p className="text-on-surface-variant text-[13px] leading-relaxed mt-1">
                    {RISK_FLAG_COPY[f].detail}
                  </p>
                </div>
              ))}
              <p className="text-outline text-[11px] leading-relaxed pt-2 border-t border-white/5">
                These are hints, not findings — none of them stopped this order,
                and none of them should on their own. A residential proxy, which
                is what card fraud actually runs on, would show none of them. The
                check that catches a stolen card is in Stripe → Radar.
              </p>
            </div>
          ) : (
            <p className="text-on-surface-variant text-sm">
              Nothing unusual: a consumer connection, in the country it says it
              is in, with a clock that agrees.
            </p>
          )}
        </>
      )}
    </div>
  );
}
