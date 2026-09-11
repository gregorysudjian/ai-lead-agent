import { analysisProviderName, leadRepositoryName, websiteLookupName } from "@/server/env";

import { Badge, type BadgeTone } from "./ui/primitives";

/**
 * Which data sources this instance is actually wired to.
 *
 * A Server Component, and deliberately visible: configuration is easy to get
 * wrong, and a store or provider silently falling back to a mock is an
 * expensive mistake to notice late. Names only -- no URLs, no keys.
 *
 * Business data is named without a setting because there is none to get
 * wrong: the catalog is always built from Overture's open data. The live
 * search providers this strip used to report no longer feed anything the
 * operator sees, so showing them would describe a pipeline that is not there.
 */

const STORE_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  json: { label: "Local JSON file", tone: "amber" },
  supabase: { label: "Supabase", tone: "emerald" },
};

const ANALYSER_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  mock: { label: "Mock", tone: "amber" },
  anthropic: { label: "Claude (Anthropic)", tone: "indigo" },
};

function safely(read: () => string): string {
  try {
    return read();
  } catch {
    // An invalid env value throws by design; surface it rather than guessing.
    return "misconfigured";
  }
}

export function SystemStatus() {
  const store = safely(leadRepositoryName);
  const analyser = safely(analysisProviderName);
  const lookup = safely(websiteLookupName);

  const storeInfo = STORE_LABELS[store] ?? { label: store, tone: "rose" as BadgeTone };
  const analyserInfo = ANALYSER_LABELS[analyser] ?? { label: analyser, tone: "rose" as BadgeTone };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
      <span className="flex items-center gap-1.5">
        Lead store: <Badge tone={storeInfo.tone}>{storeInfo.label}</Badge>
      </span>
      <span className="flex items-center gap-1.5">
        Business data: <Badge tone="emerald">Overture Maps · monthly</Badge>
      </span>
      <span className="flex items-center gap-1.5">
        Analysis: <Badge tone={analyserInfo.tone}>{analyserInfo.label}</Badge>
      </span>
      <span className="flex items-center gap-1.5">
        Website lookup:{" "}
        <Badge tone={lookup === "off" ? "slate" : "indigo"}>
          {lookup === "off" ? "Off" : "Google Places (billable)"}
        </Badge>
      </span>
      {store === "json" ? (
        <span className="text-amber-700 dark:text-amber-400">
          The local store keeps the business database in memory only; it is empty after every
          restart.
        </span>
      ) : null}
    </div>
  );
}
