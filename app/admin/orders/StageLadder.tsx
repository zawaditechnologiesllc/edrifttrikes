import {
  STAGE_COPY,
  TRACKER_STAGES,
  addDays,
  stageOffsetDays,
  type FulfillmentStage,
} from "@/lib/fulfillment";
import type { Order, OrderEvent } from "@/lib/types";
import { Icon } from "@/components/Icon";

/**
 * THE SAME LADDER THE CUSTOMER SEES, from the inside.
 *
 * The admin already had a timeline, but it only listed what had happened —
 * which answers "what did we send" and not the question actually being asked
 * when someone opens an order: *where is this, and what happens next?* Showing
 * the whole rail answers both, and it means the admin and the buyer are looking
 * at one story rather than two.
 *
 * What it adds over the customer's view, because this side needs it:
 *  - whether each step actually emailed (a step recorded but not emailed is the
 *    signature of a mail failure, and is worth being able to see)
 *  - the date each remaining step is DUE, projected from paid_at, so "should
 *    this have moved by now?" is answerable without arithmetic.
 */

const day = (value: string | Date) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function StageLadder({
  order,
  events,
}: {
  order: Pick<Order, "fulfillment_stage" | "paid_at" | "status">;
  events: OrderEvent[];
}) {
  const stage = (order.fulfillment_stage ?? "awaiting_payment") as FulfillmentStage;

  // Cancelled orders have left the rail; drawing eight hopeful steps for one is
  // misleading. Awaiting payment hasn't joined it yet.
  if (stage === "cancelled" || stage === "awaiting_payment") {
    return (
      <div>
        <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-2">
          Delivery journey
        </h3>
        <p className="text-on-surface-variant text-sm">
          {stage === "cancelled"
            ? "Cancelled — the scheduler will not touch this order again."
            : "Not started. Set the payment status to paid to begin the journey."}
        </p>
      </div>
    );
  }

  const done = new Map(events.map((e) => [e.stage, e] as const));
  const currentIndex = Math.max(0, TRACKER_STAGES.indexOf(stage));

  return (
    <div>
      <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant mb-3">
        Delivery journey
      </h3>
      <ol>
        {TRACKER_STAGES.map((s, i) => {
          const event = done.get(s);
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isLast = i === TRACKER_STAGES.length - 1;

          // Projected date for a step that hasn't happened. `delivered` has no
          // offset — a clock cannot know a parcel arrived — so it gets none.
          const offset = stageOffsetDays(s);
          const dueAt =
            !event && offset !== null && order.paid_at
              ? addDays(order.paid_at, offset)
              : null;

          return (
            <li key={s} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    isDone
                      ? "border-secondary bg-secondary text-on-secondary-fixed"
                      : isCurrent
                        ? "border-secondary text-secondary"
                        : "border-white/15 text-transparent",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isDone ? (
                    <Icon name="check" className="h-3 w-3" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                {!isLast && (
                  <span
                    className={`w-0.5 flex-1 ${isDone ? "bg-secondary" : "bg-white/10"}`}
                  />
                )}
              </div>

              <div className={`min-w-0 ${isLast ? "" : "pb-4"}`}>
                <p
                  className={`text-sm ${
                    isDone || isCurrent ? "text-white" : "text-on-surface-variant"
                  }`}
                >
                  {STAGE_COPY[s].label}
                  {isCurrent && (
                    <span className="ml-2 text-secondary text-[10px] font-label-bold uppercase tracking-widest">
                      Now
                    </span>
                  )}
                </p>
                {event ? (
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    {day(event.created_at)}
                    {event.email_sent ? (
                      " · emailed"
                    ) : (
                      // Recorded but not emailed. Worth flagging rather than
                      // leaving blank: it usually means a send failed.
                      <span className="text-error"> · not emailed</span>
                    )}
                  </p>
                ) : dueAt ? (
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    Due {day(dueAt)}
                  </p>
                ) : (
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    Set by hand when the courier confirms
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {order.status !== "paid" && (
        <p className="text-on-surface-variant text-xs mt-2">
          The scheduler only advances orders marked <strong>paid</strong>.
        </p>
      )}
    </div>
  );
}
