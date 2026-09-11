import { z } from "zod";

import { normalizeTerm } from "../normalize";
import { isUsableText, scoreSnapshot, type LeadScore } from "../scoring";
import { isSocialProfileUrl } from "../social-hosts";
import type { ProviderSnapshot } from "../types";
import type { CatalogArea } from "./area";
import { CATALOG_TRADE_KEYS, catalogTradeForLabel } from "./trades";
import type { CatalogBusiness } from "./types";

/**
 * The catalog search engine: filter, count, rank and page, in one pure pass.
 *
 * ── WHY IN MEMORY ─────────────────────────────────────────────────────────
 *
 * The catalog is a few thousand rows, read once per request (and briefly
 * cached) by the service. Doing every step here, in one function, is what
 * keeps the three things a search page shows -- the results, the count beside
 * each trade, the count beside each area -- from ever disagreeing with each
 * other. Filtering in SQL and counting in TypeScript would be the same rules
 * written twice, in two languages, and they would drift.
 *
 * It is also what keeps priority unpersisted, as CLAUDE.md requires: the score
 * is computed here from the snapshot on every search, never stored.
 *
 * Only the requested page ever leaves the server. The browser receives
 * twenty-four businesses and a handful of counts, not the catalog.
 *
 * Revisit if the catalog grows past a few tens of thousands of rows.
 */

export const PAGE_SIZE = 24;

export type SortOrder = "priority" | "name" | "newest";
export type LeadsFilter = "any" | "hide" | "only";

export interface CatalogQuery {
  /** Free text as typed, trimmed. Matched against name, street and district. */
  q: string;
  /** A catalog trade key, or null for every trade. */
  trade: string | null;
  /** A municipality label, or null for the whole area. */
  area: string | null;
  noWebsite: boolean;
  hasPhone: boolean;
  /** Only businesses that first appeared in the latest release. */
  fresh: boolean;
  leads: LeadsFilter;
  /** Include businesses the latest release no longer lists. */
  includeGone: boolean;
  sort: SortOrder;
  page: number;
}

export const DEFAULT_QUERY: CatalogQuery = {
  q: "",
  trade: null,
  area: null,
  noWebsite: false,
  hasPhone: false,
  fresh: false,
  leads: "any",
  includeGone: false,
  sort: "priority",
  page: 1,
};

// ---------------------------------------------------------------------------
// The URL is the state
// ---------------------------------------------------------------------------

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const flag = z
  .string()
  .optional()
  .transform((value) => value === "1")
  .catch(false);

/**
 * Read a query from URL search params, leniently.
 *
 * A search URL is typed, bookmarked, edited and shared, so an unexpected value
 * falls back to its default instead of failing the page. Nothing here reaches
 * a query language: the trade and area must name an entry in a curated list,
 * and the free text is only ever compared in memory.
 */
export function parseCatalogQuery(params: RawParams, area: CatalogArea): CatalogQuery {
  const municipalities = area.municipalities.map((municipality) => municipality.label);

  const schema = z.object({
    q: z
      .string()
      .optional()
      .transform((value) => (value ?? "").trim().slice(0, 100))
      .catch(""),
    trade: z
      .string()
      .optional()
      .transform((value) => (value !== undefined && CATALOG_TRADE_KEYS.includes(value) ? value : null))
      .catch(null),
    area: z
      .string()
      .optional()
      .transform((value) => (value !== undefined && municipalities.includes(value) ? value : null))
      .catch(null),
    noWebsite: flag,
    hasPhone: flag,
    fresh: flag,
    leads: z.enum(["any", "hide", "only"]).catch("any"),
    includeGone: flag,
    sort: z.enum(["priority", "name", "newest"]).catch("priority"),
    page: z.coerce.number().int().min(1).max(10_000).catch(1),
  });

  return schema.parse({
    q: first(params.q),
    trade: first(params.trade),
    area: first(params.area),
    noWebsite: first(params.nosite),
    hasPhone: first(params.phone),
    fresh: first(params.new),
    leads: first(params.leads),
    includeGone: first(params.gone),
    sort: first(params.sort),
    page: first(params.page),
  });
}

/** The query as URL params, omitting every default so links stay short. */
export function toSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.trade) params.set("trade", query.trade);
  if (query.area) params.set("area", query.area);
  if (query.noWebsite) params.set("nosite", "1");
  if (query.hasPhone) params.set("phone", "1");
  if (query.fresh) params.set("new", "1");
  if (query.leads !== "any") params.set("leads", query.leads);
  if (query.includeGone) params.set("gone", "1");
  if (query.sort !== "priority") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

/**
 * A link to the search with some filters changed.
 *
 * Changing any filter returns to page 1 -- page 7 of a narrower result is
 * usually past its end -- unless the change is the page itself.
 */
export function catalogHref(query: CatalogQuery, patch: Partial<CatalogQuery> = {}): string {
  const next: CatalogQuery = { ...query, ...patch, page: patch.page ?? 1 };
  const search = toSearchParams(next).toString();
  return search ? `/businesses?${search}` : "/businesses";
}

// ---------------------------------------------------------------------------
// Facts about one business
// ---------------------------------------------------------------------------

/**
 * No website of its own: none listed, or only a social page.
 *
 * Exactly the predicate scoring uses for its website factor, so the filter
 * and the priority badge beside each result can never tell different stories.
 * "Listed" is doing the work, as everywhere else: this is what the provider
 * told us, never a claim that the business has no site.
 */
export function listsNoOwnWebsite(provider: ProviderSnapshot): boolean {
  return provider.website === null || isSocialProfileUrl(provider.website);
}

export interface CatalogReleases {
  /** The newest release any business was seen in. */
  latest: string | null;
  /** The oldest release any business was first seen in -- the initial load. */
  baseline: string | null;
}

/**
 * Which releases the catalog has seen, read from the businesses themselves.
 *
 * Release names are ISO dates ("2026-08-19.0"), so they order as strings.
 */
export function catalogReleases(businesses: readonly CatalogBusiness[]): CatalogReleases {
  let latest: string | null = null;
  let baseline: string | null = null;
  for (const business of businesses) {
    if (latest === null || business.lastSeenRelease > latest) latest = business.lastSeenRelease;
    if (baseline === null || business.firstSeenRelease < baseline) {
      baseline = business.firstSeenRelease;
    }
  }
  return { latest, baseline };
}

export interface ScoredBusiness {
  business: CatalogBusiness;
  score: LeadScore;
  /**
   * First seen in the latest release. Never true on the initial load, when
   * everything is technically new and saying so would be meaningless.
   */
  isNew: boolean;
  /**
   * The latest release no longer lists it -- often closed, sometimes merely
   * dropped by the provider. Shown as exactly that, never as "closed".
   */
  isGone: boolean;
}

function scoreAll(
  businesses: readonly CatalogBusiness[],
  releases: CatalogReleases,
): ScoredBusiness[] {
  const hasHistory =
    releases.latest !== null && releases.baseline !== null && releases.latest !== releases.baseline;

  return businesses.map((business) => ({
    business,
    score: scoreSnapshot(business.provider),
    isNew: hasHistory && business.firstSeenRelease === releases.latest,
    isGone: releases.latest !== null && business.lastSeenRelease !== releases.latest,
  }));
}

// ---------------------------------------------------------------------------
// Filters, one per dimension, so a facet can switch exactly one off
// ---------------------------------------------------------------------------

type Dimension = "status" | "q" | "trade" | "area" | "noWebsite" | "hasPhone" | "fresh" | "leads";

function matches(item: ScoredBusiness, query: CatalogQuery, except?: Dimension): boolean {
  const { business } = item;
  const provider = business.provider;

  if (except !== "status" && !query.includeGone && item.isGone) return false;

  if (except !== "q" && query.q.length > 0) {
    const needle = normalizeTerm(query.q);
    const haystack = normalizeTerm(
      `${provider.name} ${provider.address ?? ""} ${provider.city} ${business.municipality}`,
    );
    if (!haystack.includes(needle)) return false;
  }

  if (except !== "trade" && query.trade !== null) {
    if (catalogTradeForLabel(provider.category)?.key !== query.trade) return false;
  }

  if (except !== "area" && query.area !== null && business.municipality !== query.area) return false;
  if (except !== "noWebsite" && query.noWebsite && !listsNoOwnWebsite(provider)) return false;
  if (except !== "hasPhone" && query.hasPhone && !isUsableText(provider.phone)) return false;
  if (except !== "fresh" && query.fresh && !item.isNew) return false;
  if (except !== "leads" && query.leads === "hide" && business.leadId !== null) return false;
  if (except !== "leads" && query.leads === "only" && business.leadId === null) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

function byName(a: ScoredBusiness, b: ScoredBusiness): number {
  // Fixed locale, so the order cannot drift with the machine running it.
  return a.business.provider.name.localeCompare(b.business.provider.name, "en");
}

const ORDERINGS: Record<SortOrder, (a: ScoredBusiness, b: ScoredBusiness) => number> = {
  priority: (a, b) => b.score.total - a.score.total || byName(a, b),
  name: byName,
  newest: (a, b) =>
    b.business.firstSeenAt.localeCompare(a.business.firstSeenAt) ||
    b.score.total - a.score.total ||
    byName(a, b),
};

// ---------------------------------------------------------------------------
// The search
// ---------------------------------------------------------------------------

export interface CatalogSummary {
  /** Every row, gone ones included. */
  total: number;
  /** Listed in the latest release. */
  current: number;
  /** Current, and no website of their own listed. */
  noWebsite: number;
  /** Current, and first seen in the latest release. */
  newInLatest: number;
  /** Already a lead. */
  inLeads: number;
  /** No longer listed in the latest release. */
  gone: number;
}

export interface CatalogSearchResult {
  results: ScoredBusiness[];
  /** How many businesses match the whole query. */
  total: number;
  /** The page shown, clamped into range. */
  page: number;
  pageCount: number;
  /** Per trade key: matches with every filter applied except the trade. */
  tradeCounts: Record<string, number>;
  /** Per municipality: matches with every filter except the area. Largest first. */
  areaCounts: { label: string; count: number }[];
  summary: CatalogSummary;
  releases: CatalogReleases;
}

export function searchCatalog(
  businesses: readonly CatalogBusiness[],
  query: CatalogQuery,
  options: { pageSize?: number } = {},
): CatalogSearchResult {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const releases = catalogReleases(businesses);
  const scored = scoreAll(businesses, releases);

  const matching = scored.filter((item) => matches(item, query)).sort(ORDERINGS[query.sort]);

  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const results = matching.slice((page - 1) * pageSize, page * pageSize);

  const tradeCounts: Record<string, number> = Object.fromEntries(
    CATALOG_TRADE_KEYS.map((key) => [key, 0]),
  );
  const areaTally = new Map<string, number>();
  for (const item of scored) {
    if (matches(item, query, "trade")) {
      const key = catalogTradeForLabel(item.business.provider.category)?.key;
      if (key !== undefined) tradeCounts[key] += 1;
    }
    if (matches(item, query, "area")) {
      const label = item.business.municipality;
      areaTally.set(label, (areaTally.get(label) ?? 0) + 1);
    }
  }
  const areaCounts = [...areaTally]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en"));

  const current = scored.filter((item) => !item.isGone);
  const summary: CatalogSummary = {
    total: scored.length,
    current: current.length,
    noWebsite: current.filter((item) => listsNoOwnWebsite(item.business.provider)).length,
    newInLatest: current.filter((item) => item.isNew).length,
    inLeads: scored.filter((item) => item.business.leadId !== null).length,
    gone: scored.length - current.length,
  };

  return {
    results,
    total: matching.length,
    page,
    pageCount,
    tradeCounts,
    areaCounts,
    summary,
    releases,
  };
}
