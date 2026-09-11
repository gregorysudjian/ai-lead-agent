"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BUTTON_PRIMARY, BUTTON_SECONDARY, Card, INPUT, LINK, SectionHeading } from "./ui/primitives";

interface SearchHit {
  name: string;
  city: string;
  leadId: string;
  isNew: boolean;
  websiteListed: boolean;
}

interface SearchOutcome {
  discovered: number;
  created: number;
  updated: number;
  /** The provider capped this search, so more matches may exist upstream. */
  truncated: boolean;
  limit: number | null;
  /** How deep this search went, so "search deeper" knows where to go next. */
  depth: number;
  hits: SearchHit[];
}

/**
 * How far a "search deeper" reaches, in order.
 *
 * Discrete steps rather than a free number: each one is a deliberate, bounded
 * request against shared community infrastructure, and 200 is the provider's
 * ceiling. Nothing here pages automatically -- every step is a click.
 */
const SEARCH_DEPTHS = [60, 120, 200] as const;

function nextDepth(current: number): number | null {
  return SEARCH_DEPTHS.find((depth) => depth > current) ?? null;
}

/**
 * Business discovery form.
 *
 * A Client Component because it owns form state and request lifecycle. It calls
 * the existing POST /api/search -- no discovery logic is duplicated here -- then
 * refreshes the server-rendered lead data so counts and rows reflect the write.
 */
/**
 * Read the `hits` array from a search response.
 *
 * Defensive rather than trusting: this is our own API, but a client that
 * assumes a shape and gets a different one renders `undefined` into the page.
 * Anything unrecognised is skipped instead of becoming a blank row.
 */
function parseHits(value: unknown): SearchHit[] {
  if (!Array.isArray(value)) return [];

  const hits: SearchHit[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const hit = entry as { business?: unknown; leadId?: unknown; isNew?: unknown };
    if (typeof hit.business !== "object" || hit.business === null) continue;

    const business = hit.business as { name?: unknown; city?: unknown; website?: unknown };
    if (typeof business.name !== "string" || typeof hit.leadId !== "string") continue;

    hits.push({
      name: business.name,
      city: typeof business.city === "string" ? business.city : "",
      // Presence only. A missing website means "none found by this provider",
      // never "this business has none" -- the label below says exactly that.
      websiteListed: typeof business.website === "string" && business.website.length > 0,
      leadId: hit.leadId,
      isNew: hit.isNew === true,
    });
  }
  return hits;
}

/**
 * The businesses a search found, new ones first.
 *
 * The problem this solves: searching "Hair salon in Montreal" twice returns
 * the same sixty businesses both times, because Overpass answers in a stable
 * order. A flat list made the second search look productive when it had found
 * nothing the operator had not already seen. New results are listed and
 * counted; the rest collapse behind a disclosure.
 */
function SearchResults({ hits }: { hits: SearchHit[] }) {
  const fresh = hits.filter((hit) => hit.isNew);
  const known = hits.filter((hit) => !hit.isNew);

  if (hits.length === 0) return null;

  return (
    <div className="space-y-3">
      {fresh.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            New to you ({fresh.length})
          </h3>
          <ul className="mt-1.5 divide-y divide-slate-200 dark:divide-slate-800">
            {fresh.map((hit) => (
              <HitRow key={hit.leadId} hit={hit} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          Nothing new here — every result was already in your leads. Search deeper, or
          try another category or city.
        </p>
      )}

      {known.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold tracking-wide text-slate-500 uppercase hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Already in your leads ({known.length})
          </summary>
          <ul className="mt-1.5 divide-y divide-slate-200 dark:divide-slate-800">
            {known.map((hit) => (
              <HitRow key={hit.leadId} hit={hit} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function HitRow({ hit }: { hit: SearchHit }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <Link href={`/leads/${hit.leadId}`} className={`min-w-0 truncate ${LINK}`}>
        {hit.name}
      </Link>
      {/* "No website listed" is the honest phrasing: the provider listed none,
          which is not proof the business has none. */}
      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
        {hit.websiteListed ? "has a website" : "no website listed"}
      </span>
    </li>
  );
}

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
  const deeper = outcome ? nextDepth(outcome.depth) : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(SEARCH_DEPTHS[0]);
  }

  async function runSearch(depth: number) {
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
        body: JSON.stringify({ category, city, limit: depth }),
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
        depth,
        hits: parseHits(body.hits),
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
      {/* "and saves them" is doing real work in that sentence: the panel below
          this one takes the same two fields and saves nothing, so which of the
          two writes to the lead store has to be legible from the heading. */}
      <SectionHeading
        title="Find businesses"
        hint="Searches OpenStreetMap for businesses in a supported city and category, and saves what it finds to your leads."
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
              className="h-3 w-3 animate-pulse rounded-full motion-reduce:animate-none bg-indigo-500"
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
                <strong>{outcome.discovered}</strong> found ·{" "}
                <strong>{outcome.created}</strong> new to you ·{" "}
                <strong>{outcome.updated}</strong> already in your leads
              </p>

              <SearchResults hits={outcome.hits} />

              {/* The deliberate way past the result window. Overpass answers in
                  a stable order, so searching again at the same depth returns
                  the same businesses -- going deeper is the only thing that
                  finds new ones. One click, one request, and only up to the
                  provider's ceiling. */}
              {deeper !== null ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="text-slate-700 dark:text-slate-300">
                    {outcome.truncated
                      ? `Showing the first ${outcome.depth}. More matching businesses exist.`
                      : `Searched the first ${outcome.depth}.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => runSearch(deeper)}
                    disabled={busy}
                    className={`mt-2 ${BUTTON_SECONDARY}`}
                  >
                    Search deeper (first {deeper})
                  </button>
                </div>
              ) : outcome.truncated ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  Reached the {outcome.limit ?? "result"} result limit, which is as deep as one
                  search goes. Try a different category or city.
                </p>
              ) : null}
            </>
          )
        ) : null}
      </div>
    </Card>
  );
}
