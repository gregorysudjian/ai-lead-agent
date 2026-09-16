"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BUTTON_SECONDARY } from "../ui/primitives";
import { GUEST_DISABLED_TITLE, useIsGuest } from "../viewer";

/**
 * "Update to new design" for a demo generated before design genomes existed.
 *
 * Generates a NEW demo for the lead, from the same analysis, and opens it.
 * The old demo is not touched -- it may already have been shown to someone --
 * it simply becomes an earlier version. One deliberate click, like every
 * generation; it POSTs to the same route the lead page uses.
 */
export function UpgradeDemoButton({ leadId, analysisId }: { leadId: string; analysisId: string }) {
  const router = useRouter();
  const guest = useIsGuest();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const busy = pending || isNavigating;

  async function upgrade() {
    if (busy) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${leadId}/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });
      const body = await response.json().catch(() => null);
      const id = body?.demoSite?.id;
      if (!response.ok || typeof id !== "string") {
        setError(typeof body?.error === "string" ? body.error : "Could not update this demo. Please try again.");
        return;
      }
      startTransition(() => router.push(`/demos/${id}`));
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={upgrade} disabled={busy || guest} title={guest ? GUEST_DISABLED_TITLE : undefined} className={BUTTON_SECONDARY}>
        {busy ? "Updating…" : "Update to new design"}
      </button>
      {error ? (
        <p role="alert" className="w-full text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </>
  );
}
