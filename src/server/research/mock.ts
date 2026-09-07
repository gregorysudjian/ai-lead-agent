import "server-only";

import type {
  ResearchCoverage,
  ResearchProviderInput,
  ResearchProviderResult,
} from "@/lib/business-profile";

import { ResearchProviderError, type ResearchProvider } from "./types";

/**
 * The offline researcher.
 *
 * No model, no network, no randomness, no clock: the same lead always produces
 * the same result. It exists so the whole workflow -- request, validate,
 * persist, render -- can be built and exercised before a single external
 * request is made.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────
 *
 * It returns NO observations and NO sources. Not placeholder ones, not
 * plausible ones, not "example" ones.
 *
 * A mock analyser can write proposals, because a proposal is honest about
 * being one. A mock RESEARCHER cannot write facts, because a fabricated fact
 * is indistinguishable from a real one the moment it is stored -- and the
 * whole point of a profile is that its contents are evidence. Inventing a page
 * title here would put an unsourced claim in the record that later phases, and
 * eventually a human talking to the business, would treat as something we
 * actually found.
 *
 * So this researcher reports, accurately, that it consulted nothing. The facts
 * in the resulting profile all come from the stored discovery record, written
 * by application code and attributed to it. Every area this researcher is
 * responsible for is marked `not-researched`, which is the true answer.
 */

const VERSION = "no-external-sources-v1";

function coverageFor(input: ResearchProviderInput): ResearchCoverage[] {
  return [
    {
      area: "web",
      status: "not-researched",
      note:
        input.website === null
          ? "No website source is connected, and the discovery record listed no website to check."
          : "No website source is connected. The listed website has not been fetched, so nothing on it has been read.",
    },
    {
      area: "business",
      status: "not-researched",
      note:
        "Services, opening hours, booking links and a public description would come from the business's own website, which was not fetched.",
    },
    {
      area: "reputation",
      status: "not-researched",
      note: "No supported review source is connected.",
    },
  ];
}

function limitationsFor(input: ResearchProviderInput): string[] {
  const limitations = [
    "No external source was consulted. Every fact in this profile comes from the stored discovery record.",
  ];

  limitations.push(
    input.website === null
      ? "The discovery provider listed no website. That is not proof the business has none, and nothing here checked."
      : "A website was listed but has not been fetched. Nothing on it has been read, and it is not known to respond.",
  );

  limitations.push(
    "No services, opening hours, booking link, email address or social profile has been researched.",
  );
  limitations.push(
    "Absent values mean nobody looked, not that the business lacks them. See the coverage of each area.",
  );

  return limitations;
}

class MockResearchProvider implements ResearchProvider {
  readonly name = "mock";
  readonly version = VERSION;

  async research(input: ResearchProviderInput): Promise<ResearchProviderResult> {
    // A nameless business cannot be researched, and a run that cannot identify
    // its subject should fail rather than store an empty profile.
    if (input.businessName.trim().length === 0) {
      throw new ResearchProviderError("Business has no usable name to research.");
    }

    return {
      // Nothing was consulted, so there is nothing to cite.
      sources: [],
      // And with nothing cited, there is nothing that could be asserted.
      observations: [],
      coverage: coverageFor(input),
      limitations: limitationsFor(input),
    };
  }
}

export const mockResearchProvider: ResearchProvider = new MockResearchProvider();
