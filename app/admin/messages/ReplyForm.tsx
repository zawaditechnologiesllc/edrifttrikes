"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { replyToMessage, type ReplyState } from "./actions";

function SendButton({ hasReply }: { hasReply: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-secondary text-on-secondary-fixed px-6 py-3 rounded font-label-bold uppercase tracking-widest text-sm hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
    >
      {pending ? "Sending…" : hasReply ? "Send another reply" : "Send reply"}
    </button>
  );
}

function Result({ state }: { state: ReplyState }) {
  const { pending } = useFormStatus();
  if (pending) return null;
  if (state.error) return <p className="text-error text-sm">{state.error}</p>;
  if (state.ok) return <p className="text-secondary text-sm">{state.message}</p>;
  return null;
}

/**
 * Reply box on a support message. Client component so the admin gets a sending
 * state and the real outcome — a support reply that silently failed to send is
 * a customer who thinks they were ignored.
 */
export default function ReplyForm({
  messageId,
  email,
  hasReply,
}: {
  messageId: string;
  email: string;
  hasReply: boolean;
}) {
  const [state, action] = useActionState<ReplyState, FormData>(replyToMessage, {});

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={messageId} />
      <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase tracking-widest">
        Reply to {email}
      </label>
      <textarea
        name="reply"
        rows={5}
        required
        placeholder="Type your reply — it's emailed to the customer with their original message quoted underneath."
        className="w-full bg-surface-container-highest border border-white/10 text-white p-3 rounded focus:border-secondary focus:ring-0 resize-y"
      />
      <div className="flex flex-wrap items-center gap-4">
        <SendButton hasReply={hasReply} />
        <Result state={state} />
      </div>
    </form>
  );
}
