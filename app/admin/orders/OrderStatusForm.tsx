"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateOrderStatus, type OrderUpdateState } from "../actions";
import { ALL_STAGES, STAGE_COPY, type FulfillmentStage } from "@/lib/fulfillment";

const ORDER_STATUSES = ["pending", "paid", "fulfilled", "cancelled", "refunded"];

function SaveButton({ compact }: { compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        compact
          ? "text-secondary text-xs font-label-bold uppercase tracking-widest hover:underline disabled:opacity-40"
          : "bg-secondary text-on-secondary-fixed px-5 py-2 rounded font-label-bold uppercase tracking-widest text-sm hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
      }
    >
      {pending ? "Saving…" : compact ? "Save" : "Update order"}
    </button>
  );
}

/**
 * Feedback line. The whole reason this component exists as a client component:
 * the previous server-action form gave no signal at all, so a rejected write
 * was indistinguishable from a successful one and the control looked broken.
 */
function Result({ state }: { state: OrderUpdateState }) {
  const { pending } = useFormStatus();
  if (pending) return null;
  if (state.error) {
    return <p className="text-error text-xs mt-2 max-w-md">{state.error}</p>;
  }
  if (state.ok) {
    return <p className="text-secondary text-xs mt-2 max-w-md">{state.message}</p>;
  }
  return null;
}

const select =
  "bg-surface-container-highest border border-white/10 text-white rounded px-3 py-2 focus:border-secondary focus:ring-0";
const input =
  "w-full bg-surface-container-highest border border-white/10 text-white rounded px-3 py-2 focus:border-secondary focus:ring-0";
const lbl =
  "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

/** Compact status-only control, used in the orders table. */
export function OrderStatusQuickForm({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const [state, action] = useActionState<OrderUpdateState, FormData>(
    updateOrderStatus,
    {}
  );
  return (
    <form action={action}>
      <div className="flex items-center gap-2">
        <input type="hidden" name="id" value={orderId} />
        <select
          name="status"
          defaultValue={status}
          className={`${select} text-sm px-2 py-1`}
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <SaveButton compact />
      </div>
      <Result state={state} />
    </form>
  );
}

/**
 * Full control on the order detail page: payment status, delivery stage and
 * tracking details in one save.
 */
export function OrderManageForm({
  orderId,
  status,
  stage,
  trackingNumber,
  courier,
}: {
  orderId: string;
  status: string;
  stage: FulfillmentStage;
  trackingNumber: string | null;
  courier: string | null;
}) {
  const [state, action] = useActionState<OrderUpdateState, FormData>(
    updateOrderStatus,
    {}
  );
  return (
    <form
      action={action}
      className="bg-surface-container border border-white/10 rounded-lg p-6 space-y-4"
    >
      <input type="hidden" name="id" value={orderId} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Payment status</label>
          <select name="status" defaultValue={status} className={`${select} w-full`}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Setting this to <strong className="text-white">paid</strong> starts the
            delivery schedule and emails the customer.
          </p>
        </div>

        <div>
          <label className={lbl}>Delivery stage</label>
          <select name="stage" defaultValue={stage} className={`${select} w-full`}>
            {ALL_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_COPY[s].label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Moves the customer&apos;s tracker forward ahead of schedule.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Tracking number</label>
          <input
            name="tracking_number"
            defaultValue={trackingNumber ?? ""}
            placeholder="1Z999AA10123456784"
            className={input}
          />
        </div>
        <div>
          <label className={lbl}>Courier</label>
          <input
            name="courier"
            defaultValue={courier ?? ""}
            placeholder="DHL Express"
            className={input}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-on-surface-variant">
        {/* An unchecked checkbox submits nothing, so this hidden field is what
            tells the action the control exists and the admin opted out. */}
        <input type="hidden" name="notify" value="off" />
        <input
          type="checkbox"
          name="notify"
          value="on"
          defaultChecked
          className="rounded border-white/20 bg-surface-container-highest text-secondary focus:ring-0"
        />
        Email the customer about a stage change
      </label>

      <div>
        <SaveButton />
        <Result state={state} />
      </div>
    </form>
  );
}
