"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BUTTON_PRIMARY, Card, INPUT, SectionHeading } from "./ui/primitives";

interface SearchOutcome {
  discovered: number;
  created: number;
  updated: number;
  /** The provider capped this search, so more matches may exist upstream. */
  truncated: boolean;
  limit: number | null;
}

/**
 * Business discovery form.
 *
 * A Client Component because it owns form state and request lifecycle. It calls
 * the existing POST /api/search -- no discovery logic is duplicated here -- then
 * refreshes the server-rendered lead data so counts and rows reflect the write.
 */
export function SearchPanel() {
  const router = useRouter();
  const [category, setCategory] = useState("Hair salon");
  const [city, setCity] = useState("Montreal");
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<string[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, startTransition] = useTransition();

  const busy = isSearching || isRefreshing;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guard against a double submit landing while a request is in flight.
    if (busy) return;

    setIsSearching(true);
    setError(null);
    setSupported(null);
    setOutcome(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, city }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(
          typeof body?.error === "string" ? body.error : "Search failed. Please try again.",
        );
        // A 400 from an unsupported city/category lists what IS supported.
        const list = body?.supported?.categories ?? body?.supported?.cities;
        if (Array.isArray(list)) setSupported(list);
        return;
      }

      setOutcome({
        discovered: body.count,
        created: body.saved.created,
        updated: body.saved.updated,
        truncated: body.meta?.truncated === true,
        limit: typeof body.meta?.limit === "number" ? body.meta.limit : null,
      });
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <Card as="section" className="p-5">
      <SectionHeading
        title="Find businesses"
        hint="Searches OpenStreetMap for businesses in a supported city and category."
      />

      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="category" className="block text-sm font-medium">
            Category
          </label>
          <input
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            autoComplete="off"
            className={`mt-1 ${INPUT}`}
          />
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium">
            City
          </label>
          <input
            id="city"
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            autoComplete="off"
            className={`mt-1 ${INPUT}`}
          />
        </div>

        <div className="flex items-end">
          <button type="submit" disabled={busy} className={`${BUTTON_PRIMARY} w-full sm:w-auto`}>
            {busy ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-3 space-y-2 text-sm">
        {busy ? (
          <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span
              aria-hidden="true"
              className="h-3 w-3 animate-pulse rounded-full bg-indigo-500"
            />
            Searching the provider…
          </p>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/50"
          >
            <p className="text-red-900 dark:text-red-200">{error}</p>
            {supported ? (
              <p className="mt-1 text-xs text-red-800 dark:text-red-300">
                Currently supported: {supported.join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}

        {outcome && !busy && !error ? (
          outcome.discovered === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">
              No businesses found for that category and city.
            </p>
          ) : (
            <>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>{outcome.discovered}</strong> businesses discovered ·{" "}
                <strong>{outcome.created}</strong> new{" "}
                {outcome.created === 1 ? "lead" : "leads"} ·{" "}
                <strong>{outcome.updated}</strong> existing{" "}
                {outcome.updated === 1 ? "lead" : "leads"} refreshed
              </p>
              {/* Informational, not a failure: the search was capped, so the
                  user knows this is not necessarily the complete set. We do NOT
                  fetch the next page automatically. */}
              {outcome.truncated ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  Search reached the {outcome.limit ?? "result"} result limit. More matching
                  businesses may exist.
                </p>
              ) : null}
            </>
          )
        ) : null}
      </div>
    </Card>
  );
}
