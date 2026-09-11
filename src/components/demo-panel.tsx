"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DIRECTIONS } from "@/lib/demo-design/directions";
import { DEMO_THEME_LABELS, type DemoSite } from "@/lib/demo-site";

import { BUTTON_PRIMARY, BUTTON_SECONDARY, Badge, Card, LINK, SectionHeading } from "./ui/primitives";
import { Timestamp } from "./ui/timestamp";

/**
 * The demo-site workspace for one lead.
 *
 * A Client Component because it owns the request lifecycle: POST, then
 * `router.refresh()` so the server re-reads the store and stays the source of
 * truth. It never renders a demo it has not seen come back from the server.
 *
 * Generation is always one deliberate click. There is no effect, no retry loop
 * and no automatic generation on mount.
 *
 * "Try another design" generates a NEW demo with the next design variant --
 * same facts, same words, a different look. The previous demo is kept, like
 * every demo, because it may already have been shown to someone.
 */

/** The highest design variant the server accepts (`MAX_DESIGN_VARIANT`). */
const MAX_VARIANT = 99;

/** A short description of how a demo looks, for the lists below. */
function lookOf(demo: DemoSite): string {
  const design = demo.spec.design;
  if (!design) return `${DEMO_THEME_LABELS[demo.spec.content.theme]} (original renderer)`;
  const languages = demo.spec.alternates?.fr ? "FR + EN" : "EN";
  return `${DIRECTIONS[design.direction].label} style, variant ${design.variant} · ${languages}`;
}
export function DemoPanel({
  leadId,
  demos,
  latestAnalysis,
  generator,
}: {
  leadId: string;
  demos: DemoSite[];
  /** Null when the lead has never been analysed. */
  latestAnalysis: { id: string; createdAt: string } | null;
  /** The generator a NEW run would use. */
  generator: { name: string; model: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, startTransition] = useTransition();

  const busy = isGenerating || isRefreshing;
  const latestDemo = demos[0] ?? null;
  // Regenerating keeps the look the latest demo has; "another design" moves to
  // a variant this lead has not had yet (wrapping round, never back to 0).
  const currentVariant = latestDemo?.spec.design?.variant ?? 0;
  const usedVariants = demos.map((demo) => demo.spec.design?.variant ?? 0);
  const nextVariant = Math.max(...usedVariants, 0) >= MAX_VARIANT ? 1 : Math.max(...usedVariants, 0) + 1;

  async function handleGenerate(variant: number) {
    if (busy || !latestAnalysis) return;
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The analysis is named explicitly rather than left as "the latest", so
        // the demo is built from exactly the analysis this panel displayed.
        body: JSON.stringify({ analysisId: latestAnalysis.id, variant }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not generate a demo site. Please try again.",
        );
        return;
      }

      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          title="Demo website"
          hint="A proposed site built from the analysis. Internal preview only — nothing is published or sent."
        />
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            tone={generator.name === "mock" ? "amber" : "indigo"}
            title={
              generator.name === "mock"
                ? "Deterministic rule-based generator; no language model is connected"
                : `A new demo uses ${generator.model}`
            }
          >
            {generator.name === "mock" ? "Mock generator" : generator.name}
          </Badge>
          {latestDemo ? (
            <button
              type="button"
              onClick={() => handleGenerate(nextVariant)}
              disabled={busy || latestAnalysis === null}
              title="A new demo with the same words and a different design. The current one is kept."
              className={BUTTON_SECONDARY}
            >
              Try another design
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => handleGenerate(currentVariant)}
            disabled={busy || latestAnalysis === null}
            title={
              latestAnalysis === null
                ? "Run an analysis before generating a demo site"
                : undefined
            }
            className={BUTTON_PRIMARY}
          >
            {busy ? "Generating…" : demos.length > 0 ? "Regenerate demo" : "Generate demo site"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="mt-3 space-y-3">
        {busy ? (
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span aria-hidden="true" className="h-3 w-3 animate-pulse rounded-full motion-reduce:animate-none bg-indigo-500" />
            Building the demo site…
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

      {latestAnalysis === null ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          Analysis required first. A demo site is built from an analysis, so run one in the
          panel above before generating.
        </p>
      ) : (
        <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">
          A new demo would be built from the analysis of{" "}
          <Timestamp iso={latestAnalysis.createdAt} />, using {generator.name} (
          {generator.model}).
        </p>
      )}

      {latestDemo ? (
        <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Latest demo</p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {lookOf(latestDemo)} · generated{" "}
                <Timestamp iso={latestDemo.createdAt} /> by {latestDemo.generator.name} (
                {latestDemo.generator.model})
              </p>
            </div>
            <Link href={`/demos/${latestDemo.id}`} className={BUTTON_SECONDARY}>
              Open demo
            </Link>
          </div>
        </div>
      ) : null}

      {demos.length > 1 ? (
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Previous demos</h3>
          <ul className="mt-2 space-y-2">
            {demos.slice(1).map((demo) => (
              <li
                key={demo.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400"
              >
                <span>
                  <Timestamp iso={demo.createdAt} /> · {lookOf(demo)} ·{" "}
                  {demo.generator.name} ({demo.generator.model})
                </span>
                <Link
                  href={`/demos/${demo.id}`}
                  className={`font-medium ${LINK}`}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
