import { isKnownStorefront, storefrontLabel } from "@/lib/regions";

/**
 * Which storefront an order came in on.
 *
 * ═══ WHY THIS IS A COLUMN AND NOT A DETAIL-PAGE FIELD ══════════════════════
 *
 * Because the question it answers is comparative. "Is the UAE link working?"
 * is not a question about one order, it is a question about the shape of a
 * list — and a value you have to open twenty orders to collect is a value
 * nobody collects.
 *
 * A HOST THAT IS NOT A KNOWN STOREFRONT IS SHOWN AS ITSELF, not hidden. An
 * order placed on a preview deployment or an old hostname is exactly the
 * anomaly this column is worth having for, and a blank cell would bury it.
 */
export default function StorefrontCell({ host }: { host: string | null | undefined }) {
  const label = storefrontLabel(host);

  if (!label) {
    return (
      // Null is ordinary, not a fault: admin-typed orders have no storefront,
      // and neither does anything placed before the column existed.
      <span className="text-outline text-xs" title="No storefront recorded — typed in by an admin, or placed before this was tracked">
        —
      </span>
    );
  }

  const known = isKnownStorefront(host);
  return (
    <span
      className={
        known
          ? "text-on-surface-variant text-xs whitespace-nowrap"
          : "text-signal-orange text-xs break-all"
      }
      title={String(host)}
    >
      {label}
      {!known && (
        <span className="block text-[10px] text-outline">not a known storefront</span>
      )}
    </span>
  );
}
