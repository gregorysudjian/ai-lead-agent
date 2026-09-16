"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BUTTON_SECONDARY } from "./ui/primitives";
import { GUEST_DISABLED_TITLE, useIsGuest } from "./viewer";

/**
 * Puts a removed lead back on the list.
 *
 * Not optimistic, like the status toggle: the page changes only once the
 * server has confirmed the lead is back.
 */
export function RestoreLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const guest = useIsGuest();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const busy = isSaving || isRefreshing;

  async function handleClick() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${leadId}/restore`, { method: "POST" });
      if (!response.ok) {
        setError("Could not put it back. Please try again.");
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
      <button type="button" onClick={handleClick} disabled={busy || guest} title={guest ? GUEST_DISABLED_TITLE : undefined} className={BUTTON_SECONDARY}>
        {busy ? "Saving…" : "Put back on my list"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
