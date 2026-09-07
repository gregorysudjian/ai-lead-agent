import {
  analysisProviderName,
  discoverySourceNames,
  leadRepositoryName,
  placesProviderName,
  websiteLookupName,
} from "@/server/env";
import { DISCOVERY_SOURCE_LABELS } from "@/lib/discovery/candidates";

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

const ANALYSER_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  mock: { label: "Mock", tone: "amber" },
  anthropic: { label: "Claude (Anthropic)", tone: "indigo" },
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

/** Same contract for the list-valued setting: a bad value is shown, not hidden. */
function safelyList(read: () => string[]): string[] | null {
  try {
    return read();
  } catch {
    return null;
  }
}

export function SystemStatus() {
  const store = safely(leadRepositoryName);
  const provider = safely(placesProviderName);
  const analyser = safely(analysisProviderName);
  // Names only -- never a URL and never a key.
  const discovery = safelyList(discoverySourceNames);
  const lookup = safely(websiteLookupName);

  const storeInfo = STORE_LABELS[store] ?? { label: store, tone: "rose" as BadgeTone };
  const providerInfo = PROVIDER_LABELS[provider] ?? {
    label: provider,
    tone: "rose" as BadgeTone,
  };
  const analyserInfo = ANALYSER_LABELS[analyser] ?? {
    label: analyser,
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
      <span className="flex items-center gap-1.5">
        Analysis provider: <Badge tone={analyserInfo.tone}>{analyserInfo.label}</Badge>
      </span>
      <span className="flex items-center gap-1.5">
        Discovery sources:{" "}
        {discovery === null ? (
          <Badge tone="rose">misconfigured</Badge>
        ) : (
          discovery.map((name) => (
            <Badge key={name} tone={PROVIDER_LABELS[name]?.tone ?? "rose"}>
              {DISCOVERY_SOURCE_LABELS[name as keyof typeof DISCOVERY_SOURCE_LABELS] ?? name}
            </Badge>
          ))
        )}
      </span>
      <span className="flex items-center gap-1.5">
        Website lookup:{" "}
        <Badge tone={lookup === "off" ? "slate" : "indigo"}>
          {lookup === "off" ? "Off" : "Google Places (billable)"}
        </Badge>
      </span>
      {provider === "mock" ? (
        <span className="text-amber-700 dark:text-amber-400">
          Searches return fixture data, not real businesses.
        </span>
      ) : null}
    </div>
  );
}
