"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface SearchOutcome {
  discovered: number;
  created: number;
  updated: number;
  /** The provider capped this search, so more matches may exist upstream. */
  truncated: boolean;
  limit: number | null;
}

/**
 * The discovery search form.
 *
 * A Client Component because it owns form state and request lifecycle. It calls
 * the existing POST /api/search -- no discovery logic is duplicated here -- then
 * refreshes the server-rendered lead list so counts and rows reflect the write.
 */
export function SearchPanel() {
  const router = useRouter();
  const [category, setCategory] = useState("Hair salons");
  const [city, setCity] = useState("Montreal");
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, startTransition] = useTransition();

  const busy = isSearching || isRefreshing;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guard against a double submit landing while a request is in flight.
    if (busy) return;

    setIsSearching(true);
    setError(null);
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
    <section
      aria-labelledby="search-heading"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <h2 id="search-heading" className="text-base font-semibold">
        Find businesses
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="category" className="block text-sm font-medium">
            Category
          </label>
          <input
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-600 dark:bg-slate-950"
          />
        </div>

        <div className="flex-1">
          <label htmlFor="city" className="block text-sm font-medium">
            City
          </label>
          <input
            id="city"
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-600 dark:bg-slate-950"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Searching..." : "Search"}
        </button>
      </form>

      <div aria-live="polite" className="mt-3 text-sm">
        {busy ? <p className="text-slate-600 dark:text-slate-400">Searching...</p> : null}

        {error ? (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}

        {outcome && !busy && !error ? (
          outcome.discovered === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">
              No businesses found for that category and city.
            </p>
          ) : (
            <>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>{outcome.discovered}</strong> businesses discovered &middot;{" "}
                <strong>{outcome.created}</strong> new{" "}
                {outcome.created === 1 ? "lead" : "leads"} &middot;{" "}
                <strong>{outcome.updated}</strong> existing{" "}
                {outcome.updated === 1 ? "lead" : "leads"} refreshed
              </p>
              {/* Informational, not a failure: the search was capped, so the
                  user knows this is not necessarily the complete set. We do NOT
                  fetch the next page automatically. */}
              {outcome.truncated ? (
                <p className="mt-1 text-slate-600 dark:text-slate-400">
                  Search reached the {outcome.limit ?? "result"} result limit. More
                  matching businesses may exist.
                </p>
              ) : null}
            </>
          )
        ) : null}
      </div>
    </section>
  );
}
