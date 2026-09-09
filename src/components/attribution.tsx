import type { BusinessSource } from "@/lib/types";

import { Badge, FOCUS_RING } from "./ui/primitives";

/**
 * Human-readable provider names. Shown so the UI never implies data came from
 * somewhere it did not.
 */
export const SOURCE_LABELS: Record<BusinessSource, string> = {
  mock: "Mock fixture data",
  osm: "OpenStreetMap",
  google: "Google Places",
  overture: "Overture Maps",
};

/**
 * OpenStreetMap attribution.
 *
 * Required by the ODbL and the OSMF attribution guidelines: anyone viewing the
 * data must be made aware it came from OpenStreetMap, and the credit must link
 * to openstreetmap.org/copyright, which carries the licence terms. Rendered
 * wherever OSM-derived business data is displayed.
 */
export function OsmAttribution({
  className = "",
  tone = "default",
}: {
  className?: string;
  /** `inverted` for placement on a dark surface, such as the demo preview bar. */
  tone?: "default" | "inverted";
}) {
  const text =
    tone === "inverted" ? "text-slate-400" : "text-slate-600 dark:text-slate-400";
  const hover =
    tone === "inverted" ? "hover:text-white" : "hover:text-slate-900 dark:hover:text-slate-100";

  return (
    <p className={`text-xs ${text} ${className}`}>
      Business data ©{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className={`underline underline-offset-2 ${hover} ${FOCUS_RING}`}
      >
        OpenStreetMap
      </a>{" "}
      contributors, available under the{" "}
      <a
        href="https://opendatacommons.org/licenses/odbl/1-0/"
        target="_blank"
        rel="noopener noreferrer"
        className={`underline underline-offset-2 ${hover} ${FOCUS_RING}`}
      >
        Open Database License (ODbL) 1.0
      </a>
      .<span className="sr-only"> Links open in a new tab.</span>
    </p>
  );
}

/** Small provenance label for a single lead. */
/**
 * Overture Maps attribution.
 *
 * Overture's places data is published under CDLA-Permissive 2.0, which
 * requires attribution notices to be preserved. Treated exactly like the OSM
 * credit above rather than as an afterthought: a licence that asks for credit
 * gets credit wherever the data is shown, and never a claim that it came from
 * somewhere else.
 */
export function OvertureAttribution({
  className = "",
  tone = "default",
}: {
  className?: string;
  /** `inverted` for placement on a dark surface, such as the demo preview bar. */
  tone?: "default" | "inverted";
}) {
  const muted = tone === "inverted" ? "text-slate-400" : "text-slate-500 dark:text-slate-400";
  const link =
    tone === "inverted"
      ? `underline underline-offset-2 hover:text-white ${FOCUS_RING}`
      : `underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100 ${FOCUS_RING}`;

  return (
    <p className={`text-[11px] leading-relaxed ${muted} ${className}`}>
      Business data from{" "}
      <a
        href="https://overturemaps.org"
        target="_blank"
        rel="noopener noreferrer"
        className={link}
      >
        Overture Maps
      </a>
      , available under{" "}
      <a
        href="https://cdla.dev/permissive-2-0/"
        target="_blank"
        rel="noopener noreferrer"
        className={link}
      >
        CDLA-Permissive 2.0
      </a>
      .
    </p>
  );
}

export function SourceBadge({ source }: { source: BusinessSource }) {
  return (
    <Badge tone="slate">Source: {SOURCE_LABELS[source]}</Badge>
  );
}
