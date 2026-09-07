import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { discoverySourceNames } from "@/server/env";

/**
 * Configuration, and the architecture rules that keep the key server-side.
 */

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

function withEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("DISCOVERY_SOURCES selects the sources for a run", () => {
  it("reads a single source", () => {
    withEnv({ DISCOVERY_SOURCES: "osm" });
    expect(discoverySourceNames()).toEqual(["osm"]);
  });

  it("reads a list, preserving order", () => {
    withEnv({ DISCOVERY_SOURCES: "google,osm" });
    expect(discoverySourceNames()).toEqual(["google", "osm"]);
  });

  it("tolerates spacing and case", () => {
    withEnv({ DISCOVERY_SOURCES: " OSM , Google " });
    expect(discoverySourceNames()).toEqual(["osm", "google"]);
  });

  it("collapses a repeated source", () => {
    withEnv({ DISCOVERY_SOURCES: "osm,osm" });
    expect(discoverySourceNames()).toEqual(["osm"]);
  });

  it("throws on an unknown name rather than skipping it", () => {
    // Skipping would run an OSM-only search and report it as though Google had
    // been asked and found nothing.
    withEnv({ DISCOVERY_SOURCES: "osm,googel" });
    expect(() => discoverySourceNames()).toThrow(/Invalid DISCOVERY_SOURCES/);
  });

  it("throws on a list that contains nothing usable", () => {
    withEnv({ DISCOVERY_SOURCES: " , , " });
    expect(() => discoverySourceNames()).toThrow(/Invalid DISCOVERY_SOURCES/);
  });
});

describe("the default is the existing configuration, and it stays safe", () => {
  it("falls back to PLACES_PROVIDER when unset", () => {
    withEnv({ DISCOVERY_SOURCES: undefined, PLACES_PROVIDER: "osm" });
    expect(discoverySourceNames()).toEqual(["osm"]);
  });

  it("falls back to mock when neither is set", () => {
    withEnv({ DISCOVERY_SOURCES: undefined, PLACES_PROVIDER: undefined });
    // The whole chain ends at the offline source, so a missing variable can
    // never cause a billable call.
    expect(discoverySourceNames()).toEqual(["mock"]);
  });

  it("never adds google on its own", () => {
    for (const places of [undefined, "mock", "osm"]) {
      withEnv({ DISCOVERY_SOURCES: undefined, PLACES_PROVIDER: places });
      expect(discoverySourceNames(), String(places)).not.toContain("google");
    }
  });

  it("treats an empty DISCOVERY_SOURCES as unset", () => {
    withEnv({ DISCOVERY_SOURCES: "   ", PLACES_PROVIDER: "osm" });
    expect(discoverySourceNames()).toEqual(["osm"]);
  });

  it("propagates an invalid PLACES_PROVIDER rather than guessing", () => {
    withEnv({ DISCOVERY_SOURCES: undefined, PLACES_PROVIDER: "googel" });
    expect(() => discoverySourceNames()).toThrow(/Invalid PLACES_PROVIDER/);
  });
});

describe("the Google key cannot reach the browser", () => {
  const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

  it("is read only through the server-only env module", () => {
    const offenders = listFiles(join(process.cwd(), "src"))
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      // Application code only. A test may name the variable to prove what
      // happens when it is missing; what matters is which module READS it.
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => readFileSync(file, "utf8").includes("GOOGLE_PLACES_API_KEY"))
      .map((file) => file.replace(process.cwd(), "").split(sep).join("/"));

    // env.ts reads it; nothing else in the application names the variable.
    expect(offenders).toEqual(["/src/server/env.ts"]);
  });

  it("is never exposed under a NEXT_PUBLIC name", () => {
    const env = read("src", "server", "env.ts");
    expect(env).not.toContain("NEXT_PUBLIC_GOOGLE");
    expect(read("src", "components", "discovery-panel.tsx")).not.toContain("GOOGLE");
  });

  it("keeps the client panel free of any server module", () => {
    const panel = read("src", "components", "discovery-panel.tsx");
    expect(panel).toContain('"use client"');
    // A client component may know source NAMES; it must not import the server.
    expect(panel).not.toContain("@/server/");
  });

  it("guards every discovery server module with server-only", () => {
    for (const file of [
      ["src", "server", "discovery", "index.ts"],
      ["src", "server", "discovery", "orchestrator.ts"],
      ["src", "server", "discovery", "google-source.ts"],
      ["src", "server", "discovery", "places-sources.ts"],
      ["src", "server", "discovery-service.ts"],
    ]) {
      expect(read(...file), file.join("/")).toContain('import "server-only"');
    }
  });
});

/** Minimal recursive listing; kept local so the test needs no helper module. */
function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}
