import { describe, expect, it } from "vitest";

import type { BusinessProfile } from "./business-profile";
import { emptyProfileFacts } from "./business-profile";
import { buildContactSheet, composeOutreachDraft } from "./outreach";
import type { Lead } from "./types";

const AT = "2026-09-07T12:00:00.000Z";

const lead = (over: Partial<Lead["provider"]> = {}): Lead => ({
  id: "lead-1",
  status: "new",
  createdAt: AT,
  updatedAt: AT,
  provider: {
    externalId: "node/1",
    source: "osm",
    name: "Crisp",
    category: "Barber shop",
    city: "Montreal",
    address: "1188 Rue Ontario Est",
    phone: "+1 514 934 3300",
    website: null,
    rating: null,
    reviewCount: null,
    openingHours: null,
    fetchedAt: AT,
    ...over,
  },
});

/** A profile with a website source and whatever facts a test needs. */
function profile(
  facts: Partial<Record<string, { value: unknown; sourceId: string; kind: "stated" | "observed" }[]>>,
  options: { webCovered?: boolean } = {},
): BusinessProfile {
  const base = emptyProfileFacts();
  for (const [field, observations] of Object.entries(facts)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixture indexes by field name
    (base as any)[field] = observations;
  }

  return {
    id: "profile-1",
    leadId: "lead-1",
    status: "complete",
    createdAt: AT,
    updatedAt: AT,
    researcher: { name: "website", version: "homepage-v1" },
    sources: [
      {
        id: "lead-snapshot",
        type: "lead-snapshot",
        reference: "osm:node/1",
        fetchedAt: AT,
        title: "OpenStreetMap",
      },
      {
        id: "website-homepage",
        type: "website",
        reference: "https://www.crispmtl.com/",
        fetchedAt: AT,
        title: "CRISP Barbershop",
      },
    ],
    facts: base,
    coverage: [
      {
        area: "web",
        status: options.webCovered === true ? "covered" : "not-researched",
        note: "note",
      },
    ],
    limitations: [],
  };
}

describe("the contact sheet gathers every way we could reach a business", () => {
  it("falls back to the discovery record when nothing has been researched", () => {
    const sheet = buildContactSheet(lead(), null);

    expect(sheet.points).toEqual([
      { channel: "phone", value: "+1 514 934 3300", origin: "discovery", sourceLabel: "Discovery record" },
      { channel: "in-person", value: "1188 Rue Ontario Est", origin: "discovery", sourceLabel: "Discovery record" },
    ]);
    expect(sheet.missing).toEqual(["email", "social"]);
  });

  it("prefers a number read from the business's own page over a directory copy", () => {
    const sheet = buildContactSheet(
      lead(),
      profile({
        "contact.phone": [
          { value: "+1 514 000 0000", sourceId: "website-homepage", kind: "stated" },
        ],
      }),
    );

    const phones = sheet.points.filter((p) => p.channel === "phone");
    expect(phones[0]).toMatchObject({ value: "+1 514 000 0000", origin: "website" });
    // The directory's number is still offered -- it is another way to try.
    expect(phones.map((p) => p.value)).toContain("+1 514 934 3300");
  });

  it("lists every social profile, because they are not alternatives", () => {
    const sheet = buildContactSheet(
      lead(),
      profile({
        "web.socialLink": [
          { value: "https://www.instagram.com/crispmtl/", sourceId: "website-homepage", kind: "observed" },
          { value: "https://www.facebook.com/CrispMontreal", sourceId: "website-homepage", kind: "observed" },
          { value: "https://www.tiktok.com/@crispmtl", sourceId: "website-homepage", kind: "observed" },
        ],
      }),
    );

    expect(sheet.points.filter((p) => p.channel === "social")).toHaveLength(3);
    expect(sheet.missing).not.toContain("social");
  });

  it("collapses the same value listed by two sources", () => {
    const sheet = buildContactSheet(
      lead(),
      profile({
        "contact.phone": [
          { value: "+1 514 934 3300", sourceId: "website-homepage", kind: "stated" },
        ],
      }),
    );

    expect(sheet.points.filter((p) => p.channel === "phone")).toHaveLength(1);
  });

  it("names where each contact came from", () => {
    const sheet = buildContactSheet(
      lead(),
      profile({
        "contact.email": [
          { value: "hello@crispmtl.com", sourceId: "website-homepage", kind: "stated" },
        ],
      }),
    );

    expect(sheet.points.find((p) => p.channel === "email")).toMatchObject({
      origin: "website",
      sourceLabel: "CRISP Barbershop",
    });
  });

  it("reports a website as read only when one was actually read", () => {
    expect(buildContactSheet(lead(), null).websiteRead).toBe(false);

    const read = profile(
      { "web.reachable": [{ value: true, sourceId: "website-homepage", kind: "observed" }] },
      { webCovered: true },
    );
    expect(buildContactSheet(lead(), read).websiteRead).toBe(true);
  });

  it("distinguishes never having looked from having looked and found nothing", () => {
    // No profile at all: nobody looked.
    expect(buildContactSheet(lead(), null).noWebsiteFound).toBe(false);
    // Research ran, web area not covered: we looked and found none.
    expect(buildContactSheet(lead(), profile({})).noWebsiteFound).toBe(true);
  });
});

describe("a draft says only what we can defend", () => {
  const sheet = (over: Partial<ReturnType<typeof buildContactSheet>> = {}) => ({
    ...buildContactSheet(lead(), null),
    ...over,
  });

  it("never tells a business it has no website", () => {
    // The sentence that must not exist. A missing website in our records means
    // no source listed one and our search found none -- not that they have none.
    for (const channel of ["phone", "email", "social", "in-person"] as const) {
      const draft = composeOutreachDraft(lead(), sheet({ noWebsiteFound: true }), channel);
      const text = `${draft.subject ?? ""} ${draft.body}`.toLowerCase();

      expect(text, channel).not.toContain("you don't have a website");
      expect(text, channel).not.toContain("you do not have a website");
      expect(text, channel).not.toContain("your business has no website");
      expect(text, channel).not.toContain("noticed you have no");
    }
  });

  it("frames a missing website as our own failure to find one", () => {
    const draft = composeOutreachDraft(lead(), sheet({ websiteRead: false }), "email");
    expect(draft.body).toContain("could not turn one up");
    // And invites correction, because we might simply have missed it.
    expect(draft.body).toContain("if you have one I have missed");
  });

  it("refers to their site only when one was actually read", () => {
    const draft = composeOutreachDraft(lead(), sheet({ websiteRead: true }), "email");
    expect(draft.body).toContain("had a look at your website");
    expect(draft.body).not.toContain("could not turn one up");
  });

  it("uses the business's own name, category and city and invents nothing", () => {
    const draft = composeOutreachDraft(lead(), sheet(), "email");
    expect(draft.body).toContain("Crisp");
    expect(draft.body).toContain("barber shop");
    expect(draft.body).toContain("Montreal");
  });

  it("gives a subject to email and to nothing else", () => {
    expect(composeOutreachDraft(lead(), sheet(), "email").subject).toBe(
      "A sample website for Crisp",
    );
    for (const channel of ["phone", "social", "in-person"] as const) {
      expect(composeOutreachDraft(lead(), sheet(), channel).subject, channel).toBeNull();
    }
  });

  it("writes a phone draft as something to say, not something to send", () => {
    const draft = composeOutreachDraft(lead(), sheet(), "phone");
    expect(draft.body).toContain("is the owner or manager available?");
    expect(draft.body).toContain("call back");
  });

  it("says a message was sent by hand", () => {
    expect(composeOutreachDraft(lead(), sheet(), "email").body).toContain("not automated");
  });

  it("attaches the contact it would use for that channel", () => {
    const draft = composeOutreachDraft(lead(), buildContactSheet(lead(), null), "phone");
    expect(draft.contact).toBe("+1 514 934 3300");

    // No email anywhere, so the draft honestly carries no contact.
    expect(composeOutreachDraft(lead(), buildContactSheet(lead(), null), "email").contact).toBeNull();
  });

  it("promises no follow-up, and means it", () => {
    // There is no scheduler and no second message anywhere in the system, so
    // this is a statement the application can actually keep.
    expect(composeOutreachDraft(lead(), sheet(), "email").body).toContain(
      "I will not follow up again",
    );
  });
});
