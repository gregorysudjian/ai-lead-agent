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

/**
 * Source with comments removed.
 *
 * These checks are about what the code DOES. A doc comment explaining why we
 * do not call global fetch, or that TLS verification is deliberately left
 * alone, must not read as the thing it is warning against.
 */
function codeOnly(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*/g, " ");
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

  it("only the research stack and its readers know about profiles", () => {
    // The list grows in ONE direction: things that READ a finished profile.
    // Outreach is the first of them -- the pipeline is
    // Lead -> BusinessProfile -> Analysis -> DemoSite, and reading the sourced
    // profile is exactly what a downstream step is supposed to do instead of
    // going and looking for itself. What must never appear here is something
    // that WRITES a profile from outside the research stack, which is still
    // guarded by the repository's own validation.
    const allowed = [
      join("lib", "business-profile"),
      join("lib", "profile-facts"),
      join("lib", "outreach"),
      join("server", "research"),
      join("server", "outreach-service"),
      join("server", "repo", "profile-"),
      join("server", "repo", "index.ts"),
      join("components", "research-panel"),
      join("components", "outreach-panel"),
      join("app", "leads"),
      join("app", "api", "leads"),
      join("app", "api", "outreach"),
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

describe("exactly one module may open a socket", () => {
  const RESEARCH = join(SRC, "server", "research");
  const FETCH_LAYER = join(RESEARCH, "safe-fetch.ts");

  it("keeps every raw network call inside safe-fetch.ts", () => {
    // Everything else must go through `safeFetch`, because that is where the
    // DNS resolution, the address validation and the connection pinning live.
    // A second place that opens a socket is a second place to get it wrong.
    for (const file of sourceFiles(RESEARCH)) {
      if (file === FETCH_LAYER) continue;

      const source = codeOnly(file);
      for (const call of [
        "node:http",
        "node:https",
        "node:net",
        "node:tls",
        "httpRequest(",
        "httpsRequest(",
        "XMLHttpRequest",
      ]) {
        expect(source, `${file} must not open a socket directly`).not.toContain(call);
      }
    }
  });

  it("uses no global fetch anywhere in the research stack", () => {
    // Global fetch resolves the hostname itself, which is the exact gap the
    // pinned lookup exists to close.
    for (const file of sourceFiles(RESEARCH)) {
      expect(codeOnly(file), `${file} must not call global fetch`).not.toMatch(
        /[^.\w]fetch\(/,
      );
    }
  });

  it("never disables TLS verification", () => {
    for (const file of sourceFiles(join(SRC, "server"))) {
      const source = codeOnly(file);
      expect(source, file).not.toContain("rejectUnauthorized");
      expect(source, file).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED");
    }
  });

  it("routes robots and the page through the same fetch layer", () => {
    for (const name of ["robots.ts", "website.ts"]) {
      expect(codeOnly(join(RESEARCH, name)), name).toContain("safe-fetch");
    }
  });

  it("keeps the HTML parser out of the network layer, and vice versa", () => {
    // The extractor is pure: a string in, candidate observations out. Keeping
    // it free of I/O is what lets every extraction rule be tested directly.
    const extractor = codeOnly(join(RESEARCH, "html-extract.ts"));
    expect(extractor).not.toContain("safe-fetch");
    expect(extractor).not.toContain("node:");
  });
});
