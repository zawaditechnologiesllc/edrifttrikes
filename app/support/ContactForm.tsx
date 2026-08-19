"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitContact, type ContactState } from "@/lib/actions/contact";
import { Icon } from "@/components/Icon";
import Turnstile from "@/components/Turnstile";
import { formatCountdown } from "@/lib/rate-limit";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

const input =
  "w-full bg-surface-container border border-white/10 text-white p-4 rounded focus:border-secondary focus:ring-0";

function Submit({ cooldown }: { cooldown: number }) {
  const { pending } = useFormStatus();
  const blocked = cooldown > 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={pending || blocked}
        className="bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        {pending
          ? "Sending…"
          : blocked
            ? `Wait ${formatCountdown(cooldown)}`
            : "Send message"}
      </button>
      {blocked && !pending && (
        <p className="text-on-surface-variant text-sm" aria-live="polite">
          You can send another message in{" "}
          <span className="text-secondary font-label-bold">
            {formatCountdown(cooldown)}
          </span>
          .
        </p>
      )}
    </div>
  );
}

export default function ContactForm() {
  const [state, action] = useActionState<ContactState, FormData>(submitContact, {});

  // Live countdown. Seeded from whatever the SERVER said — after a successful
  // send, and also after a rejected one, so someone who reloads or opens a new
  // tab still sees the real remaining time rather than a fresh enabled button.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (state.retryAfterSeconds) setCooldown(state.retryAfterSeconds);
  }, [state]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (state.ok)
    return (
      <div className="bg-surface-container border border-secondary/30 rounded-lg p-8 text-center">
        <Icon name="mark_email_read" className="w-12 h-12 text-secondary" />
        <p className="text-white font-headline-md text-xl uppercase mt-3">Message sent</p>
        <p className="text-on-surface-variant mt-1">
          The garage crew will reply within one business day.
        </p>
        {cooldown > 0 && (
          <p className="text-outline text-sm mt-4" aria-live="polite">
            You can send another message in {formatCountdown(cooldown)}.
          </p>
        )}
      </div>
    );

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input name="name" placeholder="Your name" className={input} />
        <input
          name="email"
          type="email"
          required
          placeholder="Your email address"
          className={input}
        />
      </div>
      <input name="subject" placeholder="What is this about?" className={input} />
      <textarea
        name="message"
        required
        rows={5}
        placeholder="How can we help?"
        className={input}
      />
      <Turnstile siteKey={TURNSTILE_SITE_KEY} />
      {state.error && (
        <p className="text-error text-sm" role="alert">
          {state.error}
        </p>
      )}
      <Submit cooldown={cooldown} />
    </form>
  );
}
