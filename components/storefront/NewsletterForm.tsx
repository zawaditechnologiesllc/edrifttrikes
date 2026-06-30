"use client";

import { useFormState, useFormStatus } from "react-dom";
import { subscribeNewsletter } from "@/lib/actions/newsletter";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-secondary text-on-secondary-fixed px-5 font-label-bold text-label-bold uppercase tracking-widest rounded hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
    >
      {pending ? "..." : "Join"}
    </button>
  );
}

export default function NewsletterForm() {
  const [state, formAction] = useFormState(subscribeNewsletter, {});
  if (state.ok)
    return (
      <p className="text-secondary font-label-bold text-label-bold uppercase tracking-widest">
        ✓ You're on the drop list.
      </p>
    );
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="EMAIL FOR DROPS"
          className="flex-1 bg-surface-container border border-white/10 rounded px-4 py-3 text-white placeholder:text-outline focus:border-secondary focus:ring-0 text-sm"
        />
        <SubmitBtn />
      </div>
      {state.error && <p className="text-error text-xs">{state.error}</p>}
    </form>
  );
}
