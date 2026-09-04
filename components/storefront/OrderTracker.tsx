import {
  STAGE_COPY,
  TRACKER_STAGES,
  formatDeliveryDate,
  stageMessage,
  type FulfillmentStage,
} from "@/lib/fulfillment";
import type { Order } from "@/lib/types";
import { Icon } from "@/components/Icon";

/**
 * Customer-facing delivery tracker — the timeline a rider sees on their
 * dashboard and on the order receipt once payment has cleared.
 *
 * Reads its copy from STAGE_COPY, the same source the emails use, so what a
 * customer is told in their inbox and what they see here can never disagree.
 */

function StageRow({
  stage,
  state,
  at,
  isLast,
}: {
  stage: FulfillmentStage;
  state: "done" | "current" | "upcoming";
  at?: string | null;
  isLast: boolean;
}) {
  const done = state === "done";
  const current = state === "current";

  return (
    <li className="flex gap-4">
      {/* Rail: a filled marker for reached stages, hollow for what's ahead. */}
      <div className="flex flex-col items-center">
        <span
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            done
              ? "border-secondary bg-secondary text-on-secondary-fixed"
              : current
                ? "border-secondary bg-transparent text-secondary"
                : "border-white/15 bg-transparent text-transparent",
          ].join(" ")}
          aria-hidden="true"
        >
          {done ? (
            <Icon name="check" className="h-4 w-4" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-current" />
          )}
        </span>
        {/* Connector to the next marker. Driven by an explicit prop, not a
            `last:` variant — this span is always the last child of its own
            wrapper, so a variant would hide it on every row. */}
        {!isLast && (
          <span className={`w-0.5 flex-1 ${done ? "bg-secondary" : "bg-white/10"}`} />
        )}
      </div>

      {/* Row spacing, from the same prop the connector uses. NOT a `last:`
          variant: this div is always the last child of its own <li>, so
          `last:pb-0` would zero the padding on every row and collapse the rail
          into a cramped stack. */}
      <div className={isLast ? "" : "pb-6"}>
        <p
          className={`font-label-bold uppercase tracking-widest text-sm ${
            done || current ? "text-white" : "text-on-surface-variant"
          }`}
        >
          {STAGE_COPY[stage].label}
        </p>
        {current && (
          <p className="text-on-surface-variant text-sm mt-1 max-w-prose">
            {STAGE_COPY[stage].title}
          </p>
        )}
        {at && (
          <p className="text-on-surface-variant text-xs mt-1">
            {new Date(at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </li>
  );
}

export default function OrderTracker({ order }: { order: Order }) {
  const stage = (order.fulfillment_stage ?? "awaiting_payment") as FulfillmentStage;

  // Nothing to track until payment clears — showing an empty rail to someone
  // whose order is still pending only raises questions.
  if (!order.paid_at || stage === "awaiting_payment") {
    return (
      <div className="rounded-lg border border-dashed border-white/10 p-5">
        <p className="font-label-bold uppercase tracking-widest text-xs text-on-surface-variant">
          Tracking
        </p>
        <p className="text-on-surface-variant text-sm mt-2">
          {STAGE_COPY.awaiting_payment.message} Tracking opens as soon as it does.
        </p>
      </div>
    );
  }

  if (stage === "cancelled") {
    return (
      <div className="rounded-lg border border-error/40 bg-error/5 p-5">
        <p className="font-label-bold uppercase tracking-widest text-xs text-error">
          Cancelled
        </p>
        <p className="text-on-surface-variant text-sm mt-2">
          {STAGE_COPY.cancelled.message}
        </p>
      </div>
    );
  }

  const isDelivered = stage === "delivered";
  // Indexed against the RAIL, not the schedule: the rail ends with `delivered`,
  // which is not on the schedule because a clock cannot know a parcel arrived.
  // A stage missing from the rail (only `cancelled`, handled above) would give
  // -1, which would light nothing — so it falls back to the first node.
  const currentIndex = Math.max(0, TRACKER_STAGES.indexOf(stage));

  // When did each stage happen? From the event timeline where we have it.
  const eventAt = new Map(
    (order.events ?? []).map((e) => [e.stage, e.created_at] as const)
  );

  return (
    <div className="rounded-lg border border-white/10 bg-surface-container-low p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p className="font-label-bold uppercase tracking-widest text-xs text-secondary">
            {isDelivered ? "Delivered" : "Tracking"}
          </p>
          <p className="font-headline-md text-white text-lg mt-1">
            {STAGE_COPY[stage].title}
          </p>
        </div>
        {!isDelivered && order.estimated_delivery_at && (
          <div className="text-right">
            <p className="font-label-bold uppercase tracking-widest text-[10px] text-on-surface-variant">
              Estimated delivery
            </p>
            <p className="text-white text-sm mt-1">
              {formatDeliveryDate(order.estimated_delivery_at)}
            </p>
          </div>
        )}
      </div>

      <p className="text-on-surface-variant text-sm leading-relaxed max-w-prose mb-6">
        {stageMessage(stage, order.estimated_delivery_at)}
      </p>

      {order.tracking_number && (
        <div className="mb-6 rounded border border-white/10 bg-surface-container px-4 py-3">
          <p className="font-label-bold uppercase tracking-widest text-[10px] text-on-surface-variant">
            Tracking number
          </p>
          <p className="text-white text-sm mt-1 break-all">
            {order.tracking_number}
            {order.courier && (
              <span className="text-on-surface-variant"> · {order.courier}</span>
            )}
          </p>
        </div>
      )}

      <ol>
        {TRACKER_STAGES.map((s, i) => (
          <StageRow
            key={s}
            stage={s}
            isLast={i === TRACKER_STAGES.length - 1}
            state={
              i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming"
            }
            at={eventAt.get(s) ?? null}
          />
        ))}
      </ol>
    </div>
  );
}
