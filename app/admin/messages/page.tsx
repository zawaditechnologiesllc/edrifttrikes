export const dynamic = "force-dynamic";

import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { Icon } from "@/components/Icon";
import ReplyForm from "./ReplyForm";
import { toggleMessageHandled } from "./actions";
import type { ContactMessage } from "@/lib/types";

export const metadata = { title: "Messages" };

/**
 * SUPPORT INBOX — everything sent through the Contact form on /support.
 *
 * Messages are written by lib/actions/contact.ts at submission time, so this
 * inbox is the record even when the notification email goes astray. Replying
 * here emails the customer directly.
 */

function when(value: string): string {
  const d = new Date(value);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.round(mins / (60 * 24))}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminMessages({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }

  const { filter } = await searchParamsPromise;
  const showHandled = filter === "all";

  const admin = createAdminClient();
  let query = admin.from("contact_messages").select("*");
  if (!showHandled) query = query.eq("handled", false);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="p-8">
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mb-4">
          Messages
        </h1>
        <p className="text-error max-w-xl">Could not load messages: {error.message}</p>
        <p className="text-on-surface-variant text-sm mt-2 max-w-xl">
          Run{" "}
          <code className="text-secondary">supabase/migrations/0002_contact.sql</code>{" "}
          and{" "}
          <code className="text-secondary">
            supabase/migrations/0007_paid_source_and_replies.sql
          </code>{" "}
          in the Supabase SQL editor.
        </p>
      </div>
    );
  }

  const messages = (data ?? []) as ContactMessage[];
  const unreadCount = messages.filter((m) => !m.handled).length;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display-lg text-display-lg-mobile text-white uppercase">
            Messages
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 max-w-xl">
            Sent through the contact form on{" "}
            <span className="text-white">/support</span>. Replying here emails the
            customer directly.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/messages"
            className={`rounded px-4 py-2 text-xs font-label-bold uppercase tracking-widest border transition-colors ${
              !showHandled
                ? "bg-secondary text-on-secondary-fixed border-secondary"
                : "border-white/10 text-on-surface-variant hover:text-white hover:bg-white/5"
            }`}
          >
            Unanswered{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </a>
          <a
            href="/admin/messages?filter=all"
            className={`rounded px-4 py-2 text-xs font-label-bold uppercase tracking-widest border transition-colors ${
              showHandled
                ? "bg-secondary text-on-secondary-fixed border-secondary"
                : "border-white/10 text-on-surface-variant hover:text-white hover:bg-white/5"
            }`}
          >
            All
          </a>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-lg py-20 text-center">
          <Icon name="mail" className="w-10 h-10 text-outline mx-auto" />
          <p className="text-on-surface-variant uppercase tracking-widest font-label-bold mt-4">
            {showHandled ? "No messages yet" : "Nothing unanswered"}
          </p>
          {!showHandled && (
            <a
              href="/admin/messages?filter=all"
              className="inline-block mt-3 text-secondary text-sm font-label-bold uppercase tracking-widest hover:underline"
            >
              View all messages →
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {messages.map((m) => (
            <article
              key={m.id}
              className={`bg-surface-container border rounded-lg p-6 ${
                m.handled ? "border-white/10" : "border-secondary/40"
              }`}
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div className="min-w-0">
                  <p className="font-headline-md text-white text-lg break-words">
                    {m.subject || "(no subject)"}
                  </p>
                  <p className="text-on-surface-variant text-sm mt-1 break-all">
                    {m.name ? `${m.name} · ` : ""}
                    <a href={`mailto:${m.email}`} className="hover:text-secondary">
                      {m.email}
                    </a>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-on-surface-variant text-xs">{when(m.created_at)}</p>
                  <span
                    className={`inline-block mt-2 rounded border px-2 py-0.5 text-[10px] font-label-bold uppercase tracking-widest ${
                      m.handled
                        ? "border-white/10 text-on-surface-variant"
                        : "border-secondary/40 bg-secondary/10 text-secondary"
                    }`}
                  >
                    {m.replied_at ? "Replied" : m.handled ? "Handled" : "New"}
                  </span>
                </div>
              </header>

              <p className="text-on-surface-variant text-sm leading-relaxed whitespace-pre-wrap mt-4">
                {m.message}
              </p>

              {m.reply_body && (
                <div className="mt-5 border-l-2 border-secondary/40 pl-4">
                  <p className="text-[10px] font-label-bold uppercase tracking-widest text-secondary">
                    Your reply{m.replied_at ? ` · ${when(m.replied_at)}` : ""}
                  </p>
                  <p className="text-on-surface-variant text-sm leading-relaxed whitespace-pre-wrap mt-2">
                    {m.reply_body}
                  </p>
                </div>
              )}

              <ReplyForm
                messageId={m.id}
                email={m.email}
                hasReply={Boolean(m.reply_body)}
              />

              <form action={toggleMessageHandled} className="mt-3">
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="handled" value={String(m.handled)} />
                <button className="text-on-surface-variant hover:text-white text-xs font-label-bold uppercase tracking-widest">
                  {m.handled ? "Reopen" : "Mark handled without replying"}
                </button>
              </form>
            </article>
          ))}
        </div>
      )}

      {messages.length === 200 && (
        <p className="text-on-surface-variant text-xs mt-4">
          Showing the 200 most recent messages.
        </p>
      )}
    </div>
  );
}
