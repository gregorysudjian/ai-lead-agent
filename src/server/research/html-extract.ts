import { Parser } from "htmlparser2";

import type { ObservationKind, ProfileField } from "@/lib/business-profile";
import { SOCIAL_PROFILE_HOSTS } from "@/lib/social-hosts";

/**
 * Turn one fetched HTML page into conservative, attributable evidence.
 *
 * Pure: a string in, a list of candidate observations out. No network, no
 * clock, no randomness, so every extraction rule is directly testable against
 * a fixture.
 *
 * ── THE STANDARD APPLIED HERE ─────────────────────────────────────────────
 *
 * A value is extracted only when the MARKUP ITSELF says what it is. A
 * `tel:` href is a phone number because the author declared a phone number; a
 * paragraph containing digits is not. Nothing is inferred from prose, from
 * position on the page, from link text alone, or from the business category.
 *
 * That rules out most of what a page appears to offer, and that is the point:
 * a profile is evidence, and it is better to record four facts we can defend
 * than fourteen we would have to explain.
 *
 * Deliberately NOT extracted, even where a page states them:
 *
 *   services       free text with no machine-readable marker. A navigation
 *                  label reading "Fades" is not a declaration of a service.
 *   ratings and    a business's own page quoting its own rating is marketing.
 *   review counts  Reputation needs a source with standing, and none is
 *                  connected.
 *   awards, price  no field, and no need for one in this phase.
 *   ranges
 *
 * ── UNTRUSTED INPUT ───────────────────────────────────────────────────────
 *
 * The page is parsed, never executed. Script and style contents are discarded
 * except for JSON-LD, which is parsed as JSON and read through an allowlist of
 * exact fields. Page text cannot name a profile field, choose a source id, or
 * cause another fetch. Text that reads like an instruction is just text: there
 * is no interpreter for it here, and no model downstream in this phase.
 */

/** One candidate fact, before a source id is attached to it. */
export interface ExtractedObservation {
  field: ProfileField;
  value: string;
  kind: ObservationKind;
}

export interface ExtractionResult {
  /** The page's own title, if it declared one. Used for the source record. */
  pageTitle: string | null;
  observations: ExtractedObservation[];
}

/** Bounds on how much one page may contribute. */
export const EXTRACTION_LIMITS = {
  title: 300,
  description: 1000,
  phone: 50,
  email: 254,
  url: 2048,
  socialLinks: 8,
  openingHours: 14,
  /** JSON-LD blocks parsed. Later ones are ignored, not merged. */
  jsonLdBlocks: 5,
  /** Characters of JSON-LD parsed per block. */
  jsonLdBytes: 100_000,
  /** Total observations one page may produce. */
  observations: 40,
} as const;

/**
 * Hosts whose links we will record as a public social profile.
 *
 * An allowlist, because "an outbound link" is not evidence of anything. We
 * record that the page links to a profile; we never fetch it, log in, or read
 * anything there.
 *
 * Deliberately the NARROW list, not the one lead scoring uses.
 *
 * Scoring asks "is this listed website actually their own site?", and answers
 * no for a booking page or a directory entry -- which is what makes that
 * business a prospect. This asks a different question while reading a
 * business's own page: "is this link a social profile?" A Fresha link is not;
 * it is a BOOKING link, recorded below as `web.bookingUrl`.
 *
 * Pointing this at the broad list files every booking link as a social profile
 * and silently drops `web.bookingUrl` from every researched business. That is
 * not hypothetical -- it happened, and three tests caught it.
 */

/**
 * Booking services we recognize by host.
 *
 * Conservative on purpose: a known booking host is machine-readable evidence.
 * Anchor TEXT saying "Book now" is weaker, and is accepted only when the link
 * also leaves the site, so a link to the page's own `#contact` anchor cannot
 * become a claimed booking system.
 */
const BOOKING_HOSTS: readonly string[] = [
  "booksy.com",
  "fresha.com",
  "planity.com",
  "calendly.com",
  "setmore.com",
  "acuityscheduling.com",
  "squareup.com",
  "square.site",
  "vagaro.com",
  "schedulicity.com",
  "simplybook.me",
  "timify.com",
  "phorest.com",
  "treatwell.com",
];

/** Anchor text that explicitly offers booking, in English and French. */
const BOOKING_TEXT = /\b(book|booking|appointment|schedule|reserve|reservation|rendez-vous|reserver|réserver|prendre rendez-vous)\b/i;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function hostMatches(host: string, allowed: readonly string[]): boolean {
  const value = host.toLowerCase().replace(/^www\./, "");
  return allowed.some((candidate) => value === candidate || value.endsWith(`.${candidate}`));
}

/** Absolute http(s) URL resolved against the page, or null. */
function absoluteUrl(href: string, base: string): URL | null {
  try {
    const url = new URL(href, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.toString().length > EXTRACTION_LIMITS.url) return null;
    return url;
  } catch {
    return null;
  }
}

function usableEmail(raw: string): string | null {
  const value = collapse(decodeURIComponent(raw.split("?")[0]));
  if (value.length === 0 || value.length > EXTRACTION_LIMITS.email) return null;
  // Deliberately minimal: one @, something either side, a dot in the domain.
  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value)) return null;
  return value.toLowerCase();
}

function usablePhone(raw: string): string | null {
  const value = collapse(decodeURIComponent(raw.split("?")[0]));
  if (value.length === 0 || value.length > EXTRACTION_LIMITS.phone) return null;
  // A tel: URI the author wrote. We keep their formatting, but it has to
  // contain enough digits to be a number at all.
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 6 || digits.length > 20) return null;
  return value;
}

/** JSON-LD, read through an allowlist. Parsed as data, never evaluated. */
function readJsonLd(raw: string, add: (o: ExtractedObservation) => void): void {
  if (raw.length > EXTRACTION_LIMITS.jsonLdBytes) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return; // Unparseable structured data is simply not evidence.
  }

  // One level of @graph / array unwrapping. No recursive walk: arbitrary
  // nesting is where an allowlist quietly stops being one.
  const nodes: unknown[] = [];
  const consider = (value: unknown) => {
    if (Array.isArray(value)) nodes.push(...value.slice(0, 20));
    else if (value && typeof value === "object") nodes.push(value);
  };
  consider(parsed);
  for (const node of [...nodes]) {
    if (node && typeof node === "object" && "@graph" in node) {
      consider((node as Record<string, unknown>)["@graph"]);
    }
  }

  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;

    if (typeof record.telephone === "string") {
      const phone = usablePhone(record.telephone);
      if (phone) add({ field: "contact.phone", value: phone, kind: "stated" });
    }

    if (typeof record.email === "string") {
      const email = usableEmail(record.email.replace(/^mailto:/i, ""));
      if (email) add({ field: "contact.email", value: email, kind: "stated" });
    }

    for (const value of Array.isArray(record.sameAs) ? record.sameAs.slice(0, 20) : []) {
      if (typeof value !== "string") continue;
      const url = absoluteUrl(value, "https://example.invalid/");
      if (url && hostMatches(url.hostname, SOCIAL_PROFILE_HOSTS)) {
        add({ field: "web.socialLink", value: url.toString(), kind: "stated" });
      }
    }

    // Opening hours, only in the two forms schema.org actually defines.
    const hours = record.openingHours;
    for (const entry of (Array.isArray(hours) ? hours : [hours]).slice(0, EXTRACTION_LIMITS.openingHours)) {
      if (typeof entry !== "string") continue;
      const value = collapse(entry);
      if (value.length > 0 && value.length <= 200) {
        add({ field: "business.openingHours", value, kind: "stated" });
      }
    }

    const spec = record.openingHoursSpecification;
    for (const entry of (Array.isArray(spec) ? spec : [spec]).slice(0, EXTRACTION_LIMITS.openingHours)) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const days = Array.isArray(e.dayOfWeek) ? e.dayOfWeek : [e.dayOfWeek];
      const names = days
        .filter((d): d is string => typeof d === "string")
        .map((d) => collapse(d.replace(/^https?:\/\/schema\.org\//i, "")))
        .filter((d) => d.length > 0 && d.length <= 20);

      if (names.length === 0) continue;
      if (typeof e.opens !== "string" || typeof e.closes !== "string") continue;

      const value = collapse(`${names.join(", ")} ${e.opens}-${e.closes}`);
      if (value.length <= 200) add({ field: "business.openingHours", value, kind: "stated" });
    }
  }
}

/**
 * Extract evidence from one page.
 *
 * `pageUrl` is the URL actually fetched, used to resolve relative links.
 */
export function extractFromHtml(html: string, pageUrl: string): ExtractionResult {
  const observations: ExtractedObservation[] = [];
  const seen = new Set<string>();
  let socialCount = 0;

  const add = (observation: ExtractedObservation) => {
    if (observations.length >= EXTRACTION_LIMITS.observations) return;
    const key = `${observation.field}|${observation.value}`;
    if (seen.has(key)) return;
    if (observation.field === "web.socialLink") {
      if (socialCount >= EXTRACTION_LIMITS.socialLinks) return;
      socialCount += 1;
    }
    seen.add(key);
    observations.push(observation);
  };

  let pageTitle: string | null = null;
  let metaDescription: string | null = null;
  let ogTitle: string | null = null;
  let ogDescription: string | null = null;
  let bookingUrl: string | null = null;

  // Streaming state: what text belongs to the element currently open.
  let capture: "title" | "jsonld" | "anchor" | null = null;
  let buffer = "";
  let anchorHref: string | null = null;
  let jsonLdBlocks = 0;

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        const tag = name.toLowerCase();

        if (tag === "title" && pageTitle === null) {
          capture = "title";
          buffer = "";
          return;
        }

        if (tag === "meta") {
          const key = (attributes.name ?? attributes.property ?? "").toLowerCase();
          const content = attributes.content ?? "";
          if (content.length === 0) return;

          if (key === "description" && metaDescription === null) metaDescription = content;
          if (key === "og:description" && ogDescription === null) ogDescription = content;
          if (key === "og:title" && ogTitle === null) ogTitle = content;
          return;
        }

        if (tag === "script") {
          const type = (attributes.type ?? "").toLowerCase();
          // Only JSON-LD is retained, and only as text to be JSON.parsed.
          // Every other script's contents are discarded unread.
          if (type === "application/ld+json" && jsonLdBlocks < EXTRACTION_LIMITS.jsonLdBlocks) {
            capture = "jsonld";
            buffer = "";
          }
          return;
        }

        if (tag === "a") {
          const href = attributes.href ?? "";
          if (href.length === 0) return;

          if (/^tel:/i.test(href)) {
            const phone = usablePhone(href.slice(4));
            if (phone) add({ field: "contact.phone", value: phone, kind: "stated" });
            return;
          }

          if (/^mailto:/i.test(href)) {
            const email = usableEmail(href.slice(7));
            if (email) add({ field: "contact.email", value: email, kind: "stated" });
            return;
          }

          const url = absoluteUrl(href, pageUrl);
          if (!url) return;

          if (hostMatches(url.hostname, SOCIAL_PROFILE_HOSTS)) {
            add({ field: "web.socialLink", value: url.toString(), kind: "observed" });
            return;
          }

          if (bookingUrl === null && hostMatches(url.hostname, BOOKING_HOSTS)) {
            bookingUrl = url.toString();
            return;
          }

          // Weaker evidence: keep the href and decide once the anchor's text
          // is known, and only if it leaves this site.
          anchorHref = url.toString();
          capture = "anchor";
          buffer = "";
        }
      },

      ontext(text) {
        if (capture === null) return;
        if (buffer.length < EXTRACTION_LIMITS.jsonLdBytes) buffer += text;
      },

      onclosetag(name) {
        const tag = name.toLowerCase();

        if (capture === "title" && tag === "title") {
          const value = collapse(buffer);
          if (value.length > 0) pageTitle = value.slice(0, EXTRACTION_LIMITS.title);
          capture = null;
          buffer = "";
          return;
        }

        if (capture === "jsonld" && tag === "script") {
          jsonLdBlocks += 1;
          readJsonLd(buffer, add);
          capture = null;
          buffer = "";
          return;
        }

        if (capture === "anchor" && tag === "a") {
          const text = collapse(buffer);
          if (
            bookingUrl === null &&
            anchorHref !== null &&
            text.length > 0 &&
            text.length <= 80 &&
            BOOKING_TEXT.test(text)
          ) {
            const target = new URL(anchorHref);
            const here = new URL(pageUrl);
            // An in-page jump is navigation, not a booking system.
            if (target.host !== here.host) bookingUrl = anchorHref;
          }
          capture = null;
          anchorHref = null;
          buffer = "";
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );

  parser.write(html);
  parser.end();

  // Precedence for the two "one value" fields: the element the standard
  // defines wins over the Open Graph variant, which is written for sharing.
  const title = pageTitle ?? (ogTitle === null ? null : collapse(ogTitle).slice(0, EXTRACTION_LIMITS.title));
  const description = metaDescription ?? ogDescription;

  if (title !== null && title.length > 0) {
    add({ field: "web.pageTitle", value: title, kind: "stated" });
  }
  if (description !== null) {
    const value = collapse(description).slice(0, EXTRACTION_LIMITS.description);
    if (value.length > 0) add({ field: "web.description", value, kind: "stated" });
  }
  if (bookingUrl !== null) {
    add({ field: "web.bookingUrl", value: bookingUrl, kind: "observed" });
  }

  return { pageTitle: title, observations };
}
