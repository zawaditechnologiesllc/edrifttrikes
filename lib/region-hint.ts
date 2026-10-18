/**
 * Remembering that somebody has already seen the storefront suggestion.
 *
 * ═══ TWO KINDS OF "NO", AND THEY ARE NOT THE SAME ══════════════════════════
 *
 * A visitor who presses "Stay here" has made a decision. Asking them again on
 * the next page would be ignoring it, so that answer is kept for good.
 *
 * A visitor who simply did not react has not decided anything — they may have
 * been reading the page, or looking away. The banner folds itself up after a
 * while so it is not permanently in the furniture, but treating that silence
 * as a refusal would quietly delete an offer they never saw. So it goes quiet
 * for the rest of the browsing session only, and a fresh visit asks once more.
 *
 * ⚠️ THE DISTINCTION IS THE POINT. One storage, one rule, and the visitor who
 * stepped away for a minute loses the suggestion forever; the visitor who said
 * no gets nagged on every page. Both are worse than keeping them apart.
 *
 * Storage is passed in rather than reached for, so the rules are testable
 * without a browser — and so a runtime with no storage at all (private mode, a
 * blocked origin) degrades to "ask", which is the safe direction.
 */

/** A decision, kept across visits. */
export const DISMISSED_KEY = "edrift.region-hint-dismissed";

/** An absence of one, kept only for this tab's session. */
export const HUSHED_KEY = "edrift.region-hint-hushed";

/** The least a browser has to provide for any of this to work. */
export type MiniStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** Hosts recorded under one key. Never throws, never returns junk. */
function hosts(storage: MiniStorage | null | undefined, key: string): string[] {
  try {
    const raw = storage?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // Blocked, full, or holding something that is not ours. Treat it as empty
    // and ask — the alternative is a feature that silently never runs.
    return [];
  }
}

function remember(storage: MiniStorage | null | undefined, key: string, host: string): void {
  if (!storage || !host) return;
  try {
    // Capped: a visitor cannot accumulate more than the five storefronts plus
    // slack, and an unbounded list in storage is a slow leak nobody notices.
    const next = [...new Set([...hosts(storage, key), host])].slice(-10);
    storage.setItem(key, JSON.stringify(next));
  } catch {
    /* quota or private mode — the banner may simply reappear */
  }
}

/** Has this visitor already been asked about this storefront? */
export function isHushed(
  host: string,
  stores: { local?: MiniStorage | null; session?: MiniStorage | null }
): boolean {
  const h = String(host ?? "").toLowerCase();
  if (!h) return false;
  return (
    hosts(stores.local, DISMISSED_KEY).includes(h) ||
    hosts(stores.session, HUSHED_KEY).includes(h)
  );
}

/** They pressed "Stay here". Do not ask again, on any future visit. */
export function hushForever(host: string, local: MiniStorage | null | undefined): void {
  remember(local, DISMISSED_KEY, String(host ?? "").toLowerCase());
}

/** They let it time out. Quiet for this session; ask again another day. */
export function hushForSession(host: string, session: MiniStorage | null | undefined): void {
  remember(session, HUSHED_KEY, String(host ?? "").toLowerCase());
}

/**
 * How long the banner waits before folding itself away.
 *
 * Long enough to read a sentence and reach for the link; short enough that
 * somebody who is not interested gets their page back. Paused while the
 * pointer or keyboard focus is on the banner, so it never disappears from
 * under someone who is actually using it.
 */
export const AUTO_COLLAPSE_MS = 15_000;

/** How long the fold itself takes. Matches the CSS transition. */
export const COLLAPSE_ANIMATION_MS = 400;
