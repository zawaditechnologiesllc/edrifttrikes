"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * What a visitor sees when a client-side render throws.
 *
 * ═══ WHY THIS FILE EXISTS ══════════════════════════════════════════════════
 *
 * Without an error.tsx, Next has nothing to fall back to and shows its own
 * bare string: "Application error: a client-side exception has occurred (see
 * the browser console for more information)." That is a dead end — no retry,
 * no navigation, no branding, and an instruction to open the developer console
 * aimed at a customer who is trying to buy a trike.
 *
 * This boundary turns the same failure into a page someone can act on, and it
 * keeps the header-less layout deliberately simple: whatever just failed, this
 * component must be able to render.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CHUNK ERRORS RECOVER THEMSELVES. After a deploy, a page that is still open
 * (or served from a cache) references JavaScript bundles whose filenames the
 * new build no longer has. The import 404s and React throws — and the only fix
 * is to fetch the current HTML. That is a reload, so for that one error class
 * this reloads once, automatically, rather than asking the visitor to.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Goes to the browser console and to any error reporter, so the cause is
    // recorded even though the visitor is shown something friendly.
    console.error("[app] client render failed:", error);

    /**
     * A stale-bundle error is the one failure a reload genuinely fixes.
     *
     * Guarded by a TIMESTAMP, not a once-per-session flag. The first version
     * used a flag that was never cleared, which meant one reload per session
     * and the error page forever after — so a visitor who hit a stale chunk
     * early saw a broken site for the rest of their visit even though a reload
     * would have fixed each navigation. A short window stops a tight loop
     * while still allowing recovery on a later click.
     */
    const stale = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i;
    if (!stale.test(`${error.name} ${error.message}`)) return;
    try {
      const KEY = "edrift.last-chunk-reload";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last < 10_000) return; // reloaded moments ago — don't loop
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    } catch {
      /* storage blocked — fall through to the message rather than risk a loop */
    }
  }, [error]);

  return (
    <div className="bg-background text-on-surface min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase">
          Something went wrong
        </h1>
        <p className="text-on-surface-variant font-body-lg mt-4">
          That page didn&apos;t load properly. It&apos;s us, not you — nothing
          you did caused it, and nothing in your cart has been lost.
        </p>
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border border-white/20 text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:bg-white/5 transition-all"
          >
            Back to the shop
          </Link>
        </div>
        {/*
            The real message, collapsed. A customer never opens this; the owner
            can read the actual fault without being told to open developer
            tools, which is what the default Next error page asks of them.
        */}
        <details className="mt-10 text-left mx-auto max-w-lg">
          <summary className="text-outline text-xs uppercase tracking-widest cursor-pointer hover:text-on-surface-variant">
            Technical details
          </summary>
          <pre className="mt-3 whitespace-pre-wrap break-words rounded border border-white/10 bg-surface-container p-4 text-[11px] text-on-surface-variant">
{error.name}: {error.message}
{error.digest ? `\nReference: ${error.digest}` : ""}
          </pre>
        </details>
      </div>
    </div>
  );
}
