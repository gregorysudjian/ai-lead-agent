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
};

/**
 * OpenStreetMap attribution.
 *
 * Required by the ODbL and the OSMF attribution guidelines: anyone viewing the
 * data must be made aware it came from OpenStreetMap, and the credit must link
 * to openstreetmap.org/copyright, which carries the licence terms. Rendered
 * wherever OSM-derived business data is displayed.
 */
export function OsmAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-600 dark:text-slate-400 ${className}`}>
      Business data ©{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className={`underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100 ${FOCUS_RING}`}
      >
        OpenStreetMap
      </a>{" "}
      contributors, available under the{" "}
      <a
        href="https://opendatacommons.org/licenses/odbl/1-0/"
        target="_blank"
        rel="noopener noreferrer"
        className={`underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100 ${FOCUS_RING}`}
      >
        Open Database License (ODbL) 1.0
      </a>
      .<span className="sr-only"> Links open in a new tab.</span>
    </p>
  );
}

/** Small provenance label for a single lead. */
export function SourceBadge({ source }: { source: BusinessSource }) {
  return (
    <Badge tone="slate">Source: {SOURCE_LABELS[source]}</Badge>
  );
}
