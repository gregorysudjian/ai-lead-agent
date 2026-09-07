import "server-only";

import type {
  ObservationDraft,
  ResearchCoverage,
  ResearchProviderInput,
  ResearchProviderResult,
  SourceRecord,
} from "@/lib/business-profile";

import { extractFromHtml } from "./html-extract";
import { checkRobots } from "./robots";
import { SafeFetchError, safeFetch, type SafeFetchOptions } from "./safe-fetch";
import { PROFILE_SOURCE_ID, assertResearchableUrl } from "./website-source";
import { noWebsiteLocator, type LocatedWebsite, type WebsiteLocator } from "./website-locator";
import type { ResearchSource } from "./types";

/**
 * The first real research specialist: read the business's own homepage.
 *
 * ── SCOPE, WHICH IS SMALL ON PURPOSE ──────────────────────────────────────
 *
 * One page. The website already listed on the lead, and no other. It does not
 * search for a site, does not follow links, does not queue anything, and does
 * not come back for a second page. A run is at most two bounded requests --
 * robots.txt, then the homepage -- plus any redirect hops, each individually
 * validated.
 *
 * ── WHAT A FAILURE MEANS, AND WHAT IT DOES NOT ────────────────────────────
 *
 * This is the distinction the whole source turns on. A successful HTML
 * response proves the site answered, so `web.reachable = true` is recorded. A
 * FAILURE proves nothing at all: a timeout, a DNS error, a TLS problem, a
 * robots refusal, a PDF where a page was expected -- none of them is evidence
 * that the business has no website, and none of them writes
 * `web.reachable = false`.
 *
 * Failures become `unavailable` coverage and a limitation saying what happened.
 * The one thing this source never does is convert "we could not look" into a
 * fact about the business.
 */

const VERSION = "homepage-v1";

/** How many observations one page may contribute to a profile. */
const MAX_OBSERVATIONS = 20;

export interface WebsiteResearchOptions {
  /** Test seams, passed through to the fetch layer. Unused in production. */
  fetchOptions?: SafeFetchOptions;
  now?: () => Date;
  /**
   * How to find a site when the discovery record lists none.
   *
   * Defaults to finding nothing, so this source behaves exactly as it did
   * before and no request reaches a third-party directory unless a locator is
   * deliberately configured. See `website-locator.ts` for why a locator may
   * return only a URL.
   */
  locateWebsite?: WebsiteLocator;
}

function notResearched(note: string): ResearchCoverage[] {
  return [{ area: "web", status: "not-researched", note }];
}

function unavailable(note: string): ResearchCoverage[] {
  return [{ area: "web", status: "unavailable", note }];
}

/**
 * A plain sentence for each way a fetch can fail.
 *
 * Deliberately does not carry the underlying message: a response body or a
 * socket error can contain anything, and a limitation is shown in the UI.
 */
function describeFailure(error: unknown): string {
  const reason = error instanceof SafeFetchError ? error.reason : "network";

  switch (reason) {
    case "unsafe-url":
      return "The listed website address could not be safely fetched, so nothing on it was read.";
    case "dns":
      return "The listed website's address could not be resolved to a public server, so nothing on it was read.";
    case "timeout":
      return "The listed website did not respond in time, so nothing on it was read.";
    case "too-large":
      return "The listed website's homepage was larger than this research reads, so nothing on it was recorded.";
    case "unsupported-content-type":
      return "The listed website did not return a web page, so nothing on it was read.";
    case "too-many-redirects":
    case "redirect-loop":
    case "bad-redirect":
      return "The listed website redirected in a way this research does not follow, so nothing on it was read.";
    case "http-error":
      return "The listed website returned an error, so nothing on it was read.";
    default:
      return "The listed website could not be reached, so nothing on it was read.";
  }
}

/** Always appended: a failure here is never proof about the business. */
const NOT_PROOF =
  "A website that could not be read is not evidence that the business has no website, or that anything on it is missing.";

export function createWebsiteResearchSource(
  options: WebsiteResearchOptions = {},
): ResearchSource {
  const now = options.now ?? (() => new Date());
  const locate = options.locateWebsite ?? noWebsiteLocator;

  return {
    name: "website",
    area: "web",

    async gather(input: ResearchProviderInput): Promise<ResearchProviderResult> {
      // No listed website: ask the locator, which may be configured to look a
      // known business up in a directory. It returns a URL or nothing -- never
      // any other fact -- so what we end up storing is still our own reading of
      // the business's own page.
      let located: LocatedWebsite | null = null;
      let websiteUrl = input.website;

      if (websiteUrl === null) {
        located = await locate(input);
        websiteUrl = located?.url ?? null;
      }

      if (websiteUrl === null) {
        return {
          sources: [],
          observations: [],
          coverage: notResearched(
            "The discovery record listed no website, and none was found for this business.",
          ),
          limitations: [
            "No website was listed or found, so none was fetched. That is not proof the business has none.",
          ],
        };
      }

      let target: URL;
      try {
        target = assertResearchableUrl(websiteUrl);
      } catch {
        return {
          sources: [],
          observations: [],
          coverage: unavailable(
            "The listed website address is not one this research is permitted to fetch.",
          ),
          limitations: [
            "The listed website address could not be fetched safely, so nothing on it was read.",
            NOT_PROOF,
          ],
        };
      }

      // Politeness first, and through the same safe layer as the page itself.
      const robots = await checkRobots(target, options.fetchOptions);
      if (!robots.allowed) {
        return {
          sources: [],
          observations: [],
          coverage: unavailable(robots.reason),
          limitations: [robots.reason, NOT_PROOF],
        };
      }

      let response;
      try {
        response = await safeFetch(target.toString(), options.fetchOptions);
      } catch (error) {
        const note = describeFailure(error);
        return {
          sources: [],
          observations: [],
          // `unavailable`, never a `web.reachable = false` observation.
          coverage: unavailable(note),
          limitations: [note, NOT_PROOF],
        };
      }

      const extraction = extractFromHtml(response.body, response.finalUrl);

      const source: SourceRecord = {
        id: PROFILE_SOURCE_ID,
        type: "website",
        // The page ACTUALLY read, after redirects -- not what we asked for.
        reference: response.finalUrl,
        fetchedAt: now().toISOString(),
        title: extraction.pageTitle,
      };

      const observations: ObservationDraft[] = [
        // The one fact the fetch itself establishes.
        { field: "web.reachable", value: true, sourceId: source.id, kind: "observed" },
        ...extraction.observations
          .slice(0, MAX_OBSERVATIONS)
          .map((o) => ({ ...o, sourceId: source.id })),
      ];

      const limitations = [
        "Only the homepage was read. Nothing else on the site was fetched.",
        "Only values the page marked up as such were recorded -- a phone number in a tel: link, an address in structured data. Prose was not interpreted.",
        "No services, rating or review count was taken from the site: a business describing itself is not an independent source for either.",
      ];

      if (located !== null) {
        // Provenance for the POINTER, kept separate from the evidence. The
        // facts below come from the page itself; only the address of the page
        // came from elsewhere, and a reader should be able to see that.
        limitations.push(
          `The discovery record listed no website. This address was located by matching the business in Google Places on ${located.matchedBy}, and only the address was taken from there -- every fact below was read from the page itself.`,
        );
      }

      if (response.chain.length > 1) {
        limitations.push(
          `The listed address redirected to ${response.finalUrl}, which is the page these facts came from.`,
        );
      }

      return {
        sources: [source],
        observations,
        coverage: [
          {
            area: "web",
            status: "covered",
            note: `The homepage at ${response.finalUrl} was fetched and read.`,
          },
        ],
        limitations,
      };
    },
  };
}

export const websiteResearchSource = createWebsiteResearchSource();

export const WEBSITE_SOURCE_VERSION = VERSION;
