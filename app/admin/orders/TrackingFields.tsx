"use client";

import { useId, useState } from "react";
import {
  COURIER_GROUPS,
  generateTrackingNumber,
  isKnownCourier,
  looksInternal,
  trackingUrlFor,
} from "@/lib/couriers";

const OTHER = "__other__";

const select =
  "w-full bg-surface-container-highest border border-white/10 text-white rounded px-3 py-2 focus:border-secondary focus:ring-0";
const input =
  "w-full bg-surface-container-highest border border-white/10 text-white rounded px-3 py-2 focus:border-secondary focus:ring-0";
const lbl =
  "block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest";

/**
 * Tracking number and courier, as one control.
 *
 * They are one control because they only mean anything together: the courier
 * decides whether the number the customer receives is a link they can follow or
 * a string they have to go and paste somewhere. Keeping them side by side lets
 * this show, before saving, exactly what the customer's email will contain.
 *
 * Both fields submit through HIDDEN inputs rather than the visible ones, so
 * whatever combination of select and free-text box is on screen, the form posts
 * exactly one `courier` and one `tracking_number`.
 */
export default function TrackingFields({
  trackingNumber,
  courier,
}: {
  trackingNumber: string | null;
  courier: string | null;
}) {
  const initial = (courier ?? "").trim();
  // An order saved before the dropdown existed can hold anything. Rather than
  // silently dropping it, put it in the "Other" box where it stays visible and
  // editable.
  const [choice, setChoice] = useState(
    initial === "" ? "" : isKnownCourier(initial) ? initial : OTHER
  );
  const [other, setOther] = useState(
    initial !== "" && !isKnownCourier(initial) ? initial : ""
  );
  const [number, setNumber] = useState(trackingNumber ?? "");
  const [generated, setGenerated] = useState(false);
  // Generated, not hard-coded: nothing stops a future page rendering two of
  // these, and duplicate ids would point both labels at the same input.
  const ids = useId();

  const resolvedCourier = choice === OTHER ? other.trim() : choice;
  const url = trackingUrlFor(resolvedCourier, number);
  const internal = looksInternal(number);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl} htmlFor={`${ids}-number`}>
            Tracking number
          </label>
          <div className="flex gap-2">
            <input
              id={`${ids}-number`}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                setGenerated(false);
              }}
              placeholder="1Z999AA10123456784"
              className={input}
            />
            <button
              type="button"
              onClick={() => {
                setNumber(generateTrackingNumber());
                setGenerated(true);
              }}
              className="shrink-0 border border-secondary/60 text-secondary rounded px-3 py-2 text-xs font-label-bold uppercase tracking-widest hover:bg-secondary/10 active:scale-95 transition-all"
            >
              Generate
            </button>
          </div>
          <input type="hidden" name="tracking_number" value={number} />
        </div>

        <div>
          <label className={lbl} htmlFor={`${ids}-courier`}>
            Courier
          </label>
          <select
            id={`${ids}-courier`}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className={select}
          >
            <option value="">— not assigned yet —</option>
            {COURIER_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.couriers.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
            {/* The list is long but it is never going to be complete, and a
                courier you cannot name is a courier you cannot record. */}
            <option value={OTHER}>Other — type it in</option>
          </select>
          {choice === OTHER && (
            <input
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="Courier name"
              aria-label="Courier name"
              className={`${input} mt-2`}
            />
          )}
          <input type="hidden" name="courier" value={resolvedCourier} />
        </div>
      </div>

      {/* What the customer will actually get, shown before it is sent. */}
      {number.trim() !== "" && (
        <div className="rounded border border-white/10 bg-surface-container-highest/40 px-3 py-2 text-[11px] leading-relaxed">
          {generated || internal ? (
            <p className="text-on-surface-variant">
              <strong className="text-white">This is our own reference</strong>,
              not a number the courier issued — it will not resolve on their
              website, so the customer gets it as plain text. Paste the courier&apos;s
              number over it once they give you one.
            </p>
          ) : url ? (
            <p className="text-on-surface-variant">
              The customer&apos;s email will link to{" "}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-secondary underline break-all"
              >
                {url}
              </a>
            </p>
          ) : resolvedCourier ? (
            <p className="text-on-surface-variant">
              We don&apos;t have a tracking page for{" "}
              <strong className="text-white">{resolvedCourier}</strong>, so the
              number goes to the customer as plain text.
            </p>
          ) : (
            <p className="text-on-surface-variant">
              Choose a courier and the customer&apos;s email can link straight to
              their tracking page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
