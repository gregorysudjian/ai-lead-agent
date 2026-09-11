"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { BUTTON_PRIMARY, BUTTON_SECONDARY, Card, INPUT, FOCUS_RING } from "./ui/primitives";

/**
 * "Generate a website": pick a business, get a demo.
 *
 * A Client Component because it owns a picker, a filter box and a request
 * lifecycle. It POSTs to /api/demos and then navigates to the preview the
 * server returned -- it never renders a demo it has not seen come back.
 *
 * One deliberate click per generation. No effect, no retry loop, no bulk mode.
 * That matters more than it looks: generation can run an analysis and a demo
 * generation back to back, and either provider can be a paid one.
 */

/** The minimum a picker row needs. Deliberately not the whole `Lead`. */
export interface DemoCandidate {
  id: string;
  name: string;
  category: string;
  city: string;
  /** Whether a demo already exists, so regenerating is a visible choice. */
  hasDemo: boolean;
}

export function GenerateDemoButton({
  candidates,
  generator,
}: {
  candidates: DemoCandidate[];
  /** What a run would use, so the cost of the click is stated before it. */
  generator: { name: string; model: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, startTransition] = useTransition();

  const busy = pendingId !== null || isNavigating;

  const matches = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const pool = needle
      ? candidates.filter((c) =>
          `${c.name} ${c.category} ${c.city}`.toLowerCase().includes(needle),
        )
      : candidates;
    // Businesses without a demo first: those are the ones this button is for.
    return [...pool].sort((a, b) => Number(a.hasDemo) - Number(b.hasDemo)).slice(0, 60);
  }, [candidates, filter]);

  async function generate(leadId: string) {
    if (busy) return;
    setPendingId(leadId);
    setError(null);

    try {
      const response = await fetch("/api/demos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not generate a website. Please try again.",
        );
        return;
      }

      const id = body?.demo?.id;
      if (typeof id !== "string") {
        setError("The website was generated but could not be opened.");
        return;
      }

      setOpen(false);
      startTransition(() => router.push(`/demos/${id}`));
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={candidates.length === 0}
        className={BUTTON_PRIMARY}
        title={
          candidates.length === 0 ? "Find some businesses first" : "Generate a website"
        }
      >
        Generate a website
      </button>
    );
  }

  return (
    <Card as="section" className="w-full p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Which business?
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pick one and a full website is generated for it. Businesses without a demo
            are listed first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className={`shrink-0 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${FOCUS_RING}`}
        >
          Cancel
        </button>
      </div>

      <label
        htmlFor="demo-filter"
        className="mt-4 block text-xs font-medium text-slate-700 dark:text-slate-300"
      >
        Filter businesses
      </label>
      <input
        id="demo-filter"
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter by name, category or city"
        autoFocus
        className={`mt-1 w-full ${INPUT}`}
      />

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      <ul className="mt-4 max-h-96 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
        {matches.length === 0 ? (
          <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No business matches that filter.
          </li>
        ) : (
          matches.map((candidate) => (
            <li key={candidate.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {candidate.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {candidate.category} · {candidate.city}
                  {candidate.hasDemo ? " · has a demo already" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => generate(candidate.id)}
                disabled={busy}
                className={`${BUTTON_SECONDARY} shrink-0`}
              >
                {pendingId === candidate.id
                  ? "Generating..."
                  : candidate.hasDemo
                    ? "Regenerate"
                    : "Generate"}
              </button>
            </li>
          ))
        )}
      </ul>

      <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Uses {generator.name} ({generator.model}). A business with no analysis yet is
        analysed first. Nothing is published and nothing is sent to the business.
      </p>
    </Card>
  );
}
