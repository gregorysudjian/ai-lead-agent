"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BUTTON_PRIMARY } from "../ui/primitives";
import { GUEST_DISABLED_TITLE, useIsGuest } from "../viewer";

/**
 * Make one catalog business a lead.
 *
 * Deliberately NOT optimistic, like the status toggle: the card only changes
 * to "In your leads" when the server has created the lead and re-rendered the
 * page from the store. Showing it any earlier would claim a lead exists before
 * the database agrees.
 *
 * One click, one business. There is no "add all", because a lead is a choice.
 */
export function AddToLeadsButton({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const guest = useIsGuest();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = saving || refreshing;

  async function add() {
    if (busy) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${businessId}/lead`, { method: "POST" });
      if (!response.ok) {
        setError("Could not add this business. Please try again.");
        return;
      }
      // The server is the source of truth: re-render from the store, which
      // now carries the link, and the card becomes "In your leads".
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={add} disabled={busy || guest} title={guest ? GUEST_DISABLED_TITLE : undefined} className={`${BUTTON_PRIMARY} px-3 py-1.5`}>
        {busy ? (
          "Adding…"
        ) : (
          <>
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
            Add to leads
          </>
        )}
        <span className="sr-only"> for {businessName}</span>
      </button>
      {error ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
