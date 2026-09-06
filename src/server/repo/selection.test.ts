import { afterEach, describe, expect, it } from "vitest";

import { leadRepositoryName, supabaseConfig } from "@/server/env";

/**
 * Repository selection and Supabase configuration.
 *
 * No network and no real credentials: these set process.env directly with
 * obviously fake values and assert on behaviour and error text.
 */
const ENV_KEYS = ["LEAD_REPOSITORY", "SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;
const saved = new Map<string, string | undefined>();

function setEnv(key: string, value: string | undefined) {
  if (!saved.has(key)) saved.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved.has(key)) {
      const original = saved.get(key);
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  }
  saved.clear();
});

describe("repository selection defaults safely", () => {
  it.each([[undefined], [""], ["   "]])(
    "defaults to json when LEAD_REPOSITORY is %j",
    (value) => {
      setEnv("LEAD_REPOSITORY", value);
      // A missing variable must never cause an accidental database connection.
      expect(leadRepositoryName()).toBe("json");
    },
  );

  it.each([["json"], ["JSON"], ["  json  "]])("accepts json spelled %j", (value) => {
    setEnv("LEAD_REPOSITORY", value);
    expect(leadRepositoryName()).toBe("json");
  });

  it.each([["supabase"], ["SUPABASE"], [" Supabase "]])(
    "accepts explicit supabase selection %j",
    (value) => {
      setEnv("LEAD_REPOSITORY", value);
      expect(leadRepositoryName()).toBe("supabase");
    },
  );

  it.each([["postgres"], ["supabse"], ["mysql"], ["true"], ["1"]])(
    "throws on invalid value %j rather than silently falling back",
    (value) => {
      setEnv("LEAD_REPOSITORY", value);
      expect(() => leadRepositoryName()).toThrow(/Invalid LEAD_REPOSITORY/);
    },
  );

  it("names the valid options in the error, and no values", () => {
    setEnv("LEAD_REPOSITORY", "postgres");
    try {
      leadRepositoryName();
      throw new Error("should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("json");
      expect(message).toContain("supabase");
      expect(message).not.toContain("postgres");
    }
  });
});

describe("Supabase configuration fails clearly without leaking secrets", () => {
  const FAKE_URL = "https://fake-project.supabase.co";
  const FAKE_KEY = "fake-secret-key-value-not-real";

  it("returns both settings when present", () => {
    setEnv("SUPABASE_URL", FAKE_URL);
    setEnv("SUPABASE_SECRET_KEY", FAKE_KEY);
    expect(supabaseConfig()).toEqual({ url: FAKE_URL, secretKey: FAKE_KEY });
  });

  it.each([
    ["both missing", undefined, undefined, ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]],
    ["url missing", undefined, FAKE_KEY, ["SUPABASE_URL"]],
    ["key missing", FAKE_URL, undefined, ["SUPABASE_SECRET_KEY"]],
  ])("throws naming the missing variable when %s", (_label, url, key, expected) => {
    setEnv("SUPABASE_URL", url);
    setEnv("SUPABASE_SECRET_KEY", key);
    try {
      supabaseConfig();
      throw new Error("should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      for (const name of expected) expect(message).toContain(name);
      // The message names variables, never values.
      expect(message).not.toContain(FAKE_KEY);
      expect(message).not.toContain(FAKE_URL);
    }
  });

  it("never includes the secret key in any error, even when the URL is invalid", () => {
    setEnv("SUPABASE_URL", "not-a-url");
    setEnv("SUPABASE_SECRET_KEY", FAKE_KEY);
    try {
      supabaseConfig();
      throw new Error("should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("Invalid SUPABASE_URL");
      expect(message).not.toContain(FAKE_KEY);
      expect(message).not.toContain("not-a-url");
    }
  });

  it("suggests the local store instead of hinting at credentials", () => {
    setEnv("SUPABASE_URL", undefined);
    setEnv("SUPABASE_SECRET_KEY", undefined);
    expect(() => supabaseConfig()).toThrow(/LEAD_REPOSITORY=json/);
  });

  it.each([["ftp://x.example.com"], ["file:///etc/passwd"], ["javascript:alert(1)"]])(
    "rejects a non-http(s) SUPABASE_URL %j",
    (url) => {
      setEnv("SUPABASE_URL", url);
      setEnv("SUPABASE_SECRET_KEY", FAKE_KEY);
      expect(() => supabaseConfig()).toThrow(/Invalid SUPABASE_URL/);
    },
  );
});
