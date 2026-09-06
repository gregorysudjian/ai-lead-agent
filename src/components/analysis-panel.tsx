"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { RECOMMENDED_SITE_TYPE_LABELS, type Analysis } from "@/lib/analysis";

import { BUTTON_PRIMARY, BUTTON_SECONDARY, Badge, Card, SectionHeading } from "./ui/primitives";

/**
 * The website-strategy workspace for one lead.
 *
 * A Client Component because it owns the request lifecycle. It POSTs to the
 * existing route and then calls `router.refresh()`, so the server re-reads the
 * stored analyses and stays the source of truth.
 *
 * The latest analysis is shown by default; earlier runs are listed underneath.
 */
export function AnalysisPanel({
  leadId,
  analyses,
  providerIsMock,
}: {
  leadId: string;
  analyses: Analysis[];
  providerIsMock: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const busy = isAnalysing || isRefreshing;
  const selected = analyses.find((a) => a.id === selectedId) ?? analyses[0] ?? null;

  async function handleAnalyse() {
    if (busy) return;
    setIsAnalysing(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/analysis`, { method: "POST" });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not analyse this lead. Please try again.",
        );
        return;
      }

      setSelectedId(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsAnalysing(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          title="Website strategy"
          hint="AI-generated recommendations. Provider-listed facts are shown separately and are not invented."
        />
        <div className="flex shrink-0 items-center gap-2">
          {providerIsMock ? (
            <Badge tone="amber" title="No language model is connected; output is rule-based">
              Mock analyser
            </Badge>
          ) : null}
          <button type="button" onClick={handleAnalyse} disabled={busy} className={BUTTON_PRIMARY}>
            {busy ? "Analyzing…" : analyses.length > 0 ? "Re-analyze" : "Analyze business"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="mt-3">
        {busy ? (
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span aria-hidden="true" className="h-3 w-3 animate-pulse rounded-full bg-indigo-500" />
            Analyzing this lead…
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

      {providerIsMock && analyses.length > 0 ? (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          This analysis was produced by a deterministic rule-based analyser, not a language
          model. It is structurally realistic but not a substitute for judgement.
        </p>
      ) : null}

      {selected === null ? (
        !busy ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
            No analysis yet. Run one to draft a website strategy for this business.
          </p>
        ) : null
      ) : (
        <AnalysisView analysis={selected} />
      )}

      {analyses.length > 1 ? (
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Previous runs</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {analyses.map((analysis, index) => {
              const active = analysis.id === selected?.id;
              return (
                <li key={analysis.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(analysis.id)}
                    aria-pressed={active}
                    className={active ? `${BUTTON_SECONDARY} ring-2 ring-indigo-500` : BUTTON_SECONDARY}
                  >
                    {index === 0 ? "Latest" : `Run ${analyses.length - index}`}
                    <span className="ml-1 font-normal text-slate-500">
                      {analysis.createdAt.slice(0, 16).replace("T", " ")}
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

/** Renders one analysis, keeping provider facts visually distinct from advice. */
function AnalysisView({ analysis }: { analysis: Analysis }) {
  const { facts, recommendations: rec } = analysis;

  return (
    <div className="mt-4 space-y-6">
      {/* FACTS -- copied from the provider snapshot, never inferred. */}
      <section>
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-500">
          Provider-listed facts this is based on
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          <Badge tone="slate">{facts.category}</Badge>
          <Badge tone="slate">{facts.city}</Badge>
          <Badge tone={facts.websiteListed ? "slate" : "amber"}>
            {facts.websiteListed ? "Website listed" : "No website listed"}
          </Badge>
          <Badge tone={facts.phoneListed ? "slate" : "amber"}>
            {facts.phoneListed ? "Phone listed" : "No phone listed"}
          </Badge>
          <Badge tone={facts.addressListed ? "slate" : "amber"}>
            {facts.addressListed ? "Address listed" : "No address listed"}
          </Badge>
          <Badge tone="slate">
            {facts.ratingListed === null ? "No rating listed" : `Rating ${facts.ratingListed}`}
          </Badge>
        </ul>
      </section>

      {/* RECOMMENDATIONS -- proposals, labelled as such. */}
      <section>
        <h3 className="text-sm font-semibold">Business summary</h3>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{rec.businessSummary}</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Website opportunity</h3>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{rec.websiteOpportunity}</p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold">Recommended site structure</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {RECOMMENDED_SITE_TYPE_LABELS[rec.recommendedSiteType]}
          </p>
          <List items={rec.recommendedPages} />
        </section>

        <section>
          <h3 className="text-sm font-semibold">Homepage sections</h3>
          <List items={rec.homepageSections} />
        </section>

        <section>
          <h3 className="text-sm font-semibold">Key selling points</h3>
          <List items={rec.keySellingPoints} />
        </section>

        <section>
          <h3 className="text-sm font-semibold">Calls to action</h3>
          <List items={rec.callsToAction} />
        </section>
      </div>

      <section>
        <h3 className="text-sm font-semibold">Design direction</h3>
        <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label="Tone" value={rec.designDirection.tone} />
          <Detail label="Palette" value={rec.designDirection.palette} />
          <Detail label="Imagery" value={rec.designDirection.imagery} />
          <Detail label="Typography" value={rec.designDirection.typography} />
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Draft positioning</h3>
        <p className="mt-1 text-sm italic text-slate-700 dark:text-slate-300">
          &ldquo;{rec.draftPositioning}&rdquo;
        </p>
      </section>

      <section className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
        <h3 className="text-sm font-semibold">Assumptions and limitations</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          What this analysis had to assume, and what it cannot tell you.
        </p>
        <List items={analysis.assumptions} />
        <List items={analysis.limitations} />
      </section>

      <p className="text-xs text-slate-500 dark:text-slate-500">
        Generated {analysis.createdAt.slice(0, 16).replace("T", " ")} by{" "}
        {analysis.provider.name} ({analysis.provider.model}) from a provider snapshot
        fetched {facts.snapshotFetchedAt.slice(0, 16).replace("T", " ")}.
      </p>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  );
}
