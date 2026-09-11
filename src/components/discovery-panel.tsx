"use client";

import { useState } from "react";

import {
  CANDIDATE_STATE_LABELS,
  DISCOVERY_SOURCE_LABELS,
  type DiscoveryCandidate,
  type DiscoverySourceName,
} from "@/lib/discovery/candidates";
import { classifyWebsite } from "@/lib/format";

import {
  Badge,
  BUTTON_SECONDARY,
  Card,
  FOCUS_RING,
  INPUT,
  LINK,
  type BadgeTone,
} from "./ui/primitives";

/**
 * Multi-source discovery.
 *
 * A preview, and labelled as one: this panel writes nothing. It shows what each
 * configured source found, which candidates we already hold as leads, and which
 * sources failed. Saving OpenStreetMap results is still the "Find businesses"
 * search above it.
 *
 * A Client Component because it owns form state and a request lifecycle. It
 * knows the NAMES of the enabled sources and nothing else about them -- no
 * endpoint, no credential, no provider payload ever reaches this file.
 */

interface SourceStatus {
  source: DiscoverySourceName;
  status: "ok" | "failed";
  count?: number;
  truncated?: boolean;
  limit?: number | null;
  reason?: string;
  message?: string;
}

interface DiscoveryOutcome {
  candidates: DiscoveryCandidate[];
  sources: SourceStatus[];
  truncated: boolean;
}

const STATE_TONES: Record<string, BadgeTone> = {
  "in-leads": "emerald",
  "can-add": "indigo",
  "candidate-only": "amber",
};

const SOURCE_TONES: Record<DiscoverySourceName, BadgeTone> = {
  osm: "emerald",
  google: "indigo",
  mock: "amber",
};

export function DiscoveryPanel({
  availableSources,
}: {
  availableSources: DiscoverySourceName[];
}) {
  const [category, setCategory] = useState("Barber shop");
  const [city, setCity] = useState("Montreal");
  const [selected, setSelected] = useState<DiscoverySourceName[]>(availableSources);
  const [outcome, setOutcome] = useState<DiscoveryOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleSource(source: DiscoverySourceName) {
    setSelected((current) =>
      current.includes(source)
        ? current.filter((name) => name !== source)
        : [...current, source],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (selected.length === 0) {
      setError("Select at least one source.");
      return;
    }

    setBusy(true);
    setError(null);
    setSupported(null);
    setOutcome(null);

    try {
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, category, sources: selected }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(typeof body?.error === "string" ? body.error : "Discovery failed.");
        const list =
          body?.supported?.categories ?? body?.supported?.cities ?? body?.supported?.sources;
        if (Array.isArray(list)) setSupported(list);
        // Even a total failure carries per-source statuses worth showing.
        if (Array.isArray(body?.sources)) {
          setOutcome({ candidates: [], sources: body.sources, truncated: false });
        }
        return;
      }

      setOutcome({
        candidates: Array.isArray(body.candidates) ? body.candidates : [],
        sources: Array.isArray(body.sources) ? body.sources : [],
        truncated: body.truncated === true,
      });
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section">
      {/*
        Collapsed by default, and that is the point.

        This panel and "Find businesses" above it had the same two fields, the
        same layout and the same prefilled city, sitting one card apart -- but
        that one SAVES what it finds and this one saves nothing. Two identical
        forms with opposite consequences is not a difference a one-line hint
        can carry, so the destructive one is the only search on the page by
        default, and this one is a comparison tool you deliberately open.

        A `<details>` rather than another `useState`: the browser already does
        disclosure, and it works before hydration.
      */}
      <details className="group">
        <summary
          className={`flex cursor-pointer list-none items-start justify-between gap-3 rounded-xl p-5 hover:bg-slate-50 [&::-webkit-details-marker]:hidden dark:hover:bg-slate-800/50 ${FOCUS_RING}`}
        >
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Compare sources
              <Badge tone="slate">Preview · saves nothing</Badge>
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Asks every enabled source the same question and groups the answers, so you
              can see what each one knows. Nothing here is written to your leads.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span className="group-open:hidden">Open</span>
            <span className="hidden group-open:inline">Close</span>
          </span>
        </summary>

        <div className="border-t border-slate-200 p-5 dark:border-slate-800">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label htmlFor="discovery-category" className="block text-sm font-medium">
                Category
              </label>
              <input
                id="discovery-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                autoComplete="off"
                className={`mt-1 ${INPUT}`}
              />
            </div>

            <div>
              <label htmlFor="discovery-city" className="block text-sm font-medium">
                City
              </label>
              <input
                id="discovery-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                autoComplete="off"
                className={`mt-1 ${INPUT}`}
              />
            </div>

            <div className="flex items-end">
              <button type="submit" disabled={busy} className={`${BUTTON_SECONDARY} w-full sm:w-auto`}>
                {busy ? "Comparing…" : "Compare sources"}
              </button>
            </div>
          </form>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Sources</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {availableSources.map((source) => (
                <label key={source} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(source)}
                    onChange={() => toggleSource(source)}
                    className="h-4 w-4"
                  />
                  {DISCOVERY_SOURCE_LABELS[source]}
                </label>
              ))}
            </div>
            {availableSources.length === 1 ? (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Only one source is enabled on this server. Set DISCOVERY_SOURCES to enable more.
              </p>
            ) : null}
          </fieldset>

          <div aria-live="polite" className="mt-4 space-y-3 text-sm">
            {busy ? (
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span aria-hidden="true" className="h-3 w-3 animate-pulse rounded-full motion-reduce:animate-none bg-indigo-500" />
                Asking {selected.length} {selected.length === 1 ? "source" : "sources"}…
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

            {outcome ? (
              <>
                <SourceStatusList statuses={outcome.sources} />

                {outcome.truncated ? (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    At least one source reached its result limit. More matching businesses may
                    exist — nothing is fetched automatically.
                  </p>
                ) : null}

                {outcome.candidates.length === 0 && !error ? (
                  <p className="text-slate-600 dark:text-slate-400">
                    No candidates from the sources that answered.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                    {outcome.candidates.map((candidate) => (
                      <CandidateRow key={candidate.candidateId} candidate={candidate} />
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </div>
        </div>
      </details>
    </Card>
  );
}

/**
 * One line per source, whatever happened to it.
 *
 * A failure is shown as a failure. It is never folded into the candidate count,
 * because "Google returned nothing" and "Google could not be reached" lead to
 * opposite conclusions about the city.
 */
function SourceStatusList({ statuses }: { statuses: SourceStatus[] }) {
  if (statuses.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
      {statuses.map((status) => (
        <li key={status.source} className="flex items-center gap-1.5">
          <Badge tone={status.status === "ok" ? SOURCE_TONES[status.source] : "rose"}>
            {DISCOVERY_SOURCE_LABELS[status.source] ?? status.source}
          </Badge>
          {status.status === "ok" ? (
            <span>
              {status.count} {status.count === 1 ? "result" : "results"}
              {status.truncated ? ` (capped at ${status.limit ?? "the limit"})` : ""}
            </span>
          ) : (
            <span className="text-rose-700 dark:text-rose-300">
              failed — {status.message ?? "no results from this source"}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function CandidateRow({ candidate }: { candidate: DiscoveryCandidate }) {
  const { display } = candidate;
  const website = display.website ? classifyWebsite(display.website.value) : null;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{display.name.value}</span>
        <Badge tone={STATE_TONES[candidate.state] ?? "slate"}>
          {CANDIDATE_STATE_LABELS[candidate.state]}
        </Badge>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        <span>Found by:</span>
        {candidate.foundBy.map((source) => (
          <Badge key={source} tone={SOURCE_TONES[source]}>
            {DISCOVERY_SOURCE_LABELS[source]}
          </Badge>
        ))}
        {candidate.matchedBy.length > 0 ? (
          <span className="opacity-80">· matched on {candidate.matchedBy.join(", ")}</span>
        ) : null}
      </div>

      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        {display.category.value}
        {display.address ? ` · ${display.address.value}` : ""}
        {display.phone ? ` · ${display.phone.value}` : ""}
      </p>

      <p className="mt-1 text-xs">
        {display.websiteListedBy.length === 0 ? (
          // Never "has no website": no source listed one, which is a different
          // and much weaker statement, and the one the data supports.
          <span className="text-slate-600 dark:text-slate-400">
            No website listed by{" "}
            {candidate.foundBy.length === 1 ? "this source" : "any source"}
          </span>
        ) : website && website.kind === "linkable" ? (
          <a
            href={website.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={LINK}
          >
            {website.href}
          </a>
        ) : (
          <span className="text-slate-600 dark:text-slate-400">
            Website listed by {display.websiteListedBy.join(", ")}
          </span>
        )}
      </p>
    </li>
  );
}
