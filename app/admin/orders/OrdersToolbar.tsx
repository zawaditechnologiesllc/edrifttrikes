"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { refreshOrders, syncStripePayments, type SyncState } from "../actions";
import { summarizeSync } from "@/lib/order-sync";
import { formatMoney } from "@/lib/format";

/**
 * The two questions an orders page cannot answer by itself.
 *
 *   "Does this match Supabase?"  → Refresh, which re-reads and says how many
 *                                  rows the database holds.
 *   "Does Supabase match Stripe?" → Check Stripe, which finds orders that were
 *                                  paid but never marked paid, repairs them,
 *                                  and lists payments that have no order at all.
 *
 * They are separate buttons because they are separate failures with separate
 * fixes, and one of them writes to orders.
 */

function Busy({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? busy : idle}</>;
}

const button =
  "border border-white/20 text-on-surface-variant hover:text-white hover:border-white/40 px-4 py-2.5 rounded text-xs font-label-bold uppercase tracking-widest transition-colors disabled:opacity-50";

function SubmitButton({
  idle,
  busy,
  primary,
}: {
  idle: string;
  busy: string;
  primary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        primary
          ? "bg-primary-container text-white px-4 py-2.5 rounded text-xs font-label-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          : button
      }
    >
      <Busy idle={idle} busy={busy} />
    </button>
  );
}

export default function OrdersToolbar({
  totalInDatabase,
}: {
  totalInDatabase: number;
}) {
  const [sync, syncAction] = useActionState<SyncState, FormData>(
    syncStripePayments,
    {}
  );
  const report = sync.report;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <form action={refreshOrders}>
          <SubmitButton idle="↻ Refresh from Supabase" busy="Reading…" />
        </form>

        <form action={syncAction} className="flex flex-wrap items-center gap-3">
          {/*
            Off by default. These are payments from days or weeks ago; the
            buyer has their Stripe receipt, and a confirmation arriving now
            reads as a second charge. Tick it when the point IS to tell them.
          */}
          <input type="hidden" name="notify" value="off" />
          <SubmitButton idle="Check Stripe for missed payments" busy="Asking Stripe…" primary />
          <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
            <input
              type="checkbox"
              name="notify"
              value="on"
              className="rounded border-white/20 bg-surface-container-highest text-secondary focus:ring-0"
            />
            email the customers it repairs
          </label>
        </form>

        <span className="text-on-surface-variant text-xs ml-auto">
          {totalInDatabase} order{totalInDatabase === 1 ? "" : "s"} in Supabase
        </span>
      </div>

      {report && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            report.blocked
              ? "border-error/40 bg-error/10"
              : report.repaired.length > 0 || report.orphans.length > 0
                ? "border-signal-orange/40 bg-signal-orange/10"
                : "border-secondary/40 bg-secondary/10"
          }`}
        >
          <p
            className={`text-sm ${
              report.blocked
                ? "text-error"
                : report.repaired.length > 0 || report.orphans.length > 0
                  ? "text-signal-orange"
                  : "text-secondary"
            }`}
          >
            {summarizeSync(report)}
          </p>

          {report.orphans.length > 0 && (
            <div className="mt-3">
              <p className="font-label-bold text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
                Paid in Stripe, no order here
              </p>
              <ul className="space-y-1">
                {report.orphans.map((o) => (
                  <li key={o.sessionId} className="text-xs text-on-surface-variant">
                    <span className="text-white">
                      {formatMoney(o.amountCents, o.currency)}
                    </span>
                    {o.email ? ` · ${o.email}` : ""}
                    {o.paidAt ? ` · ${new Date(o.paidAt).toLocaleDateString()}` : ""}
                    <span className="ml-2 font-mono text-[11px] text-outline">
                      {o.reference || o.sessionId}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.problems.length > 0 && (
            <ul className="mt-3 space-y-1">
              {report.problems.map((p) => (
                <li key={p} className="text-xs text-error/90">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
