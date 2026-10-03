"use client";

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
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            The page failed to load. Nothing in your cart has been lost.
          </p>
          <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                background: "#2b2b6f", color: "#fff", border: 0, padding: "14px 28px",
                borderRadius: 8, textTransform: "uppercase", letterSpacing: "0.1em",
                fontWeight: 700, cursor: "pointer",
              }}
            >
              Try again
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
          {error.digest && (
            <p style={{ color: "#6b6b74", fontSize: ".75rem", marginTop: "2rem" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
