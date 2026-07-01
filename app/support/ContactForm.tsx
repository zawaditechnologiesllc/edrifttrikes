"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitContact } from "@/lib/actions/contact";
import { Icon } from "@/components/Icon";

const input = "w-full bg-surface-container border border-white/10 text-white p-4 rounded focus:border-secondary focus:ring-0";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
      {pending ? "Sending…" : "Send message"}
    </button>
  );
}

export default function ContactForm() {
  const [state, action] = useFormState(submitContact, {});
  if (state.ok)
    return (
      <div className="bg-surface-container border border-secondary/30 rounded-lg p-8 text-center">
        <Icon name="mark_email_read" className="w-12 h-12 text-secondary" />
        <p className="text-white font-headline-md text-xl uppercase mt-3">Message sent</p>
        <p className="text-on-surface-variant mt-1">The garage crew will reply within one business day.</p>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input name="name" placeholder="Name" className={input} />
        <input name="email" type="email" required placeholder="Email" className={input} />
      </div>
      <input name="subject" placeholder="Subject" className={input} />
      <textarea name="message" required rows={5} placeholder="How can we help?" className={input} />
      {state.error && <p className="text-error font-label-bold text-sm">{state.error}</p>}
      <Submit />
    </form>
  );
}
