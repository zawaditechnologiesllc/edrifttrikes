"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveAnnouncement,
  deleteAnnouncement,
  toggleAnnouncement,
  type AnnouncementState,
} from "../actions";
import {
  MAX_MESSAGE_LENGTH,
  announcementState,
  type Announcement,
  type AnnouncementState as LifecycleState,
} from "@/lib/announcements";

/**
 * Create, edit, reorder and delete the announcements.
 *
 * One editor serves both new and existing rows: the row being edited is held in
 * state, and an empty draft means "new". That keeps the whole feature on one
 * page — with at most a handful of announcements, a separate /new route and a
 * navigation between them is more clicking for no more clarity.
 */

const input =
  "w-full bg-surface-container-highest border border-white/10 text-white p-3 rounded focus:border-secondary focus:ring-0";
const lbl =
  "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

/** How each row reads in the list, and why. */
const STATE_LABEL: Record<LifecycleState, { text: string; className: string }> = {
  live: { text: "Showing now", className: "bg-secondary/15 text-secondary" },
  scheduled: { text: "Scheduled", className: "bg-white/10 text-on-surface-variant" },
  expired: { text: "Finished", className: "bg-white/5 text-outline" },
  off: { text: "Off", className: "bg-white/5 text-outline" },
};

/** An ISO instant → the value a datetime-local input expects, in local time. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function whenText(a: Announcement): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (a.starts_at && a.ends_at) return `${fmt(a.starts_at)} → ${fmt(a.ends_at)}`;
  if (a.starts_at) return `From ${fmt(a.starts_at)}`;
  if (a.ends_at) return `Until ${fmt(a.ends_at)}`;
  return "No schedule — runs until switched off";
}

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-secondary text-on-secondary-fixed px-8 py-3 rounded font-label-bold uppercase tracking-widest hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
    >
      {pending ? "Saving…" : editing ? "Save changes" : "Add announcement"}
    </button>
  );
}

export default function AnnouncementsManager({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const [state, action] = useActionState<AnnouncementState, FormData>(
    saveAnnouncement,
    {}
  );
  const [editing, setEditing] = useState<Announcement | null>(null);
  // Remounts the form when the target row changes, so defaultValue is re-read
  // instead of React keeping the previous row's text in the inputs.
  const [formKey, setFormKey] = useState(0);
  const [message, setMessage] = useState("");

  const startEdit = (a: Announcement | null) => {
    setEditing(a);
    setMessage(a?.message ?? "");
    setFormKey((n) => n + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="max-w-3xl space-y-10">
      <form
        key={formKey}
        action={action}
        className="bg-surface-container border border-white/10 rounded-lg p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="font-label-bold text-white uppercase tracking-widest text-xs">
            {editing ? "Edit announcement" : "New announcement"}
          </p>
          {editing && (
            <button
              type="button"
              onClick={() => startEdit(null)}
              className="text-on-surface-variant hover:text-white text-xs font-label-bold uppercase tracking-widest"
            >
              Cancel — start a new one
            </button>
          )}
        </div>

        {editing && <input type="hidden" name="id" value={editing.id} />}

        <div>
          <label className={lbl} htmlFor="announcement-message">
            Message
          </label>
          <input
            id="announcement-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Free shipping on every trike until Sunday"
            className={input}
            required
          />
          <p className="text-[10px] text-outline uppercase tracking-widest mt-1">
            {message.length}/{MAX_MESSAGE_LENGTH} — one line, kept short enough
            to read as it scrolls past.
          </p>
        </div>

        <div>
          <label className={lbl} htmlFor="announcement-href">
            Link (optional)
          </label>
          <input
            id="announcement-href"
            name="href"
            defaultValue={editing?.href ?? ""}
            placeholder="/shop  or  https://example.com/page"
            className={input}
          />
          <p className="text-[10px] text-outline uppercase tracking-widest mt-1">
            A path on this site, or a full https:// address. Leave empty for
            plain text.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl} htmlFor="announcement-starts">
              Start (optional)
            </label>
            <input
              id="announcement-starts"
              type="datetime-local"
              name="starts_at"
              defaultValue={toLocalInput(editing?.starts_at)}
              className={input}
            />
          </div>
          <div>
            <label className={lbl} htmlFor="announcement-ends">
              End (optional)
            </label>
            <input
              id="announcement-ends"
              type="datetime-local"
              name="ends_at"
              defaultValue={toLocalInput(editing?.ends_at)}
              className={input}
            />
          </div>
        </div>
        <p className="text-[10px] text-outline uppercase tracking-widest -mt-2">
          Your local time. Leave both empty to run it until you switch it off.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label className={lbl} htmlFor="announcement-position">
              Order in the stripe
            </label>
            <input
              id="announcement-position"
              name="position"
              type="number"
              min={0}
              max={999}
              defaultValue={editing?.position ?? 0}
              className={`${input} max-w-[8rem]`}
            />
          </div>
          <label className="flex items-center gap-3 text-on-surface-variant pb-3">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing ? editing.active : true}
              className="w-5 h-5"
            />
            <span className="font-label-bold uppercase text-xs tracking-widest">
              Active
            </span>
          </label>
        </div>

        {state.error && <p className="text-error font-body-md">{state.error}</p>}
        {state.ok && (
          <p className="text-secondary font-label-bold uppercase text-xs tracking-widest">
            Saved — live on the storefront now.
          </p>
        )}

        <SaveButton editing={Boolean(editing)} />
      </form>

      <div>
        <p className="font-label-bold text-white uppercase tracking-widest text-xs mb-4">
          All announcements ({announcements.length})
        </p>
        {announcements.length === 0 ? (
          <p className="text-on-surface-variant">
            Nothing yet. The first one you add appears at the top of every
            storefront page.
          </p>
        ) : (
          <ul className="space-y-3">
            {announcements.map((a) => {
              const badge = STATE_LABEL[announcementState(a)];
              return (
                <li
                  key={a.id}
                  className="bg-surface-container border border-white/10 rounded-lg p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white break-words">{a.message}</p>
                      <p className="text-[10px] text-outline uppercase tracking-widest mt-1">
                        #{a.position} · {whenText(a)}
                        {a.href ? ` · links to ${a.href}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-label-bold uppercase tracking-widest ${badge.className}`}
                    >
                      {badge.text}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="text-secondary text-xs font-label-bold uppercase tracking-widest hover:underline"
                    >
                      Edit
                    </button>

                    <form action={toggleAnnouncement}>
                      <input type="hidden" name="id" value={a.id} />
                      {/* Submitting the opposite of the current state, so the
                          button says what it will do rather than what is. */}
                      {!a.active && <input type="hidden" name="active" value="on" />}
                      <button
                        type="submit"
                        className="text-on-surface-variant text-xs font-label-bold uppercase tracking-widest hover:text-white"
                      >
                        {a.active ? "Switch off" : "Switch on"}
                      </button>
                    </form>

                    <form
                      action={deleteAnnouncement}
                      onSubmit={(e) => {
                        if (!confirm(`Delete "${a.message}"? This can't be undone.`)) {
                          e.preventDefault();
                        }
                      }}
                      className="ml-auto"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="text-error text-xs font-label-bold uppercase tracking-widest hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
