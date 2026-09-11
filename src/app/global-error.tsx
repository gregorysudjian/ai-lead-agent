"use client";

import { useEffect } from "react";

/**
 * The last-resort boundary: an error thrown by the root layout itself.
 *
 * `error.tsx` renders INSIDE the root layout, so it cannot catch a failure of
 * that layout. This one replaces the whole document, which is why it has to
 * supply its own `<html>` and `<body>` -- and why it uses inline styles rather
 * than Tailwind classes. If the root layout failed, the stylesheet it imports
 * is exactly the thing that may not be there.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[render] the root layout failed:", error);
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
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            Lead Finder could not start.
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", lineHeight: 1.6 }}>
            The application shell itself failed to render. Nothing was changed, and no
            lead data was modified. The cause was written to the server log.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#4f46e5",
              color: "#ffffff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#475569" }}>
              Reference for the server log: <code>{error.digest}</code>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
