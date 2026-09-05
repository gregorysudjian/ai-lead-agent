"use client";

import { useMemo, useState } from "react";

import { hasNoListedWebsite } from "@/lib/format";
import type { Lead } from "@/lib/types";

import { LeadCard } from "./lead-card";

type Filter = "all" | "new" | "reviewed" | "no-website";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "reviewed", label: "Reviewed" },
  { id: "no-website", label: "No website listed" },
];

/**
 * Stored leads, with counts and client-side filtering.
 *
 * A Client Component only because the filter is interactive. The data itself
 * still comes from the server: `leads` is a prop rendered by the Server
 * Component that read the repository, and every mutation triggers
 * `router.refresh()` rather than client-side cache surgery. Filtering the
 * already-loaded array is appropriate at development-data scale; real querying
 * belongs in the repository once there is a database behind it.
 */
export function LeadsSection({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((l) => l.status === "new").length,
      reviewed: leads.filter((l) => l.status === "reviewed").length,
      noWebsite: leads.filter(hasNoListedWebsite).length,
    }),
    [leads],
  );

  const visible = useMemo(() => {
    switch (filter) {
      case "new":
        return leads.filter((l) => l.status === "new");
      case "reviewed":
        return leads.filter((l) => l.status === "reviewed");
      case "no-website":
        return leads.filter(hasNoListedWebsite);
      default:
        return leads;
    }
  }, [leads, filter]);

  if (leads.length === 0) {
    return (
      <section aria-labelledby="leads-heading" className="mt-8">
        <h2 id="leads-heading" className="text-base font-semibold">
          Stored leads
        </h2>
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          No leads yet. Search for a business category and city to get started.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="leads-heading" className="mt-8">
      <h2 id="leads-heading" className="text-base font-semibold">
        Stored leads
      </h2>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Total leads" value={counts.total} />
        <SummaryTile label="New" value={counts.new} />
        <SummaryTile label="Reviewed" value={counts.reviewed} />
        <SummaryTile label="No website listed" value={counts.noWebsite} />
      </dl>

      <div role="group" aria-label="Filter leads" className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const active = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={active}
              className={
                active
                  ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-slate-100 dark:text-slate-900"
                  : "rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        Showing {visible.length} of {leads.length} leads
      </p>

      {visible.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          No leads match this filter.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {visible.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
