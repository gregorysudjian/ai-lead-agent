import type { BusinessSource } from "@/lib/types";

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
        className="underline underline-offset-2 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:text-slate-100"
      >
        OpenStreetMap
      </a>{" "}
      contributors, available under the{" "}
      <a
        href="https://opendatacommons.org/licenses/odbl/1-0/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:text-slate-100"
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
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      Source: {SOURCE_LABELS[source]}
    </span>
  );
}
