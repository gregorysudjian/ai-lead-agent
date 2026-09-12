import { hasNoListedWebsite } from "@/lib/format";
import { rankLeads } from "@/lib/scoring";
import type { Lead } from "@/lib/types";

/**
 * Derived summary counts.
 *
 * Everything here is computed from the leads passed in. Nothing is persisted --
 * these are a view of the current provider snapshots, not stored analytics.
 */
export function LeadCounts({ leads }: { leads: Lead[] }) {
  const scored = rankLeads(leads);

  const rows = [
    { label: "New", value: leads.filter((l) => l.status === "new").length },
    { label: "Reviewed", value: leads.filter((l) => l.status === "reviewed").length },
    { label: "High priority", value: scored.filter((s) => s.score.priority === "high").length },
    { label: "No website listed", value: leads.filter(hasNoListedWebsite).length },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs text-slate-600 dark:text-slate-400">{row.label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {row.value}
          </dd>
        </div>
      ))}
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
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
