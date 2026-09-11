"use client";

import Link from "next/link";
import { useEffect } from "react";

import { BUTTON_PRIMARY, BUTTON_SECONDARY, ErrorPanel } from "@/components/ui/primitives";

/**
 * The error boundary for every page under the root layout.
 *
 * Without this file a thrown render error reaches Next's built-in fallback,
 * which is a bare "Application error: a server-side exception has occurred" on
 * an otherwise empty document -- no navigation, and no way back except the URL
 * bar. Pages here deliberately throw operator-facing messages; before this
 * boundary existed, none of them was ever displayed to anybody.
 *
 * WHAT IS NOT SHOWN: `error.message`. Next replaces it with a generic string in
 * production anyway, but the rule holds in development too -- an error body can
 * carry a provider's response, and those contain keys and quota details. The
 * `digest` is safe and is the value that correlates this screen with the server
 * log line that has the real cause.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The client-side half of the record. The server already logged the cause.
    console.error("[render] a page failed to render:", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <ErrorPanel
        title="Something went wrong loading this page."
        detail="The page could not be rendered. Nothing was changed, and no lead data was modified. The details were written to the server log."
      />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className={BUTTON_PRIMARY}>
          Try again
        </button>
        <Link href="/leads" className={BUTTON_SECONDARY}>
          Back to leads
        </Link>
        <Link href="/" className={BUTTON_SECONDARY}>
          Dashboard
        </Link>
      </div>

      {error.digest ? (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Reference for the server log:{" "}
          <code className="font-mono break-all">{error.digest}</code>
        </p>
      ) : null}
    </div>
  );
}
