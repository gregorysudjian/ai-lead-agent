import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  MIN_SESSION_SECRET_LENGTH,
  newSessionPayload,
  SESSION_DURATION_MS,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./token";

const SECRET = "test-secret-that-is-long-enough-for-real-use";
const OTHER_SECRET = "a-different-secret-of-a-similar-sort-of-length";
const NOW = Date.parse("2026-01-01T00:00:00.000Z");

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return { v: 1, sub: "operator", iat: NOW, exp: NOW + SESSION_DURATION_MS, ...overrides };
}

describe("signSessionToken / verifySessionToken", () => {
  it("round-trips a payload", () => {
    const token = signSessionToken(payload(), SECRET);
    expect(verifySessionToken(token, SECRET, NOW)).toEqual(payload());
  });

  it("produces a two-part token and nothing more", () => {
    expect(signSessionToken(payload(), SECRET).split(".")).toHaveLength(2);
  });

  it("does not put the subject in the token in readable form", () => {
    // base64url, not plaintext -- a shoulder-surfer reading a cookie jar
    // should not find "operator" sitting there as a string.
    expect(signSessionToken(payload(), SECRET)).not.toContain("operator");
  });
});

describe("verifySessionToken rejects", () => {
  it("a token signed with a different secret", () => {
    const token = signSessionToken(payload(), OTHER_SECRET);
    expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
  });

  it("a token whose payload was edited after signing", () => {
    const token = signSessionToken(payload(), SECRET);
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify(payload({ sub: "attacker" })),
      "utf8",
    ).toString("base64url");
    expect(verifySessionToken(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("a token whose expiry was pushed out after signing", () => {
    // The attack this actually defends: take a real expired token and edit
    // exp. Without signature-before-parse this would succeed.
    const token = signSessionToken(payload(), SECRET);
    const [, signature] = token.split(".");
    const extended = Buffer.from(
      JSON.stringify(payload({ exp: NOW + SESSION_DURATION_MS * 100 })),
      "utf8",
    ).toString("base64url");
    expect(verifySessionToken(`${extended}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("a token with a tampered signature", () => {
    const token = signSessionToken(payload(), SECRET);
    const [body] = token.split(".");
    expect(verifySessionToken(`${body}.not-the-signature`, SECRET, NOW)).toBeNull();
  });

  it("a token with no signature at all", () => {
    const [body] = signSessionToken(payload(), SECRET).split(".");
    expect(verifySessionToken(body, SECRET, NOW)).toBeNull();
    expect(verifySessionToken(`${body}.`, SECRET, NOW)).toBeNull();
  });

  it("a three-part JWT-shaped token", () => {
    // Guards the shape explicitly: we never issue three parts, so we never
    // accept them, and no `alg` header can be smuggled in.
    const token = signSessionToken(payload(), SECRET);
    expect(verifySessionToken(`${token}.extra`, SECRET, NOW)).toBeNull();
  });

  it("an expired token", () => {
    const token = signSessionToken(payload(), SECRET);
    expect(verifySessionToken(token, SECRET, NOW + SESSION_DURATION_MS + 1)).toBeNull();
  });

  it("a token at the exact instant it expires", () => {
    const token = signSessionToken(payload(), SECRET);
    expect(verifySessionToken(token, SECRET, NOW + SESSION_DURATION_MS)).toBeNull();
  });

  it("a token one millisecond before it expires", () => {
    const token = signSessionToken(payload(), SECRET);
    expect(verifySessionToken(token, SECRET, NOW + SESSION_DURATION_MS - 1)).not.toBeNull();
  });

  it("a payload from an older format version", () => {
    const body = Buffer.from(
      JSON.stringify({ ...payload(), v: 0 }),
      "utf8",
    ).toString("base64url");
    // Signed correctly -- rejected purely on version, which is the lever for
    // invalidating every outstanding session at once.
    const token = signSessionToken({ ...payload(), v: 0 } as unknown as SessionPayload, SECRET);
    expect(token.startsWith(body)).toBe(true);
    expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
  });

  it("a correctly signed payload missing required fields", () => {
    for (const bad of [{}, { v: 1 }, { v: 1, sub: "x" }, { v: 1, sub: "x", iat: NOW }]) {
      const token = signSessionToken(bad as unknown as SessionPayload, SECRET);
      expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
    }
  });

  it("a correctly signed payload with wrong field types", () => {
    for (const bad of [
      { v: 1, sub: "", iat: NOW, exp: NOW + 1000 },
      { v: 1, sub: 42, iat: NOW, exp: NOW + 1000 },
      { v: 1, sub: "x", iat: "soon", exp: NOW + 1000 },
      { v: 1, sub: "x", iat: NOW, exp: Number.NaN },
      { v: 1, sub: "x", iat: NOW, exp: Number.POSITIVE_INFINITY },
    ]) {
      const token = signSessionToken(bad as unknown as SessionPayload, SECRET);
      expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
    }
  });

  it("a correctly signed body that is not JSON", () => {
    const body = Buffer.from("not json at all", "utf8").toString("base64url");
    const signature = createHmac("sha256", SECRET).update(body).digest("base64url");
    expect(verifySessionToken(`${body}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("a correctly signed JSON scalar rather than an object", () => {
    for (const scalar of ["null", '"a string"', "42"]) {
      const body = Buffer.from(scalar, "utf8").toString("base64url");
        const signature = createHmac("sha256", SECRET).update(body).digest("base64url");
      expect(verifySessionToken(`${body}.${signature}`, SECRET, NOW)).toBeNull();
    }
  });

  it("empty, missing and junk input", () => {
    for (const junk of ["", "   ", ".", "..", "garbage", undefined, null]) {
      expect(verifySessionToken(junk, SECRET, NOW)).toBeNull();
    }
  });
});

describe("newSessionPayload", () => {
  it("issues a session expiring one week out", () => {
    const issued = newSessionPayload("operator", NOW);
    expect(issued).toEqual({ v: 1, sub: "operator", iat: NOW, exp: NOW + SESSION_DURATION_MS });
  });

  it("verifies against its own signature", () => {
    const issued = newSessionPayload("operator", NOW);
    expect(verifySessionToken(signSessionToken(issued, SECRET), SECRET, NOW)).toEqual(issued);
  });
});

describe("MIN_SESSION_SECRET_LENGTH", () => {
  it("is long enough to be worth having", () => {
    // 32 characters is the floor the env validation enforces. Stated as a
    // test so lowering it is a deliberate edit to an assertion.
    expect(MIN_SESSION_SECRET_LENGTH).toBeGreaterThanOrEqual(32);
  });
});
