/**
 * Presentation helpers shared by server and client components.
 *
 * Pure formatting only -- no I/O, so this is safe on both sides of the boundary.
 *
 * The point of centralising these is the website wording. CLAUDE.md forbids
 * overstating provider data, and that rule is only as good as its weakest
 * phrasing; putting the label in one function means no component can casually
 * render "has no website".
 */
import { isSocialProfileUrl } from "./social-hosts";
import { isUsableRating, isUsableReviewCount } from "./scoring";
import type { Lead, OpeningHours, Weekday } from "./types";

/** Placeholder for a field the provider did not return. */
export const NOT_LISTED = "Not listed";

/** Render a value that may be absent, without inventing anything. */
export function displayOrNotListed(value: string | null | undefined): string {
  if (value === null || value === undefined) return NOT_LISTED;
  const trimmed = value.trim();
  return trimmed.length === 0 ? NOT_LISTED : trimmed;
}

/** Rating as e.g. "4.6", or "Unrated" when the provider gave none. */
export function formatRating(rating: number | null): string {
  return rating === null ? "Unrated" : rating.toFixed(1);
}

/**
 * Review count. `0` is a fact (no reviews yet); `null` is unknown. Keeping these
 * distinct matters -- a new business with 0 reviews is a different signal from
 * one whose review count we never received.
 */
export function formatReviewCount(count: number | null): string {
  if (count === null) return "Reviews unknown";
  if (count === 0) return "No reviews yet";
  return `${count} review${count === 1 ? "" : "s"}`;
}

/**
 * How a provider-supplied website value may be rendered.
 *
 * Three outcomes, never collapsed into two:
 *   - `none`       the provider returned nothing
 *   - `linkable`   a valid absolute http(s) URL, safe to render as an anchor
 *   - `unlinkable` the provider returned something we will not link
 */
export type WebsiteRendering =
  | { kind: "none" }
  | { kind: "linkable"; href: string }
  | { kind: "unlinkable"; raw: string };

/** The only URL schemes we will ever turn into a clickable link. */
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Decide whether a provider website value may become a link.
 *
 * Provider data is untrusted external input. A value like `javascript:alert(1)`
 * or `data:text/html,...` in an `href` is a script-execution vector, so the
 * scheme is checked against an allowlist -- anything not http/https is refused,
 * including schemes nobody has thought of yet.
 *
 * This never repairs a value. We do not prepend "https://" to something that
 * failed to parse: guessing what a malformed string meant could silently point
 * the user at a different host than the provider named.
 */
export function classifyWebsite(website: string | null): WebsiteRendering {
  if (website === null) return { kind: "none" };

  const raw = website.trim();
  if (raw.length === 0) return { kind: "unlinkable", raw };

  let parsed: URL;
  try {
    // Absolute URLs only -- no base argument, so a relative string throws.
    parsed = new URL(raw);
  } catch {
    return { kind: "unlinkable", raw };
  }

  if (!SAFE_PROTOCOLS.has(parsed.protocol)) return { kind: "unlinkable", raw };

  // Re-serialise from the parsed URL rather than reusing the raw string, so the
  // href is exactly what the parser validated.
  return { kind: "linkable", href: parsed.href };
}

/**
 * Wording for a value the provider returned but that we refuse to link.
 *
 * Deliberately NOT "No website listed": the provider did list something. Saying
 * otherwise would misreport the data.
 */
export const UNLINKABLE_WEBSITE_LABEL =
  "Website value returned by provider - link unavailable";

/**
 * The website label.
 *
 * `null` means the provider returned no website -- NOT that none exists. Every
 * string here is phrased as a statement about the provider, never about the
 * business.
 */
export function websiteLabel(website: string | null): string {
  const rendering = classifyWebsite(website);
  if (rendering.kind === "none") return "No website listed by provider";
  if (rendering.kind === "unlinkable") return UNLINKABLE_WEBSITE_LABEL;
  return rendering.href;
}

/**
 * Short form for dense list rows. Keeps all FOUR outcomes distinct.
 *
 * The fourth is the one that matters commercially: a business whose only listed
 * "website" is a Facebook page. Scoring counts that as having no website -- it
 * is exactly the prospect this product exists for -- so the row must not say
 * "Website listed" beside a lead ranked as a top prospect. The list and the
 * score have to tell the reader the same story.
 *
 * Link SAFETY (`classifyWebsite`) and what KIND of thing the link points at
 * (`isSocialProfileUrl`) stay separate questions; this label is where the two
 * are combined for display.
 */
export function websiteBadgeLabel(website: string | null): string {
  const rendering = classifyWebsite(website);
  if (rendering.kind === "none") return "No website listed";
  if (rendering.kind === "unlinkable") return "Website value unusable";
  if (isSocialProfileUrl(website)) return "Social page only";
  return "Website listed";
}

/**
 * Whether the provider supplied any reputation data at all.
 *
 * Dense list views use this to omit a reputation line entirely rather than
 * repeating "Unrated - Reviews unknown" on every row. OpenStreetMap never
 * supplies either field, so without this every OSM row carries the same
 * zero-information string.
 *
 * This hides an EMPTY line, never a value: detail views still state plainly
 * that the provider listed no rating or review count.
 */
export function hasProviderReputation(provider: {
  rating: number | null;
  reviewCount: number | null;
}): boolean {
  return isUsableRating(provider.rating) || isUsableReviewCount(provider.reviewCount);
}

/** True when the provider returned no website. A signal, never a confirmed fact. */
export function hasNoListedWebsite(lead: Lead): boolean {
  return lead.provider.website === null;
}

const WEEKDAY_ORDER: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export interface OpeningHoursRow {
  day: string;
  hours: string;
}

/**
 * Opening hours as ordered day rows, Monday first.
 *
 * A day the provider did not list is "Closed" only because our own type says
 * closed days are omitted -- that is our documented convention, not a guess
 * about the business. No timezone handling: the provider's local times are
 * shown as given.
 */
export function formatOpeningHours(hours: OpeningHours): OpeningHoursRow[] {
  return WEEKDAY_ORDER.map((day) => {
    // Every window, not just the first. A day can carry two -- a restaurant
    // closing between lunch and dinner -- and `find` silently dropped the
    // evening service, understating the business on its own record.
    const windows = hours.filter((h) => h.day === day);
    return {
      day: WEEKDAY_LABELS[day],
      hours:
        windows.length > 0
          ? windows.map((w) => `${w.opens} - ${w.closes}`).join(", ")
          : "Closed",
    };
  });
}

/**
 * Opening hours as display lines, for a customer-facing page.
 *
 * Two differences from `formatOpeningHours`, both deliberate:
 *
 * 1. **Days we hold nothing for are omitted, never rendered as "Closed".**
 *    Our type says an absent day is closed and OSM says the same, so the
 *    internal record view is entitled to show it. A demo is not: it is shown
 *    to the owner, and OSM tagging is often incomplete. "Saturday: Closed"
 *    printed under the name of a shop that opens on Saturday is exactly the
 *    checkable wrong specific that costs the conversation.
 *
 * 2. **Consecutive days sharing hours are grouped**, because that is how a
 *    real site writes them -- "Monday to Friday", not five identical rows.
 *
 * Returns an empty array when there is nothing to show, so a caller can fall
 * back to sample hours rather than rendering an empty block.
 */
export function formatOpeningHoursLines(hours: OpeningHours): string[] {
  // Collapse to one entry per day first, so grouping compares whole days.
  const byDay = new Map<string, string>();
  for (const day of WEEKDAY_ORDER) {
    const windows = hours.filter((h) => h.day === day);
    if (windows.length === 0) continue;
    byDay.set(day, windows.map((w) => `${w.opens} - ${w.closes}`).join(", "));
  }

  const lines: string[] = [];
  let runStart: (typeof WEEKDAY_ORDER)[number] | null = null;
  let runEnd: (typeof WEEKDAY_ORDER)[number] | null = null;
  let runHours: string | null = null;

  const flush = () => {
    if (runStart === null || runEnd === null || runHours === null) return;
    const label =
      runStart === runEnd
        ? WEEKDAY_LABELS[runStart]
        : `${WEEKDAY_LABELS[runStart]} to ${WEEKDAY_LABELS[runEnd]}`;
    lines.push(`${label}   ${runHours}`);
    runStart = null;
    runEnd = null;
    runHours = null;
  };

  for (const day of WEEKDAY_ORDER) {
    const value = byDay.get(day);
    if (value === undefined) {
      // A gap breaks the run: "Monday to Friday" must not span a closed
      // Wednesday, which would be a claim we cannot support.
      flush();
      continue;
    }
    if (runHours === value && runEnd !== null) {
      runEnd = day;
      continue;
    }
    flush();
    runStart = day;
    runEnd = day;
    runHours = value;
  }
  flush();

  return lines;
}

/** Readable absolute timestamp. Fixed locale so server and client agree. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return NOT_LISTED;
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}
