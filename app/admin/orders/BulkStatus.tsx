"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateOrderStatus } from "../actions";
import {
  BULK_CHUNK,
  ORDER_STATUSES,
  STATUS_EFFECT,
  chunkIds,
  summarize,
  type OrderStatus,
  type StatusOutcome,
} from "@/lib/order-status";

/**
 * Selecting orders and changing all of them at once.
 *
 * ═══ WHY THE BROWSER DRIVES THE LOOP ═══════════════════════════════════════
 *
 * Because a Worker request on Cloudflare's free plan gets 50 subrequests and
 * one status change costs about seven. A single action over forty orders would
 * run out partway through — some customers emailed, some not, nothing saying
 * which. So the server takes BULK_CHUNK at a time and this component calls it
 * repeatedly.
 *
 * That constraint turns out to be the better design anyway: the admin gets a
 * progress count, a Stop button, and a per-order report rather than one
 * unverifiable "40 updated".
 *
 * ⚠️ AN EMAIL CANNOT BE UNSENT, which is why Apply asks first and says how
 * many people will receive what. Everything else in this admin is reversible;
 * this is not.
 */

type Selection = {
  selected: Set<string>;
  allIds: string[];
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  /** Narrow the selection to exactly these — what a stopped run leaves behind. */
  keepOnly: (ids: string[]) => void;
  isSelected: (id: string) => boolean;
  running: boolean;
};

const Ctx = createContext<Selection | null>(null);

function useSelection(): Selection {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Order selection used outside its provider");
  return ctx;
}

/** Holds the selection. The table rows are server-rendered children. */
export function BulkSelectionProvider({
  allIds,
  children,
}: {
  allIds: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [running, setRunning] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (on: boolean) => setSelected(on ? new Set(allIds) : new Set()),
    [allIds]
  );

  const keepOnly = useCallback((ids: string[]) => setSelected(new Set(ids)), []);

  const value = useMemo<Selection>(
    () => ({
      selected,
      allIds,
      toggle,
      setAll,
      keepOnly,
      isSelected: (id) => selected.has(id),
      running,
    }),
    [selected, allIds, toggle, setAll, keepOnly, running]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <BulkStatusBar onRunningChange={setRunning} />
    </Ctx.Provider>
  );
}

const box =
  "rounded border-white/25 bg-surface-container-highest text-secondary focus:ring-1 focus:ring-secondary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40";

/** Header checkbox: everything on this page. */
export function SelectAllCheckbox() {
  const { selected, allIds, setAll, running } = useSelection();
  const all = allIds.length > 0 && selected.size >= allIds.length;
  const some = selected.size > 0 && !all;
  return (
    <input
      type="checkbox"
      className={box}
      checked={all}
      disabled={running || allIds.length === 0}
      // The dash state matters: with 200 rows a half-filled selection must not
      // look like an empty one.
      ref={(el) => {
        if (el) el.indeterminate = some;
      }}
      onChange={(e) => setAll(e.target.checked)}
      aria-label={all ? "Clear selection" : "Select every order on this page"}
    />
  );
}

/** One row's checkbox. */
export function RowCheckbox({ id, label }: { id: string; label?: string }) {
  const { isSelected, toggle, running } = useSelection();
  return (
    <input
      type="checkbox"
      className={box}
      checked={isSelected(id)}
      disabled={running}
      onChange={() => toggle(id)}
      aria-label={label ? `Select order ${label}` : "Select order"}
    />
  );
}

const select =
  "bg-surface-container-highest border border-white/15 text-white rounded px-3 py-2 text-sm focus:border-secondary focus:ring-0";

function Row({ o }: { o: StatusOutcome }) {
  const name = o.orderNumber ?? o.orderId.slice(0, 8);
  const tone = o.error
    ? "text-error"
    : o.emailError
      ? "text-signal-orange"
      : o.changed
        ? "text-secondary"
        : "text-on-surface-variant";
  const what = o.error
    ? o.error
    : o.skipped === "already_in_status"
      ? `already ${o.to} — left alone`
      : [
          `→ ${o.to}`,
          o.emailed ? `emailed ${o.customerEmail ?? ""}`.trim() : "no email",
          ...o.notes,
          o.emailError ? `EMAIL FAILED: ${o.emailError}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
  return (
    <li className={`${tone} flex flex-wrap gap-x-2 py-1 border-b border-white/5 last:border-0`}>
      <span className="font-label-bold">{name}</span>
      <span className="text-on-surface-variant">{what}</span>
    </li>
  );
}

function BulkStatusBar({ onRunningChange }: { onRunningChange: (on: boolean) => void }) {
  const { selected, setAll, keepOnly } = useSelection();
  const router = useRouter();

  const [status, setStatus] = useState<OrderStatus>("fulfilled");
  const [notify, setNotify] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(0);
  const [outcomes, setOutcomes] = useState<StatusOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref, not state: the loop reads it between chunks and must see the
  // current value, not the one captured when the run started.
  const stop = useRef(false);

  const count = selected.size;
  const effect = STATUS_EFFECT[status];

  const setRunning = (on: boolean) => {
    setBusy(on);
    onRunningChange(on);
  };

  async function run() {
    setConfirming(false);
    setError(null);
    setOutcomes([]);
    setDone(0);
    stop.current = false;
    setRunning(true);

    const collected: StatusOutcome[] = [];
    try {
      for (const chunk of chunkIds(Array.from(selected))) {
        if (stop.current) break;
        const res = await bulkUpdateOrderStatus({ ids: chunk, status, notify });
        if (res.error) {
          setError(res.error);
          break;
        }
        collected.push(...res.outcomes);
        setOutcomes([...collected]);
        setDone(collected.length);
      }
    } catch (e) {
      // A dropped request mid-run must not look like nothing happened: the
      // orders already reported ARE saved.
      setError(
        `${e instanceof Error ? e.message : String(e)} — the ${collected.length} order${
          collected.length === 1 ? "" : "s"
        } listed below were saved before this.`
      );
    } finally {
      setRunning(false);
      /*
       * ONLY THE PROCESSED ORDERS ARE DESELECTED. Clearing everything after a
       * run that stopped — or that died halfway — would lose the admin's place
       * and leave them re-ticking rows by hand to finish the job. What is left
       * selected is exactly what still needs doing, so Apply again continues.
       */
      const handled = new Set(collected.map((o) => o.orderId));
      keepOnly(Array.from(selected).filter((id) => !handled.has(id)));
      router.refresh();
    }
  }

  if (count === 0 && !outcomes && !error) return null;

  const summary = outcomes ? summarize(outcomes) : null;

  return (
    <section
      // Named, so a screen reader announces what this strip is when it
      // appears — it arrives unprompted, on selection, rather than by
      // navigation.
      aria-label="Bulk status change"
      className="sticky bottom-0 z-20 mt-4 bg-surface-container-high border border-secondary/40 rounded-lg shadow-2xl"
    >
      <div className="p-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="font-label-bold text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
            Selected
          </p>
          <p className="font-headline-md text-xl text-white">{count}</p>
        </div>

        <div>
          <label
            htmlFor="bulk-status"
            className="block font-label-bold text-[10px] uppercase tracking-widest text-on-surface-variant mb-1"
          >
            Change status to
          </label>
          <select
            id="bulk-status"
            value={status}
            disabled={busy}
            onChange={(e) => {
              setStatus(e.target.value as OrderStatus);
              setConfirming(false);
            }}
            className={select}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_EFFECT[s].label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-on-surface-variant pb-2">
          <input
            type="checkbox"
            className={box}
            checked={notify}
            disabled={busy}
            onChange={(e) => {
              setNotify(e.target.checked);
              setConfirming(false);
            }}
          />
          Email the customers
        </label>

        <div className="ml-auto flex items-center gap-3 pb-1">
          {busy ? (
            <>
              <span className="text-secondary text-sm font-label-bold">
                {done} / {count}
              </span>
              <button
                type="button"
                onClick={() => {
                  stop.current = true;
                }}
                className="border border-white/25 text-white px-4 py-2 rounded text-xs font-label-bold uppercase tracking-widest hover:bg-white/5"
              >
                Stop
              </button>
            </>
          ) : confirming ? (
            <>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="border border-white/25 text-on-surface-variant px-4 py-2 rounded text-xs font-label-bold uppercase tracking-widest hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                className="bg-secondary text-on-secondary-fixed px-5 py-2 rounded text-xs font-label-bold uppercase tracking-widest hover:brightness-105 active:scale-95"
              >
                Yes — apply to {count}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAll(false)}
                disabled={count === 0}
                className="text-on-surface-variant hover:text-white px-2 py-2 text-xs font-label-bold uppercase tracking-widest disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={count === 0}
                className="bg-secondary text-on-secondary-fixed px-5 py-2 rounded text-xs font-label-bold uppercase tracking-widest hover:brightness-105 active:scale-95 disabled:opacity-40"
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {/*
        WHAT IS ABOUT TO HAPPEN, BEFORE IT HAPPENS. An email cannot be
        recalled, so the number of people and the subject they will read are
        both on screen before the second click.
      */}
      {confirming && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-white text-sm">
            {count} order{count === 1 ? "" : "s"} → <strong>{effect.label}</strong>.{" "}
            {notify && effect.email ? (
              <>
                {count} customer{count === 1 ? "" : "s"} will receive an email titled{" "}
                <strong>&ldquo;{effect.email}&rdquo;</strong>.
              </>
            ) : (
              <span className="text-on-surface-variant">No email will be sent.</span>
            )}
          </p>
          <p className="text-on-surface-variant text-xs max-w-3xl">{effect.note}</p>
          {/* The one genuinely dangerous combination, named. */}
          {notify && status === "pending" && (
            <p className="text-signal-orange text-xs max-w-3xl">
              These customers will be told their payment is outstanding. If you
              are correcting a mistake on orders that were already paid, untick
              &ldquo;Email the customers&rdquo; first.
            </p>
          )}
          {status === "refunded" && (
            <p className="text-signal-orange text-xs max-w-3xl">
              This records the refund and tells the customer. It does NOT move
              money — refund each payment in the gateway that took it.
            </p>
          )}
          <p className="text-outline text-xs">
            Sent {BULK_CHUNK} at a time, with a pause between emails so none is
            rate-limited. You can stop partway through.
          </p>
        </div>
      )}

      {error && (
        <p className="mx-4 mb-4 bg-error/10 border border-error/40 rounded px-3 py-2 text-error text-sm">
          {error}
        </p>
      )}

      {/* Every order, including the ones nothing happened to. */}
      {outcomes && outcomes.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-sm text-white mb-2">
            {summary?.changed} changed
            {summary?.emailed ? `, ${summary.emailed} emailed` : ""}
            {summary?.alreadyThere ? `, ${summary.alreadyThere} already there` : ""}
            {summary?.emailsFailed ? `, ${summary.emailsFailed} emails failed` : ""}
            {summary?.failed ? `, ${summary.failed} failed` : ""}.
          </p>
          <ul className="max-h-48 overflow-y-auto text-xs">
            {outcomes.map((o) => (
              <Row key={o.orderId} o={o} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
