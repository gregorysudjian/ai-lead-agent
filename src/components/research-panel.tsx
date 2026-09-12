"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  BusinessProfile,
  Observation,
  ProfileField,
  ResearchArea,
} from "@/lib/business-profile";
import {
  LEAD_SNAPSHOT_SOURCE_ID,
  PROFILE_FIELDS,
  PROFILE_FIELD_LIST,
  RESEARCH_AREA_LABELS,
  RESEARCH_AREA_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  allValues,
  resolveField,
} from "@/lib/business-profile";
import { classifyWebsite } from "@/lib/format";

import { BUTTON_PRIMARY, BUTTON_SECONDARY, Badge, Card, Disclosure, LINK, SectionHeading } from "./ui/primitives";
import type { BadgeTone } from "./ui/primitives";
import { Timestamp } from "./ui/timestamp";

/**
 * The research workspace for one lead.
 *
 * A Client Component because it owns the request lifecycle: POST, then
 * `router.refresh()` so the server re-reads the store and stays the source of
 * truth. It never renders a profile it has not seen come back from the server.
 *
 * ── WHAT THIS PANEL IS FOR ────────────────────────────────────────────────
 *
 * To make the difference between three kinds of statement visible, because the
 * whole system depends on nobody confusing them:
 *
 *   the cards above     what one discovery provider listed
 *   THIS panel          what we have LEARNED, each value naming its source
 *   the panels below    what an analyser PROPOSES, and what a generator wrote
 *
 * So every value here carries a source badge, and nothing is styled like the
 * AI panels. A field with no value says which is true -- nobody looked, or a
 * source was consulted and held nothing -- because reading "no services" as
 * "this business offers none" would be exactly the mistake this record exists
 * to prevent.
 */

const AREAS = Object.keys(RESEARCH_AREA_LABELS) as ResearchArea[];

/**
 * What a run would actually do, said plainly.
 *
 * The difference matters to whoever presses the button: one mode consults
 * nothing, the other reaches out to a real business's server.
 */
const RESEARCHER_LABELS: Record<string, string> = {
  mock: "Offline researcher",
  website: "Website research",
};

const STATUS_TONES: Record<string, BadgeTone> = {
  covered: "emerald",
  "not-researched": "slate",
  unavailable: "amber",
};

export function ResearchPanel({
  leadId,
  profiles,
  researcher,
}: {
  leadId: string;
  profiles: BusinessProfile[];
  /** The researcher a NEW run would use. */
  researcher: { name: string; version: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const busy = isResearching || isRefreshing;
  const selected = profiles.find((p) => p.id === selectedId) ?? profiles[0] ?? null;

  async function handleResearch() {
    if (busy) return;
    setIsResearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/research`, { method: "POST" });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not research this business. Please try again.",
        );
        return;
      }

      setSelectedId(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsResearching(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          title="Research"
          hint="What we could confirm about this business. Every value names its source; nothing is inferred."
        />
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            tone={researcher.name === "mock" ? "amber" : "emerald"}
            title={
              researcher.name === "mock"
                ? "Offline: consults no external source and makes no request"
                : `Fetches the listed website's homepage · ${researcher.version}`
            }
          >
            {RESEARCHER_LABELS[researcher.name] ?? researcher.name}
          </Badge>
          <button
            type="button"
            onClick={handleResearch}
            disabled={busy}
            title={
              researcher.name === "website"
                ? "Fetches robots.txt and the homepage of the website listed on this lead"
                : undefined
            }
            className={BUTTON_PRIMARY}
          >
            {busy ? "Researching…" : profiles.length > 0 ? "Re-run research" : "Research business"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="mt-3">
        {busy ? (
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span aria-hidden="true" className="h-3 w-3 animate-pulse rounded-full motion-reduce:animate-none bg-emerald-500" />
            {researcher.name === "website"
              ? "Reading the listed website…"
              : "Gathering what we can source…"}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}
      </div>

      {selected === null ? (
        !busy ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Not researched yet. A run records what we can source about this business, with a
            reference for every value.
            {researcher.name === "website"
              ? " This lead's listed website would be fetched once, homepage only."
              : " Nothing would be fetched: the offline researcher consults no external source."}
          </p>
        ) : null
      ) : (
        <ProfileView profile={selected} />
      )}

      {profiles.length > 1 ? (
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Previous research</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {profiles.map((profile, index) => {
              const active = profile.id === selected?.id;
              return (
                <li key={profile.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(profile.id)}
                    aria-pressed={active}
                    className={active ? `${BUTTON_SECONDARY} ring-2 ring-emerald-500` : BUTTON_SECONDARY}
                  >
                    {index === 0 ? "Latest" : `Run ${profiles.length - index}`}
                    <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                      <Timestamp iso={profile.createdAt} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * One profile, calmest first.
 *
 * The page's header already shows what the listing says, so this view leads
 * with what research ADDED, each value with its source. Facts that only repeat
 * the stored listing, and the full list of sources, are folded under one line
 * -- still in the page, still attributed. The coverage chips stay on top:
 * they are how "nobody looked" is told apart from "looked and found nothing".
 */
function ProfileView({ profile }: { profile: BusinessProfile }) {
  const coverageByArea = new Map(profile.coverage.map((c) => [c.area, c]));
  const sourceById = new Map(profile.sources.map((s) => [s.id, s]));

  const present = PROFILE_FIELD_LIST.filter((f) => profile.facts[f].length > 0);
  const fromListingOnly = (f: ProfileField) =>
    profile.facts[f].every((observation) => observation.sourceId === LEAD_SNAPSHOT_SOURCE_ID);
  const learned = present.filter((f) => !fromListingOnly(f));
  const listingOnly = present.filter(fromListingOnly);

  return (
    <div className="mt-4 space-y-5">
      {/* COVERAGE -- what was looked at, before anything about what was found. */}
      <ul className="flex flex-wrap gap-2" aria-label="What this run looked at">
        {AREAS.map((area) => {
          const coverage = coverageByArea.get(area);
          if (!coverage) return null;
          return (
            <li key={area}>
              <Badge tone={STATUS_TONES[coverage.status] ?? "slate"} title={coverage.note}>
                {RESEARCH_AREA_LABELS[area]}: {RESEARCH_AREA_STATUS_LABELS[coverage.status]}
              </Badge>
            </li>
          );
        })}
      </ul>

      {/* WHAT RESEARCH ADDED -- grouped by area, each value naming its source. */}
      {learned.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Nothing beyond what the listing already says.
        </p>
      ) : (
        AREAS.map((area) => {
          const fields = learned.filter((f) => PROFILE_FIELDS[f].area === area);
          if (fields.length === 0) return null;
          return (
            <section key={area}>
              <h3 className="text-sm font-semibold">{RESEARCH_AREA_LABELS[area]}</h3>
              <dl className="mt-2 space-y-3">
                {fields.map((field) => (
                  <FactRow key={field} field={field} profile={profile} />
                ))}
              </dl>
            </section>
          );
        })
      )}

      {profile.limitations.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold">Keep in mind</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            {profile.limitations.map((limitation) => (
              <li key={limitation} className="flex gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                <span>{limitation}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Disclosure
        summary={`Sources${listingOnly.length > 0 ? " and what the listing says" : ""} (${sourceById.size})`}
      >
        <div className="space-y-5 border-l-2 border-slate-200 pl-4 dark:border-slate-800">
          {listingOnly.length > 0 ? (
            <dl className="space-y-3">
              {listingOnly.map((field) => (
                <FactRow key={field} field={field} profile={profile} />
              ))}
            </dl>
          ) : null}

          {/* SOURCES -- the answer to "where did we learn this?", in full. */}
          <ul className="space-y-2">
            {profile.sources.map((source) => (
              <li key={source.id} className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {SOURCE_TYPE_LABELS[source.type]}
                </span>
                {source.title ? ` · ${source.title}` : null} ·{" "}
                <code className="font-mono break-all">{source.reference}</code> · read{" "}
                <Timestamp iso={source.fetchedAt} />
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Researched <Timestamp iso={profile.createdAt} /> by {profile.researcher.name} (
            {profile.researcher.version}). {sourceById.size}{" "}
            {sourceById.size === 1 ? "source" : "sources"} consulted.
          </p>
        </div>
      </Disclosure>
    </div>
  );
}

/**
 * One field.
 *
 * Two shapes, because two things can be true of a field holding several
 * observations. A `multiple` field -- social profiles, opening hours -- expects
 * several DISTINCT values, and showing the second one as "another source
 * disagreed" would misread a business's Instagram and Facebook links as a
 * contradiction. Every other field expects one value, so extra observations
 * genuinely are conflicting evidence and are shown as such.
 */
function FactRow({ field, profile }: { field: ProfileField; profile: BusinessProfile }) {
  const spec = PROFILE_FIELDS[field];
  if (spec.multiple === true) {
    const values = allValues(profile.facts, field, profile.sources);
    if (values.length === 0) return null;

    return (
      <div className="min-w-0">
        <dt className="text-xs text-slate-600 dark:text-slate-400">{spec.label}</dt>
        <dd className="mt-0.5 space-y-1 text-sm">
          {values.map((observation, i) => (
            <div key={`${observation.sourceId}-${i}`}>
              <ObservationValue observation={observation} isUrl={spec.url === true} />
              <SourceTag
                label={SOURCE_TYPE_LABELS[sourceFor(profile, observation.sourceId)]}
                kind={observation.kind}
              />
            </div>
          ))}
        </dd>
      </div>
    );
  }

  const resolved = resolveField(profile.facts, field, profile.sources);
  if (!resolved) return null;

  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-600 dark:text-slate-400">{spec.label}</dt>
      <dd className="mt-0.5 text-sm">
        <ObservationValue observation={resolved.observation} isUrl={spec.url === true} />
        <SourceTag
          label={SOURCE_TYPE_LABELS[resolved.source.type]}
          kind={resolved.observation.kind}
        />

        {resolved.conflicting.length > 0 ? (
          <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {/* Conflicting evidence is shown, never discarded. The preferred
                value above is a reading order, not a verdict. */}
            <p className="font-medium">
              {resolved.conflicting.length === 1 ? "Another source" : "Other sources"} recorded a
              different value:
            </p>
            <ul className="mt-1 space-y-0.5">
              {resolved.conflicting.map((observation, i) => (
                <li key={`${observation.sourceId}-${i}`}>
                  {String(observation.value)}{" "}
                  <span className="opacity-80">
                    ({SOURCE_TYPE_LABELS[sourceFor(profile, observation.sourceId)]})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </dd>
    </div>
  );
}

/** The type of the source an observation cites. */
function sourceFor(profile: BusinessProfile, sourceId: string) {
  return profile.sources.find((s) => s.id === sourceId)?.type ?? "directory";
}

function ObservationValue({ observation, isUrl }: { observation: Observation; isUrl: boolean }) {
  const text = String(observation.value);

  if (isUrl) {
    // Same allowlist the lead page applies: only an absolute http(s) URL is
    // ever made clickable, whatever a source contained.
    const website = classifyWebsite(text);
    if (website.kind === "linkable") {
      return (
        <a href={website.href} target="_blank" rel="noopener noreferrer" className={`break-all ${LINK}`}>
          {website.href}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      );
    }
    return <span className="font-mono text-xs break-all">{text}</span>;
  }

  return <span className="break-words">{text}</span>;
}

function SourceTag({ label, kind }: { label: string; kind: Observation["kind"] }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 align-middle text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      {/* "stated" means the source said it; "observed" means we read it out of
          a record. Neither means anyone verified it. */}
      {kind === "stated" ? "stated by" : "observed in"} {label}
    </span>
  );
}
