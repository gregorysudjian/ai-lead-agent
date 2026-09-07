import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { BusinessProfileDraft, ProfileField } from "@/lib/business-profile";
import { PROFILE_FIELDS, PROFILE_FIELD_LIST, emptyProfileFacts } from "@/lib/business-profile";

import { BusinessProfileRowMappingError, assertValidProfileDraft } from "./profile-mapping";

/**
 * Architecture-level rules.
 *
 * Each of these is a property the design depends on and that a reasonable
 * future change could quietly break: enrichment leaking onto Lead, an
 * "inferred" fact kind creeping in, a fact stored without a source, or the
 * existing analysis and demo pipelines being rewired to a profile before that
 * migration is deliberately made.
 */

const SRC = join(process.cwd(), "src");

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (entry.name.includes(".test.")) return [];
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : [];
  });
}

const draft = (field: ProfileField, sourceId: string): BusinessProfileDraft => ({
  researcher: { name: "mock", version: "v1" },
  sources: [
    {
      id: "lead-snapshot",
      type: "lead-snapshot",
      reference: "osm:node/1",
      fetchedAt: "2026-09-06T06:00:00.000Z",
      title: null,
    },
  ],
  facts: {
    ...emptyProfileFacts(),
    [field]: [
      {
        value: PROFILE_FIELDS[field].type === "number" ? 1 : PROFILE_FIELDS[field].type === "boolean" ? true : PROFILE_FIELDS[field].url ? "https://example.test/" : "value",
        sourceId,
        kind: "observed",
      },
    ],
  },
  coverage: [
    { area: "identity", status: "not-researched", note: "n" },
    { area: "contact", status: "not-researched", note: "n" },
    { area: "web", status: "not-researched", note: "n" },
    { area: "business", status: "not-researched", note: "n" },
    { area: "reputation", status: "not-researched", note: "n" },
  ],
  limitations: [],
});

describe("no fact can exist without a source, on any field", () => {
  it.each(PROFILE_FIELD_LIST.map((f) => [f]))(
    "%s rejects an observation citing a source that is not in the profile",
    (field) => {
      expect(() => assertValidProfileDraft(draft(field as ProfileField, "not-a-source"))).toThrow(
        BusinessProfileRowMappingError,
      );
    },
  );

  it.each(PROFILE_FIELD_LIST.map((f) => [f]))(
    "%s accepts the same observation once its source is present",
    (field) => {
      expect(() =>
        assertValidProfileDraft(draft(field as ProfileField, "lead-snapshot")),
      ).not.toThrow();
    },
  );
});

describe("a profile records evidence, never a conclusion", () => {
  it("declares no observation kind beyond stated and observed", () => {
    const domain = readFileSync(join(SRC, "lib", "business-profile.ts"), "utf8");
    const declaration = domain.slice(domain.indexOf("export type ObservationKind"));
    const line = declaration.slice(0, declaration.indexOf(";"));

    expect(line).toContain('"stated"');
    expect(line).toContain('"observed"');
    expect(line).not.toContain('"inferred"');
    expect(line).not.toContain('"assumed"');
    expect(line).not.toContain('"estimated"');
  });

  it("has no profile field for a judgement about the business", () => {
    // These are analysis territory. A profile that could hold them would blur
    // the one distinction the whole pipeline rests on.
    const fields = PROFILE_FIELD_LIST.join(" ").toLowerCase();
    for (const judgement of [
      "quality",
      "premium",
      "popular",
      "reputation.sentiment",
      "score",
      "priority",
      "intent",
      "revenue",
      "demographic",
      "recommend",
    ]) {
      expect(fields).not.toContain(judgement);
    }
  });
});

describe("enrichment did not leak onto the earlier domain objects", () => {
  const ENRICHMENT_ONLY = [
    "pageTitle",
    "socialLink",
    "bookingUrl",
    "sourceId",
    "observations",
    "coverage",
  ];

  it.each([["types.ts"], ["analysis.ts"], ["demo-site.ts"]])(
    "src/lib/%s gained no profile field",
    (file) => {
      const source = readFileSync(join(SRC, "lib", file), "utf8");
      for (const field of ENRICHMENT_ONLY) {
        expect(source, `${file} must not declare ${field}`).not.toContain(`${field}:`);
      }
    },
  );

  it("Lead still has exactly the provider snapshot and our own four fields", () => {
    const source = readFileSync(join(SRC, "lib", "types.ts"), "utf8");
    const lead = source.slice(source.indexOf("export interface Lead "));
    const body = lead.slice(0, lead.indexOf("\n}"));

    for (const own of ["id:", "status:", "createdAt:", "updatedAt:", "provider:"]) {
      expect(body).toContain(own);
    }
    expect(body).not.toContain("profile");
    expect(body).not.toContain("research");
  });
});

describe("the existing pipelines are untouched by this phase", () => {
  it("analysis and demo generation still read the lead, not a profile", () => {
    // Phase 9B migrates them deliberately. Until then, wiring a profile into
    // either would change behaviour nobody asked to change.
    for (const file of [
      join(SRC, "server", "analysis-service.ts"),
      join(SRC, "server", "demo-service.ts"),
      join(SRC, "lib", "analysis-facts.ts"),
      join(SRC, "lib", "demo-facts.ts"),
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must not depend on business profiles yet`).not.toContain(
        "business-profile",
      );
      expect(source).not.toContain("BusinessProfile");
    }
  });

  it("only the research stack and the UI know about profiles", () => {
    const allowed = [
      join("lib", "business-profile"),
      join("lib", "profile-facts"),
      join("server", "research"),
      join("server", "repo", "profile-"),
      join("server", "repo", "index.ts"),
      join("components", "research-panel"),
      join("app", "leads"),
      join("app", "api", "leads"),
    ];

    for (const file of sourceFiles()) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("business-profile")) continue;

      const relative = file.slice(SRC.length + 1);
      expect(
        allowed.some((prefix) => relative.includes(prefix)),
        `${relative} imports business-profile but is not part of the research stack`,
      ).toBe(true);
    }
  });
});

describe("nothing in this phase performs research", () => {
  it("the research stack opens no socket", () => {
    const dir = join(SRC, "server", "research");
    for (const file of sourceFiles(dir)) {
      const source = readFileSync(file, "utf8");
      for (const call of ["fetch(", "https.request", "http.request", "net.connect", "XMLHttpRequest"]) {
        expect(source, `${file} must not make a request in this phase`).not.toContain(call);
      }
    }
  });
});
