"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { inviteOrderCustomer, type InviteState } from "../actions";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-primary-container text-white px-4 py-3 rounded font-label-bold uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
    >
      {pending ? "Sending…" : "Connect order to customer"}
    </button>
  );
}

function Result({ state }: { state: InviteState }) {
  const { pending } = useFormStatus();
  if (pending) return null;
  if (state.error) return <p className="text-error text-xs mt-2">{state.error}</p>;
  if (!state.ok) return null;
  return (
    <div className="mt-2">
      <p className="text-secondary text-xs">{state.message}</p>
      {state.actionLink && (
        // Only rendered when the email failed — the link is still valid, so
        // give the admin something to pass on rather than losing it.
        <p className="mt-2 break-all rounded border border-white/10 bg-surface-container-highest p-2 text-[11px] text-on-surface-variant">
          {state.actionLink}
        </p>
      )}
    </div>
  );
}

/**
 * Guest orders have no account behind them. This offers the admin one action:
 * connect the order to the customer.
 *
 * What that does depends on whether an account already exists for the order's
 * email — link it, or email a sign-up invite. The action decides; the button
 * says the same thing either way because from the admin's point of view the
 * intent is identical.
 */
export default function ConnectAccountForm({
  orderId,
  email,
}: {
  orderId: string;
  email: string;
}) {
  const [state, action] = useActionState<InviteState, FormData>(
    inviteOrderCustomer,
    {}
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={orderId} />
      <p className="text-on-surface-variant text-xs mb-2 leading-relaxed">
        No account is linked to this order. Connecting it emails{" "}
        <span className="text-white break-all">{email}</span> a sign-up link — once
        they register, this order and every delivery update appear on their
        dashboard.
      </p>
      <SendButton />
      <Result state={state} />
    </form>
  );
}
