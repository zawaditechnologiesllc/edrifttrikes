import {
  PAYMENT_SOURCES,
  SOURCE_LABEL,
  type PaymentSource,
} from "@/lib/payment-display";

/**
 * How the money reached us, as a badge.
 *
 * Colour lives here; the LABELS come from lib/payment-display.ts, which the
 * order page, the invoice PDF and the rider's dashboard read too — so a
 * provider is named identically on every surface or on none of them.
 */
const SOURCE_CLASS: Record<PaymentSource, string> = {
  stripe: "bg-primary-container/30 text-primary border-primary/30",
  paypal: "bg-secondary/10 text-secondary border-secondary/30",
  authorizenet: "bg-white/10 text-white border-white/20",
  // Manual entries stand out on purpose: they are the ones with no gateway
  // record behind them, so they are the ones worth a second look.
  manual: "bg-signal-orange/10 text-signal-orange border-signal-orange/30",
};

export default function PaymentSourceBadge({
  via,
}: {
  via: string | null | undefined;
}) {
  // Orders paid before migration 0007 ran have no recorded source.
  const source = (PAYMENT_SOURCES as readonly string[]).includes(via ?? "")
    ? (via as PaymentSource)
    : null;
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-label-bold uppercase tracking-widest ${
        source ? SOURCE_CLASS[source] : "bg-white/5 text-on-surface-variant border-white/10"
      }`}
    >
      {source ? SOURCE_LABEL[source] : "Unknown"}
    </span>
  );
}
