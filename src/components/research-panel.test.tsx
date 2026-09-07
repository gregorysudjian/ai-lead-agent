import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { BusinessProfile } from "@/lib/business-profile";
import { emptyProfileFacts } from "@/lib/business-profile";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

const { ResearchPanel } = await import("./research-panel");

/**
 * How evidence is presented.
 *
 * The distinction under test caused a real defect: a business's Instagram,
 * Facebook and Twitter links were rendered as "other sources recorded a
 * different value", which reads as three sources contradicting each other. A
 * field that expects SEVERAL values is not a field with a conflict, and in a
 * record whose whole purpose is to be trustworthy, that difference matters.
 */

const profile = (): BusinessProfile => ({
  id: "p1",
  leadId: "l1",
  status: "complete",
  createdAt: "2026-09-07T05:00:00.000Z",
  updatedAt: "2026-09-07T05:00:00.000Z",
  researcher: { name: "website", version: "homepage-v1" },
  sources: [
    {
      id: "lead-snapshot",
      type: "lead-snapshot",
      reference: "osm:node/1",
      fetchedAt: "2026-09-06T06:00:00.000Z",
      title: "OpenStreetMap",
    },
    {
      id: "website-homepage",
      type: "website",
      reference: "https://salon.example/",
      fetchedAt: "2026-09-07T05:00:00.000Z",
      title: "Salon",
    },
  ],
  facts: {
    ...emptyProfileFacts(),
    // One value expected: two observations here really do disagree.
    "contact.phone": [
      { value: "+1 514 844 4384", sourceId: "lead-snapshot", kind: "observed" },
      { value: "514844-4384", sourceId: "website-homepage", kind: "stated" },
    ],
    // Several values expected: three profiles, not three contradictions.
    "web.socialLink": [
      { value: "https://twitter.com/salon", sourceId: "website-homepage", kind: "observed" },
      { value: "https://www.instagram.com/salon/", sourceId: "website-homepage", kind: "observed" },
      { value: "https://www.facebook.com/salon/", sourceId: "website-homepage", kind: "observed" },
    ],
  },
  coverage: [
    { area: "identity", status: "covered", note: "From the stored discovery record." },
    { area: "contact", status: "covered", note: "From the stored discovery record." },
    { area: "web", status: "covered", note: "The homepage was fetched." },
    { area: "business", status: "not-researched", note: "Nothing was consulted." },
    { area: "reputation", status: "not-researched", note: "Nothing was consulted." },
  ],
  limitations: ["Only the homepage was read."],
});

/** Rendered markup with tags and React's text-node separators removed. */
function renderText(p: BusinessProfile): string {
  const html = renderToStaticMarkup(
    <ResearchPanel
      leadId="l1"
      profiles={[p]}
      researcher={{ name: "website", version: "homepage-v1" }}
    />,
  );
  return html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

describe("fields expecting several values are not shown as conflicts", () => {
  const text = renderText(profile());

  it("lists every social profile", () => {
    expect(text).toContain("https://twitter.com/salon");
    expect(text).toContain("https://www.instagram.com/salon/");
    expect(text).toContain("https://www.facebook.com/salon/");
  });

  it("attributes each one to its source rather than calling them contradictory", () => {
    // Exactly one conflict panel, and it belongs to the phone number.
    expect(text.match(/recorded a different value/g)).toHaveLength(1);
  });

  it("still shows a genuine conflict on a single-value field", () => {
    expect(text).toContain("recorded a different value");
    expect(text).toContain("+1 514 844 4384");
    // The website's own statement is preferred for a contact detail.
    expect(text).toContain("514844-4384");
  });
});

describe("the panel says what a run would do", () => {
  it("names the research mode", () => {
    expect(renderText(profile())).toContain("Website research");
  });

  it("labels the offline mode differently", () => {
    const html = renderToStaticMarkup(
      <ResearchPanel leadId="l1" profiles={[]} researcher={{ name: "mock", version: "v1" }} />,
    );
    expect(html).toContain("Offline researcher");
    expect(html).toContain("consults no external source");
  });
});

describe("provenance is visible on every value", () => {
  const text = renderText(profile());

  it("distinguishes what a source stated from what we observed in a record", () => {
    expect(text).toContain("stated by");
    expect(text).toContain("observed in");
  });

  it("lists the sources with the reference actually read", () => {
    expect(text).toContain("https://salon.example/");
    expect(text).toContain("osm:node/1");
  });

  it("reports coverage for every area", () => {
    expect(text).toContain("Web presence: Researched");
    expect(text).toContain("Reputation: Not researched");
  });
});
