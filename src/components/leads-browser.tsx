"use client";

import { useMemo, useState } from "react";

import { hasNoListedWebsite } from "@/lib/format";
import { normalizeTerm } from "@/lib/normalize";
import { rankLeads, type LeadPriority } from "@/lib/scoring";
import type { Lead } from "@/lib/types";

import { OsmAttribution } from "./attribution";
import { LeadRow } from "./lead-row";
import { BUTTON_SECONDARY, Card, EmptyState, FOCUS_RING, INPUT } from "./ui/primitives";

type StatusFilter = "all" | "new" | "reviewed" | "no-website";

/**
 * Rows rendered before the user asks for more.
 *
 * Purely a presentation cap: every lead is already loaded and filtered, so
 * counts and filters always reflect the whole set. It exists because a few
 * hundred rows makes a 10,000px page that is hard to scan.
 */
const INITIAL_ROWS = 50;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "reviewed", label: "Reviewed" },
  { id: "no-website", label: "No website listed" },
];

const PRIORITIES: { id: LeadPriority | "all"; label: string }[] = [
  { id: "all", label: "Any priority" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

/**
 * Lead browsing: ranking, filtering and presentation.
 *
 * A Client Component only because the filters are interactive. The data still
 * comes from the server: `leads` is a prop rendered by the Server Component that
 * read the repository, and every mutation triggers `router.refresh()`.
 *
 * Scores are computed here from the current provider snapshot, never read from
 * storage. Leads are ranked first and filtered afterwards, so every filter shows
 * the same ordering.
 */
export function LeadsBrowser({ leads }: { leads: Lead[] }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<LeadPriority | "all">("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const ranked = useMemo(() => rankLeads(leads), [leads]);

  const categories = useMemo(() => {
    const seen = new Set(leads.map((l) => l.provider.category));
    return [...seen].sort((a, b) => a.localeCompare(b, "en"));
  }, [leads]);

  const showsOsmData = useMemo(
    () => leads.some((lead) => lead.provider.source === "osm"),
    [leads],
  );

  const visible = useMemo(() => {
    const needle = normalizeTerm(query);

    return ranked.filter(({ lead, score }) => {
      if (status === "new" && lead.status !== "new") return false;
      if (status === "reviewed" && lead.status !== "reviewed") return false;
      if (status === "no-website" && !hasNoListedWebsite(lead)) return false;
      if (priority !== "all" && score.priority !== priority) return false;
      if (category !== "all" && lead.provider.category !== category) return false;
      if (needle.length > 0 && !normalizeTerm(lead.provider.name).includes(needle)) return false;
      return true;
    });
  }, [ranked, status, priority, category, query]);

  // A narrowed result set should be fully visible without another click.
  const visibleKey = `${status}|${priority}|${category}|${query}`;
  const [lastKey, setLastKey] = useState(visibleKey);
  if (visibleKey !== lastKey) {
    setLastKey(visibleKey);
    if (showAll) setShowAll(false);
  }

  const filtersActive =
    status !== "all" || priority !== "all" || category !== "all" || query.trim().length > 0;

  function resetFilters() {
    setStatus("all");
    setPriority("all");
    setCategory("all");
    setQuery("");
  }

  const shown = showAll ? visible : visible.slice(0, INITIAL_ROWS);
  const hidden = visible.length - shown.length;

  if (leads.length === 0) {
    return (
      <EmptyState
        title="No leads yet"
        description="Search for a business category and city to discover leads. Nothing is contacted automatically — every lead is reviewed by you."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
          <div>
            <label htmlFor="lead-search" className="sr-only">
              Search business names
            </label>
            <input
              id="lead-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search business names..."
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="priority-filter" className="sr-only">
              Filter by priority
            </label>
            <select
              id="priority-filter"
              value={priority}
              onChange={(e) => setPriority(e.target.value as LeadPriority | "all")}
              className={INPUT}
            >
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="category-filter" className="sr-only">
              Filter by category
            </label>
            <select
              id="category-filter"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={INPUT}
            >
              <option value="all">Any category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter leads by status" className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((option) => {
              const active = status === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStatus(option.id)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${FOCUS_RING} ${
                    active
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {filtersActive ? (
            <button type="button" onClick={resetFilters} className={BUTTON_SECONDARY}>
              Clear filters
            </button>
          ) : null}
        </div>

        <p aria-live="polite" className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Showing <strong className="tabular-nums">{visible.length}</strong> of{" "}
          <strong className="tabular-nums">{leads.length}</strong> leads
          {hidden > 0 ? ` · ${INITIAL_ROWS} displayed` : ""}
        </p>
      </Card>

      {visible.length === 0 ? (
        <EmptyState
          title="No leads match these filters"
          description="Try clearing a filter or widening your search."
          action={
            <button type="button" onClick={resetFilters} className={BUTTON_SECONDARY}>
              Clear filters
            </button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {/*
            Horizontal scroll is contained here so the page never overflows.
            `relative` matters: sr-only text is position:absolute, and without a
            positioned ancestor it resolves against the initial containing block,
            escaping this scroller and widening the whole document.
          */}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <caption className="sr-only">
                Discovered leads, ordered by deterministic lead priority
              </caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900/60">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Business</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contact</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Web presence</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Priority</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {shown.map(({ lead, score }) => (
                  <LeadRow key={lead.id} lead={lead} score={score} />
                ))}
              </tbody>
            </table>
          </div>

          {hidden > 0 ? (
            <div className="border-t border-slate-200 p-3 text-center dark:border-slate-800">
              <button type="button" onClick={() => setShowAll(true)} className={BUTTON_SECONDARY}>
                Show {hidden} more {hidden === 1 ? "lead" : "leads"}
              </button>
            </div>
          ) : null}
        </Card>
      )}

      {showsOsmData ? <OsmAttribution /> : null}

      <p className="text-xs text-slate-500 dark:text-slate-500">
        Lead priority is a deterministic review-order score derived from provider-listed
        signals. It is not a prediction of purchase intent, and not proof that a business
        lacks a website.
      </p>
    </div>
  );
}
