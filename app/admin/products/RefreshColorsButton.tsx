"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { refreshProductColors, type ColorRefreshState } from "../actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-white/20 text-white px-5 py-3 rounded font-label-bold uppercase tracking-widest text-sm hover:border-secondary hover:text-secondary active:scale-95 transition-all disabled:opacity-40"
    >
      {pending ? "Reading sheets…" : "Refresh colours"}
    </button>
  );
}

/**
 * Re-reads every product's colours out of its description text.
 *
 * The nightly sweep does this a few at a time, which is right for a background
 * job and no use to someone who has just uploaded twenty product sheets and
 * wants the swatches on the shop now. This does the whole catalogue on a click.
 *
 * The report matters as much as the action: the list of products with no
 * colours anywhere is the only way an owner finds out which sheet is missing a
 * `Colors:` line, short of opening all of them.
 */
export default function RefreshColorsButton() {
  const [state, action] = useActionState<ColorRefreshState, FormData>(
    refreshProductColors,
    {}
  );

  return (
    <form action={action} className="text-right">
      <Button />
      {state.error && (
        <p className="text-error text-xs mt-2 max-w-sm ml-auto">{state.error}</p>
      )}
      {state.ok && (
        <div className="mt-2 max-w-sm ml-auto">
          <p className="text-secondary text-xs">{state.message}</p>
          {state.missing && state.missing.length > 0 && (
            <p className="text-on-surface-variant text-[11px] mt-1 leading-relaxed">
              No colours found for:{" "}
              <span className="text-white">{state.missing.join(", ")}</span>. Add a{" "}
              <code className="text-secondary">Colors:</code> line to those product
              sheets, or set them on the product itself.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
