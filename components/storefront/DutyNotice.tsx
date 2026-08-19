import { formatMoney } from "@/lib/format";
import { DEFAULT_DUTY_RATE_BPS } from "@/lib/totals";

/**
 * Import-duty disclosure — shown in the cart, at checkout, and on the receipt.
 *
 * One component so the wording is identical everywhere. The point of the
 * wording is that the buyer understands three things without reading twice:
 * the amount is an estimate, we are not charging it, and they will pay it to
 * their own customs authority. A duty line that reads like part of the bill is
 * worse than no line at all.
 */

export function dutyRateLabel(rateBps: number = DEFAULT_DUTY_RATE_BPS): string {
  // 1350 → "13.5%", 1000 → "10%"
  const pct = rateBps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** Compact row for a totals table, visually separated from the charged lines. */
export function DutyRow({
  duty,
  currency = "usd",
  rateBps = DEFAULT_DUTY_RATE_BPS,
}: {
  duty: number;
  currency?: string;
  rateBps?: number;
}) {
  if (duty <= 0) return null;
  return (
    <div className="border-t border-dashed border-white/10 mt-3 pt-3">
      <div className="flex justify-between text-on-surface-variant">
        <span>
          Import duty ({dutyRateLabel(rateBps)})
          <span className="block text-[10px] uppercase tracking-widest text-outline mt-0.5">
            Not charged by us
          </span>
        </span>
        <span className="text-on-surface-variant">{formatMoney(duty, currency)}</span>
      </div>
      <p className="text-outline text-xs mt-2 leading-relaxed">
        Estimated customs duty on the value of your goods, payable by you to your
        local government when the shipment arrives. It is{" "}
        <span className="text-on-surface-variant">not included in your total</span>{" "}
        and we never collect it. The exact amount is set by your country&apos;s
        customs authority and may differ.
      </p>
    </div>
  );
}
