import { hasNoListedWebsite } from "@/lib/format";
import { rankLeads } from "@/lib/scoring";
import type { Lead } from "@/lib/types";

import { StatTile } from "./ui/primitives";

/**
 * Derived summary counts.
 *
 * Everything here is computed from the leads passed in. Nothing is persisted --
 * these are a view of the current provider snapshots, not stored analytics.
 */
export function LeadSummary({ leads }: { leads: Lead[] }) {
  const scored = rankLeads(leads);

  const counts = {
    total: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    reviewed: leads.filter((l) => l.status === "reviewed").length,
    high: scored.filter((s) => s.score.priority === "high").length,
    noWebsite: leads.filter(hasNoListedWebsite).length,
  };

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile label="Total leads" value={counts.total} />
      <StatTile label="New" value={counts.new} tone="neutral" />
      <StatTile label="Reviewed" value={counts.reviewed} tone="emerald" />
      <StatTile label="High priority" value={counts.high} tone="rose" hint="Score 70+" />
      <StatTile
        label="No website listed"
        value={counts.noWebsite}
        tone="amber"
        hint="By provider"
      />
    </dl>
  );
}

/** Simple deterministic distribution bars. No chart library. */
export function PriorityDistribution({ leads }: { leads: Lead[] }) {
  const scored = rankLeads(leads);
  const total = scored.length;
  if (total === 0) return null;

  const bands = [
    { key: "high", label: "High", tone: "bg-rose-500" },
    { key: "medium", label: "Medium", tone: "bg-amber-500" },
    { key: "low", label: "Low", tone: "bg-slate-400" },
  ] as const;

  return (
    <div className="space-y-2">
      {bands.map((band) => {
        const count = scored.filter((s) => s.score.priority === band.key).length;
        const percent = Math.round((count / total) * 100);
        return (
          <div key={band.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-slate-600 dark:text-slate-400">
              {band.label}
            </span>
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
              role="img"
              aria-label={`${band.label} priority: ${count} of ${total} leads (${percent}%)`}
            >
              <div className={`h-full ${band.tone}`} style={{ width: `${percent}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
              {count} · {percent}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Top categories by lead count. Derived, not persisted. */
export function CategoryBreakdown({ leads }: { leads: Lead[] }) {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    counts.set(lead.provider.category, (counts.get(lead.provider.category) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))
    .slice(0, 8);

  if (rows.length === 0) return null;
  const max = rows[0][1];

  return (
    <ul className="space-y-2">
      {rows.map(([category, count]) => (
        <li key={category} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-slate-700 dark:text-slate-300">
            {category}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full bg-indigo-500"
              style={{ width: `${Math.round((count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
            {count}
          </span>
        </li>
      ))}
    </ul>
  );
}
