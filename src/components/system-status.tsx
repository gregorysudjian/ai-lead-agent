import { leadRepositoryName, placesProviderName } from "@/server/env";

import { Badge, type BadgeTone } from "./ui/primitives";

/**
 * Which data sources this instance is actually wired to.
 *
 * A Server Component, and deliberately visible: the configuration is easy to
 * get wrong (an unset PLACES_PROVIDER silently means "mock"), and a search that
 * quietly stores fixture data into a real database is an expensive mistake to
 * notice late. Names only -- no URLs, no keys.
 */

const STORE_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  json: { label: "Local JSON file", tone: "amber" },
  supabase: { label: "Supabase", tone: "emerald" },
};

const PROVIDER_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  mock: { label: "Mock fixtures", tone: "amber" },
  osm: { label: "OpenStreetMap", tone: "emerald" },
  google: { label: "Google Places", tone: "slate" },
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
  const provider = safely(placesProviderName);

  const storeInfo = STORE_LABELS[store] ?? { label: store, tone: "rose" as BadgeTone };
  const providerInfo = PROVIDER_LABELS[provider] ?? {
    label: provider,
    tone: "rose" as BadgeTone,
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
      <span className="flex items-center gap-1.5">
        Lead store: <Badge tone={storeInfo.tone}>{storeInfo.label}</Badge>
      </span>
      <span className="flex items-center gap-1.5">
        Discovery provider: <Badge tone={providerInfo.tone}>{providerInfo.label}</Badge>
      </span>
      {provider === "mock" ? (
        <span className="text-amber-700 dark:text-amber-400">
          Searches return fixture data, not real businesses.
        </span>
      ) : null}
    </div>
  );
}
