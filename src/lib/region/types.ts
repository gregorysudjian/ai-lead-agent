/**
 * A region: the search area a user asked for, resolved to something queryable.
 *
 * ── WHY THIS SHAPE, AND NOT A POLYGON ─────────────────────────────────────
 *
 * The obvious design is "free text -> coordinates + radius", tiling large
 * regions into overlapping circles to stay under an API's result cap. That
 * design exists to work around a per-query limit, and with a bulk-ingested
 * dataset there is no per-query limit to work around -- the places live in our
 * own database and carry structured addresses with country and subdivision
 * codes. "Businesses in Texas" is therefore a FIELD FILTER, not a geometry
 * problem, and a filter is exact where a circle is an approximation.
 *
 * Geometry earns its place only at locality level, where names collide
 * ("Ontario" is a province and a city in California) and an address string is
 * not enough on its own. That is why `bbox` is optional rather than central.
 *
 * ── WHY A RESULT TYPE RATHER THAN A NULLABLE ──────────────────────────────
 *
 * "CA" is Canada and it is California. "Vancouver" is in British Columbia and
 * in Washington. Silently preferring one is exactly the kind of confident
 * guess this codebase refuses elsewhere, and picking wrong sends a search --
 * and eventually an outreach draft -- at the wrong half of a continent. So
 * ambiguity is a distinct outcome the caller has to handle, not a coin flip
 * hidden behind a return value.
 *
 * Pure and total: no I/O, no clock, never throws.
 */

/** How large an area the user named. */
export type RegionKind = "country" | "subdivision" | "locality";

/** A bounding box, `[west, south, east, north]` in degrees. */
export type BoundingBox = readonly [number, number, number, number];

export interface ResolvedRegion {
  kind: RegionKind;
  /** Canonical display label: "Canada", "Texas", "Montreal". */
  label: string;
  /**
   * ISO 3166-1 alpha-2. Always present -- every region we support belongs to
   * exactly one country, and the country is what scopes a dataset ingest.
   */
  country: string;
  /**
   * ISO 3166-2 subdivision code WITHOUT the country prefix: "TX", "QC".
   * Null for a whole country.
   */
  subdivision: string | null;
  /** Locality name as it appears in address data. Null above locality level. */
  locality: string | null;
  /**
   * Optional spatial refinement.
   *
   * Present only where a name filter alone would be wrong. Never the primary
   * mechanism -- see the note at the top of this file.
   */
  bbox: BoundingBox | null;
}

/**
 * The outcome of resolving free text.
 *
 * Three cases, deliberately. `unsupported` and `ambiguous` are different
 * problems with different fixes -- one needs a better registry, the other
 * needs the user to say which of two real places they meant -- and collapsing
 * them into `null` would leave a caller unable to tell a typo from a genuine
 * collision.
 */
export type RegionResolution =
  | { status: "resolved"; region: ResolvedRegion }
  | {
      status: "ambiguous";
      /** What the user typed, echoed back so a prompt can quote it. */
      input: string;
      /** Every region the input legitimately names, in registry order. */
      candidates: ResolvedRegion[];
    }
  | {
      status: "unsupported";
      input: string;
      /** Why, in words safe to show a user. Never leaks internals. */
      reason: string;
    };

/**
 * A locality the resolver can place.
 *
 * Lives here rather than beside the resolver so the generated registry in
 * `localities.ts` can reference it without the two importing each other.
 */
export interface KnownLocality {
  label: string;
  country: string;
  subdivision: string | null;
  aliases?: readonly string[];
}
