"use client";

import { useState } from "react";

type Batch = {
  ok?: boolean;
  updated?: number;
  scanned?: number;
  failed?: string[];
  done?: boolean;
  nextOffset?: number | null;
  error?: string;
};

/**
 * One-click "fix existing images" button. Loops the admin batch endpoint until
 * every object has been re-stamped with the 1-year cache-control — no local
 * script needed. Safe to run repeatedly.
 */
export default function StorageCacheButton() {
  const [running, setRunning] = useState(false);
  const [updated, setUpdated] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  async function run() {
    setRunning(true);
    setUpdated(0);
    setFailures([]);
    setStatus("Starting…");
    let offset = 0;
    let total = 0;
    const allFailures: string[] = [];
    try {
      // Bounded loop so a bad response can never spin forever.
      for (let i = 0; i < 500; i++) {
        const res = await fetch(`/api/admin/storage-cache?offset=${offset}`, { cache: "no-store" });
        const data: Batch = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          setStatus(`Stopped: ${data.error || `HTTP ${res.status}`}`);
          setRunning(false);
          return;
        }
        total += data.updated ?? 0;
        setUpdated(total);
        if (data.failed?.length) allFailures.push(...data.failed);
        setStatus(`Optimized ${total} image${total === 1 ? "" : "s"}…`);
        if (data.done || data.nextOffset == null) break;
        offset = data.nextOffset;
      }
      setFailures(allFailures);
      setStatus(
        allFailures.length
          ? `Done — ${total} updated, ${allFailures.length} failed (see below).`
          : `Done — ${total} image${total === 1 ? "" : "s"} now cache for 1 year. ✓`
      );
    } catch (e) {
      setStatus(`Stopped: ${(e as Error)?.message || "network error"}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={running}
        className="bg-primary-container text-white px-6 py-3 rounded-lg font-label-bold uppercase tracking-widest text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
      >
        {running ? `Optimizing… (${updated})` : "Optimize image caching"}
      </button>
      {status && <p className="text-on-surface-variant text-sm">{status}</p>}
      {failures.length > 0 && (
        <ul className="text-error text-xs list-disc pl-5 space-y-1 max-h-40 overflow-y-auto">
          {failures.slice(0, 20).map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
