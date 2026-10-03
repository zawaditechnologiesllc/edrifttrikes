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
     * A stale-bundle error is the one failure a reload genuinely fixes. Guarded
     * by a sessionStorage flag so a genuinely broken page cannot put the
     * browser into a reload loop — one attempt, then the message below.
     */
    const stale = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i;
    if (!stale.test(`${error.name} ${error.message}`)) return;
    try {
      if (sessionStorage.getItem("edrift.reloaded-for-chunk")) return;
      sessionStorage.setItem("edrift.reloaded-for-chunk", "1");
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
        {error.digest && (
          <p className="text-outline text-xs mt-8">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
