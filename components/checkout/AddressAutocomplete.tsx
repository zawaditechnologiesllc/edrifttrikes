"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AddressPrefill, AddressSuggestion } from "@/lib/address-lookup";

/**
 * The street-address input, with the address lookup American checkouts have
 * trained everyone to expect: start typing, pick your address, the rest of the
 * form fills itself in.
 *
 * ENHANCEMENT, NOT A DEPENDENCY. This is the ordinary text input with a list
 * attached. Every keystroke goes straight into the form state, so a buyer whose
 * address the provider has never heard of — or who is offline, or behind a
 * blocker, or on a checkout where no provider is configured at all — types the
 * address exactly as they did before and nothing tells them anything is wrong.
 * The dropdown simply never appears.
 *
 * The lookup is server-side (/api/address/suggest) so the geocoding key stays
 * out of the browser bundle.
 */

/** Wait after the last keystroke before asking the provider. */
const DEBOUNCE_MS = 320;

export default function AddressAutocomplete({
  id,
  value,
  country,
  onChange,
  onPick,
  onBlur,
  className,
  placeholder,
  describedBy,
  invalid,
  maxLength,
  required,
}: {
  id: string;
  value: string;
  /** ISO code from the country select; narrows and cheapens the search. */
  country: string;
  onChange: (value: string) => void;
  /** Fired with the components of a picked address. */
  onPick: (prefill: AddressPrefill) => void;
  onBlur: () => void;
  className?: string;
  placeholder?: string;
  describedBy?: string;
  invalid?: boolean;
  maxLength?: number;
  required?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);

  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  /**
   * The text the buyer last picked. Without it, choosing an address writes into
   * the input, which looks like a keystroke and immediately re-opens the list
   * over the form the buyer just finished filling in.
   */
  const pickedRef = useRef<string | null>(null);
  /** Guards against a slow response for an old query overwriting a newer one. */
  const requestRef = useRef(0);

  useEffect(() => {
    if (pickedRef.current !== null && pickedRef.current === value) return;
    pickedRef.current = null;

    const query = value.trim();
    if (query.length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const seq = ++requestRef.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const params = new URLSearchParams({ q: query });
        if (country) params.set("country", country);
        const response = await fetch(`/api/address/suggest?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("lookup failed");
        const data = (await response.json()) as { suggestions?: AddressSuggestion[] };
        // A response for a query the buyer has already typed past is stale.
        if (seq !== requestRef.current) return;
        const next = Array.isArray(data.suggestions) ? data.suggestions : [];
        setSuggestions(next);
        setOpen(next.length > 0);
        setActive(-1);
      } catch {
        // Silent by design: the buyer is mid-address and can finish typing it.
        if (seq === requestRef.current) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (seq === requestRef.current) setBusy(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, country]);

  // Close when focus or a click leaves the field entirely.
  useEffect(() => {
    if (!open) return;
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", onDocumentPointerDown);
  }, [open]);

  const choose = async (suggestion: AddressSuggestion) => {
    setOpen(false);
    setActive(-1);

    // Components either came with the suggestion (the keyless provider) or need
    // one details lookup (Google, which bills for it — so only on a real pick).
    let prefill = suggestion.prefill ?? null;
    if (!prefill && suggestion.id) {
      try {
        setBusy(true);
        const response = await fetch(
          `/api/address/resolve?id=${encodeURIComponent(suggestion.id)}`
        );
        const data = (await response.json()) as { prefill?: AddressPrefill | null };
        prefill = data.prefill ?? null;
      } catch {
        prefill = null;
      } finally {
        setBusy(false);
      }
    }

    if (prefill) {
      pickedRef.current = prefill.address;
      onPick(prefill);
    } else {
      // The lookup failed after the click. Put the label in the field so the
      // buyer keeps what they picked and can correct the rest by hand, rather
      // than watching their selection vanish.
      pickedRef.current = suggestion.label;
      onChange(suggestion.label);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      // Only swallow Enter when an option is highlighted — otherwise it must
      // still submit the form.
      event.preventDefault();
      void choose(suggestions[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        name={id}
        type="text"
        value={value}
        required={required}
        maxLength={maxLength}
        // The browser's own address autofill stays on: it is faster than any
        // network lookup for a returning buyer, and the two don't conflict.
        autoComplete="street-address"
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={onBlur}
        className={className}
      />

      {busy && (
        <span
          aria-hidden="true"
          className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-white/20 border-t-secondary animate-spin"
        />
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-white/15 bg-surface-container-high shadow-2xl"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id || s.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // pointerdown, not click: the input's blur would otherwise close
              // the list before the click ever landed.
              onPointerDown={(e) => {
                e.preventDefault();
                void choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-3 text-sm transition-colors ${
                i === active ? "bg-secondary/15 text-white" : "text-on-surface-variant"
              }`}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <p className="sr-only" role="status">
        {open ? `${suggestions.length} address suggestions available.` : ""}
      </p>
    </div>
  );
}
