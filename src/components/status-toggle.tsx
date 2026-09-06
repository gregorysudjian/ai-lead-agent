"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { LeadStatus } from "@/lib/types";

import { BUTTON_SECONDARY } from "./ui/primitives";

/**
 * Toggles a lead between "new" and "reviewed".
 *
 * A Client Component because it owns request state. It talks to the API and
 * then calls `router.refresh()`, which re-runs the Server Component that read
 * the repository and merges the fresh payload without discarding client state
 * such as the active filter.
 *
 * Deliberately NOT optimistic: the label only changes once the server has
 * confirmed the write. Showing "reviewed" before the store agrees would be
 * lying to the user about persisted state.
 */
export function StatusToggle({
  leadId,
  status,
}: {
  leadId: string;
  status: LeadStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Keeps the button disabled while the refreshed payload is still arriving.
  const [isRefreshing, startTransition] = useTransition();

  const nextStatus: LeadStatus = status === "new" ? "reviewed" : "new";
  const busy = isSaving || isRefreshing;

  async function handleClick() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        setError("Could not update status. Please try again.");
        return;
      }

      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label={`Mark ${status === "new" ? "reviewed" : "new"}`}
        className={BUTTON_SECONDARY}
      >
        {busy ? "Saving…" : `Mark ${nextStatus}`}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
