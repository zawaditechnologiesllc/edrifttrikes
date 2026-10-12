/**
 * Recovering from the one failure a reload genuinely fixes.
 *
 * ═══ WHAT A STALE BUNDLE IS ════════════════════════════════════════════════
 *
 * Every deploy gives the JavaScript bundles new filenames. A page that was
 * already open — or one served from a cache, the browser's or the edge's —
 * holds HTML that points at the PREVIOUS build's filenames. Those files are
 * gone, the import 404s, and React throws.
 *
 * Nothing is actually broken. The visitor is simply holding yesterday's HTML,
 * and the only fix is to fetch today's: a reload. Asking a customer to do that
 * — or offering them a "Try again" button that re-renders the same dead
 * bundle — is how a successful deploy turns into a site that looks down.
 *
 * ⚠️ WHY THIS IS SHARED RATHER THAN COPIED. app/error.tsx had this recovery;
 * app/global-error.tsx did not. The difference matters more than it sounds:
 * error.tsx renders INSIDE the root layout, so a chunk failure in the layout's
 * own client components (the cart provider, the settings provider) escapes it
 * and lands on global-error — the one boundary that could not heal itself,
 * reached by exactly the errors a deploy causes. One module, used by both.
 */

/** Patterns a bundler/browser uses when the file an import names is gone. */
const STALE = /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

/** True when an error is a missing-bundle error rather than a real fault. */
export function isStaleBundleError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: unknown; message?: unknown };
  return STALE.test(`${String(e.name ?? "")} ${String(e.message ?? "")}`);
}

/** How long after a reload another one is refused. */
export const RELOAD_GUARD_MS = 10_000;

const KEY = "edrift.last-chunk-reload";

/**
 * Reload once for a stale bundle, and never twice in a row.
 *
 * GUARDED BY A TIMESTAMP, NOT A FLAG. The first version of this used a
 * once-per-session flag that was never cleared, so a visitor who hit a stale
 * chunk early saw the error page for the rest of their visit even though a
 * reload would have fixed every later click. A short window stops a tight
 * reload loop while still allowing recovery later on.
 *
 * Returns whether it reloaded, so a caller can decide what to show meanwhile.
 */
export function reloadOnceForStaleBundle(
  error: unknown,
  now: number = Date.now()
): boolean {
  if (!isStaleBundleError(error)) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (now - last < RELOAD_GUARD_MS) return false; // reloaded moments ago
    sessionStorage.setItem(KEY, String(now));
  } catch {
    // Storage blocked (private mode, cleared site data). Without somewhere to
    // record the attempt there is no way to stop a loop, so show the message
    // instead and let the visitor reload deliberately.
    return false;
  }
  window.location.reload();
  return true;
}
