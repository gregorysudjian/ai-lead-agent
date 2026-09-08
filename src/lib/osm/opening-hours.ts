import type { OpeningHours, OpeningHoursEntry, Weekday } from "../types";

/**
 * A deliberately narrow parser for OpenStreetMap's `opening_hours` tag.
 *
 * ── THE PROBLEM THIS SOLVES CAREFULLY ─────────────────────────────────────
 *
 * `opening_hours` is a full domain syntax: day and month ranges, week numbers,
 * public and school holidays, sunrise/sunset offsets, fallback rules, seasonal
 * variation, free-text comments. The normalizer used to discard the tag
 * entirely, with a comment worth repeating:
 *
 *   "A partial parser would render confident but wrong 'Closed' days, which is
 *    worse than admitting we have no data."
 *
 * That is exactly right, and it is the constraint this file is built around
 * rather than an obstacle to it. Hours are the single most useful fact a small
 * business publishes, and Overpass already returns them in a response we
 * have paid for -- so the win is real, but only if wrong output is impossible.
 *
 * ── THE RULE: ALL OR NOTHING ──────────────────────────────────────────────
 *
 * This parser understands a small, unambiguous subset. If ANY part of a value
 * falls outside it, the WHOLE value is rejected and the field stays `null` --
 * "nobody told us" -- rather than being partially understood. There is no path
 * that produces a half-parsed schedule.
 *
 * Accepted:      Mo-Fr 09:00-18:00
 *                Mo-Fr 09:00-18:00; Sa 09:00-17:00
 *                Mo,We,Fr 09:00-17:00
 *                Mo-Sa 08:00-20:00; Su off
 *                Tu-Su 11:00-14:30,17:00-22:00      (a lunch break)
 *
 * Rejected outright, every one returning null:
 *                24/7                    no day structure to record
 *                Mo-Fr 09:00+            open-ended, no closing time
 *                Mo-Fr sunrise-sunset    varies by date
 *                Jan-Mar Mo-Fr 09:00-17:00   seasonal
 *                Mo-Fr 09:00-17:00; PH off   holiday rules we cannot model
 *                Mo-Fr 09:00-17:00 "by appointment"   free-text qualifier
 *                Fr-Mo 09:00-17:00       a range that wraps the week
 *                Mo-Fr 22:00-02:00       a window crossing midnight
 *
 * ── WHY OMITTED DAYS ARE SAFE ─────────────────────────────────────────────
 *
 * `OpeningHours` documents that "days the business is closed are simply
 * omitted", and OSM uses the same convention: a day no rule mentions is
 * closed. So the two models agree and nothing is asserted by omission.
 *
 * That said, an omitted day still READS as closed to whoever sees it, and OSM
 * tagging can be incomplete. So a customer-facing demo lists only the days it
 * has (see `formatOpeningHoursLines`), while the internal lead view may show
 * "Closed" against the rest -- an operator reading our own record knows what
 * a provider snapshot is; a business owner looking at a proposed website does
 * not.
 *
 * Pure and total: same input, same output, no clock, no locale, never throws.
 */

/** OSM's two-letter day codes, in week order. Index doubles as the day number. */
const OSM_DAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const;

const WEEKDAY_BY_INDEX: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * Substrings that put a value outside the supported subset.
 *
 * Checked against the whole string before any parsing, so a construct we do
 * not model can never be silently skipped by a later step. Erring toward
 * rejection is the entire design: a value we refuse costs us one field, and a
 * value we misread puts a wrong "Closed" on a page shown to the owner.
 */
const UNSUPPORTED = [
  "24/7",
  "ph", // public holidays
  "sh", // school holidays
  "sunrise",
  "sunset",
  "dawn",
  "dusk",
  "easter",
  "week",
  "||", // fallback rules
  '"', // free-text comment
  "+", // open-ended
  "[", // constrained weekday, e.g. Sa[1]
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

/** One `HH:MM-HH:MM` window. */
interface Window {
  opens: string;
  closes: string;
}

/** `HH:MM` within a day, or null when malformed or out of range. */
function parseTime(value: string): string | null {
  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (minutes > 59) return null;
  // 24:00 is a legitimate end-of-day in this syntax; 24:30 is not.
  if (hours > 24) return null;
  if (hours === 24 && minutes !== 0) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** `HH:MM-HH:MM`, or null. Rejects windows that cross midnight. */
function parseWindow(value: string): Window | null {
  const parts = value.split("-");
  if (parts.length !== 2) return null;

  const opens = parseTime(parts[0].trim());
  const closes = parseTime(parts[1].trim());
  if (opens === null || closes === null) return null;

  // Zero-padded times compare correctly as strings. A window that ends before
  // it starts crosses midnight -- real for late bars, and not representable in
  // a model with one closing time per day, so the whole value is refused.
  if (closes <= opens) return null;

  return { opens, closes };
}

/** The day indices a day-spec covers, or null. */
function parseDays(value: string): number[] | null {
  const indices: number[] = [];

  for (const part of value.split(",")) {
    const token = part.trim().toLowerCase();
    if (token.length === 0) return null;

    const range = token.split("-");
    if (range.length === 1) {
      const index = OSM_DAYS.indexOf(range[0] as (typeof OSM_DAYS)[number]);
      if (index === -1) return null;
      indices.push(index);
      continue;
    }

    if (range.length !== 2) return null;
    const from = OSM_DAYS.indexOf(range[0] as (typeof OSM_DAYS)[number]);
    const to = OSM_DAYS.indexOf(range[1] as (typeof OSM_DAYS)[number]);
    if (from === -1 || to === -1) return null;
    // A wrapping range (Fr-Mo) is legal OSM but ambiguous enough to refuse.
    if (to < from) return null;

    for (let i = from; i <= to; i += 1) indices.push(i);
  }

  return indices.length > 0 ? indices : null;
}

/**
 * Parse an `opening_hours` value, or return null if any part is unsupported.
 *
 * Never throws and never partially succeeds.
 */
export function parseOsmOpeningHours(raw: string | null | undefined): OpeningHours | null {
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (value.length === 0) return null;
  // A pathological value is a tagging error, not a schedule.
  if (value.length > 200) return null;

  const lower = value.toLowerCase();

  // A colon is not listed above because it appears in every time. It is
  // constrained structurally instead: the only place one may occur is inside
  // an HH:MM, which `parseTime` enforces.
  for (const marker of UNSUPPORTED) {
    if (lower.includes(marker)) return null;
  }

  const rules = value.split(";");
  if (rules.length > 14) return null;

  // Day index -> windows. A later rule replaces an earlier one for the same
  // day, which is how the syntax layers exceptions onto a general rule.
  const byDay = new Map<number, Window[]>();

  for (const rule of rules) {
    const trimmed = rule.trim();
    if (trimmed.length === 0) return null;

    // Split once, on the first run of whitespace: "Mo-Fr" then the rest.
    const separator = trimmed.search(/\s/);
    if (separator === -1) return null;

    const daySpec = trimmed.slice(0, separator);
    const timeSpec = trimmed.slice(separator + 1).trim();

    const days = parseDays(daySpec);
    if (days === null) return null;

    const closed = timeSpec.toLowerCase();
    if (closed === "off" || closed === "closed") {
      for (const day of days) byDay.set(day, []);
      continue;
    }

    const windows: Window[] = [];
    for (const part of timeSpec.split(",")) {
      const window = parseWindow(part.trim());
      if (window === null) return null;
      windows.push(window);
    }

    for (const day of days) byDay.set(day, windows);
  }

  const entries: OpeningHoursEntry[] = [];
  for (let index = 0; index < WEEKDAY_BY_INDEX.length; index += 1) {
    for (const window of byDay.get(index) ?? []) {
      entries.push({
        day: WEEKDAY_BY_INDEX[index],
        opens: window.opens,
        closes: window.closes,
      });
    }
  }

  // Every rule parsed, but every day was `off`. That is a real statement --
  // "we publish hours, and they are none" -- and the domain type distinguishes
  // an empty array from null precisely for it.
  return entries;
}
