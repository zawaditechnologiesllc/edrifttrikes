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
import { bulkUpdateOrders, type BulkField } from "../actions";
import {
  BULK_CHUNK,
  BULK_STAGES,
  ORDER_STATUSES,
  STATUS_EFFECT,
  chunkIds,
  stageEffect,
  summarize,
  type AnyOutcome,
} from "@/lib/order-status";
import type { FulfillmentStage } from "@/lib/fulfillment";

/**
 * Selecting orders and changing all of them at once — their payment status or
 * their delivery stage.
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

/**
 * The two things a selection can be changed to, as one list.
 *
 * Kept together rather than as two controls because they are alternatives: an
 * admin is setting a status OR a stage, never both, and a bar with two Apply
 * buttons invites pressing the wrong one over forty orders.
 */
const FIELDS: { key: BulkField; label: string }[] = [
  { key: "status", label: "Payment status" },
  { key: "stage", label: "Delivery stage" },
];

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

/**
 * Notes that are true of several orders, lifted out of the rows.
 *
 * A warning like "the scheduler will not advance this further" is a property
 * of the batch, not of one order, and repeated down forty lines it is the
 * thing that stops the report being read at all — which defeats the point of
 * reporting every order.
 */
function sharedNotes(outcomes: AnyOutcome[]): string[] {
  const seen = new Map<string, number>();
  for (const o of outcomes) {
    for (const note of o.notes) seen.set(note, (seen.get(note) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([note]) => note);
}

function Row({ o, hide }: { o: AnyOutcome; hide: Set<string> }) {
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
    : o.skipped === "already_there"
      ? `already ${o.to} — left alone`
      : [
          `→ ${o.to}`,
          o.emailed ? `emailed ${o.customerEmail ?? ""}`.trim() : "no email",
          ...o.notes.filter((n) => !hide.has(n)),
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

  const [field, setField] = useState<BulkField>("status");
  // Two values, remembered separately: switching to Delivery stage to check
  // the wording and back again must not quietly leave a different status
  // selected than the one the admin had chosen.
  const [status, setStatus] = useState<string>("fulfilled");
  const [stage, setStage] = useState<string>("shipped");
  const [notify, setNotify] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(0);
  const [outcomes, setOutcomes] = useState<AnyOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref, not state: the loop reads it between chunks and must see the
  // current value, not the one captured when the run started.
  const stop = useRef(false);

  const count = selected.size;
  const value = field === "status" ? status : stage;
  const options =
    field === "status"
      ? ORDER_STATUSES.map((key) => ({ key, label: STATUS_EFFECT[key].label }))
      : BULK_STAGES.map((key) => ({ key, label: stageEffect(key).label }));
  const effect =
    field === "status"
      ? STATUS_EFFECT[status as keyof typeof STATUS_EFFECT]
      : stageEffect(stage as FulfillmentStage);

  /** Any change to what is about to happen invalidates the confirmation. */
  const choose = (next: () => void) => {
    next();
    setConfirming(false);
  };

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

    const collected: AnyOutcome[] = [];
    try {
      for (const chunk of chunkIds(Array.from(selected))) {
        if (stop.current) break;
        const res = await bulkUpdateOrders({ ids: chunk, field, value, notify });
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
  // Computed once, not per row: this list is re-rendered on every chunk.
  const shared = outcomes ? sharedNotes(outcomes) : [];
  const sharedSet = new Set(shared);

  return (
    <section
      // Named, so a screen reader announces what this strip is when it
      // appears — it arrives unprompted, on selection, rather than by
      // navigation.
      aria-label="Bulk change"
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
            htmlFor="bulk-field"
            className="block font-label-bold text-[10px] uppercase tracking-widest text-on-surface-variant mb-1"
          >
            Change
          </label>
          <select
            id="bulk-field"
            value={field}
            disabled={busy}
            onChange={(e) => choose(() => setField(e.target.value as BulkField))}
            className={select}
          >
            {FIELDS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="bulk-status"
            className="block font-label-bold text-[10px] uppercase tracking-widest text-on-surface-variant mb-1"
          >
            To
          </label>
          <select
            id="bulk-status"
            value={value}
            disabled={busy}
            onChange={(e) =>
              choose(() =>
                field === "status" ? setStatus(e.target.value) : setStage(e.target.value)
              )
            }
            className={select}
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
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
            onChange={(e) => choose(() => setNotify(e.target.checked))}
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
          {/*
            THE COMBINATIONS THAT GO WRONG QUIETLY, named before the click.
            Each of these is something an admin would only discover from a
            customer's reply, by which time forty of them have it.
          */}
          {notify && (value === "pending" || value === "awaiting_payment") && (
            <p className="text-signal-orange text-xs max-w-3xl">
              These customers will be told their payment is outstanding. If you
              are correcting a mistake on orders that were already paid, untick
              &ldquo;Email the customers&rdquo; first.
            </p>
          )}
          {value === "refunded" && (
            <p className="text-signal-orange text-xs max-w-3xl">
              This records the refund and tells the customer. It does NOT move
              money — refund each payment in the gateway that took it.
            </p>
          )}
          {field === "stage" && (
            <p className="text-outline text-xs max-w-3xl">
              Orders that are cancelled or refunded are skipped — telling
              someone their refunded order has shipped is the one thing this
              refuses to do. Setting a stage does not change the payment
              status.
            </p>
          )}
          {field === "stage" && value === "shipped" && (
            <p className="text-signal-orange text-xs max-w-3xl">
              The shipped email carries the tracking number. Any of these
              orders without one will go out saying the order has left the
              workshop with nothing for the customer to follow.
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
          {/* Said once, above the list, rather than forty times inside it. */}
          {shared.map((note) => (
            <p key={note} className="text-on-surface-variant text-xs mb-2 max-w-3xl">
              {note}
            </p>
          ))}
          <ul className="max-h-48 overflow-y-auto text-xs">
            {outcomes.map((o) => (
              <Row key={o.orderId} o={o} hide={sharedSet} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
