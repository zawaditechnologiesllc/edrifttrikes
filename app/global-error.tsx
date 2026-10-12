"use client";

import { useEffect } from "react";
import { isStaleBundleError, reloadOnceForStaleBundle } from "@/lib/stale-bundle";

/**
 * The last line of defence: an error thrown by the ROOT LAYOUT itself.
 *
 * app/error.tsx renders inside the layout, so it cannot catch a failure in the
 * layout — a throw there would escape to Next's bare "Application error"
 * string again. This one replaces the whole document, which is why it carries
 * its own <html> and <body> and uses inline styles: the stylesheet is part of
 * what may have failed to load.
 *
 * Deliberately plain. Its only job is to render under any circumstances and
 * offer a way out.
 *
 * ⚠️ AND TO HEAL A DEPLOY. This is the boundary a deploy reaches: the root
 * layout's client components (the cart and settings providers) load on every
 * page, so when a visitor is holding HTML from the previous build, the chunk
 * those providers need is gone and the failure lands HERE rather than on
 * app/error.tsx. It used to offer a "Try again" button that called reset() —
 * which re-renders the same missing bundle and cannot possibly work, leaving a
 * customer on a dead page after an otherwise successful deploy. For that one
 * error class the fix is a reload, so it reloads.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleBundleError(error);

  useEffect(() => {
    // Goes to the browser console and any error reporter: the visitor is shown
    // something friendly, but the cause is still recorded.
    console.error("[app] root layout failed:", error);
    reloadOnceForStaleBundle(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0f",
          color: "#e7e7ea",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.75rem", textTransform: "uppercase", margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#a9a9b2", lineHeight: 1.6, marginTop: "1rem" }}>
            {stale
              ? "The shop was just updated and this page is out of date. Reloading now — nothing in your cart has been lost."
              : "The page failed to load. Nothing in your cart has been lost."}
          </p>
          <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => (stale ? window.location.reload() : reset())}
              style={{
                background: "#2b2b6f", color: "#fff", border: 0, padding: "14px 28px",
                borderRadius: 8, textTransform: "uppercase", letterSpacing: "0.1em",
                fontWeight: 700, cursor: "pointer",
              }}
            >
              {stale ? "Reload" : "Try again"}
            </button>
            <a
              href="/"
              style={{
                border: "1px solid rgba(255,255,255,.25)", color: "#fff", padding: "14px 28px",
                borderRadius: 8, textTransform: "uppercase", letterSpacing: "0.1em",
                fontWeight: 700, textDecoration: "none",
              }}
            >
              Back to the shop
            </a>
          </div>
          {/*
              THE OWNER'S ONE DIAGNOSTIC, and the reason it is worth the space.
              "Something went wrong" is the same sentence whether a bundle is
              stale or the server threw, and those two have opposite fixes. The
              name and message say which in four words, without asking anyone
              to open developer tools — which is what Next's own error page
              asks of a customer.

              A digest is also a signal in itself: Next only attaches one to an
              error thrown ON THE SERVER, so a reference means "look in the
              Worker logs" and no reference means it happened in the browser.
          */}
          <details style={{ marginTop: "2.5rem", textAlign: "left" }}>
            <summary
              style={{
                color: "#6b6b74", fontSize: ".7rem", textTransform: "uppercase",
                letterSpacing: "0.1em", cursor: "pointer",
              }}
            >
              Technical details
            </summary>
            <pre
              style={{
                marginTop: ".75rem", padding: "1rem", borderRadius: 6,
                border: "1px solid rgba(255,255,255,.1)", background: "#15151b",
                color: "#a9a9b2", fontSize: "11px", whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.name}: {error.message}
              {error.digest ? `\nReference: ${error.digest} (thrown on the server — see the Worker logs)` : "\nNo reference: this happened in the browser."}
            </pre>
          </details>
        </div>
      </body>
    </html>
  );
}
