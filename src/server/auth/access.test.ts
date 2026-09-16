import { describe, expect, it } from "vitest";

import { apiAccess, GUEST_SUBJECT, isGuest } from "./access";
import { GUEST_SESSION_DURATION_MS, newSessionPayload, SESSION_DURATION_MS } from "./token";

describe("who may use the API", () => {
  it("lets the operator through", () => {
    expect(apiAccess({ sub: "operator" })).toBe("allowed");
  });

  it("refuses a guest as read-only, not as signed out", () => {
    expect(apiAccess({ sub: GUEST_SUBJECT })).toBe("read-only");
    expect(isGuest({ sub: GUEST_SUBJECT })).toBe(true);
  });

  it("refuses no session at all as unauthenticated", () => {
    expect(apiAccess(null)).toBe("unauthenticated");
    expect(isGuest(null)).toBe(false);
  });
});

describe("session length", () => {
  it("gives the operator a week and a guest a day", () => {
    const now = Date.parse("2026-09-16T12:00:00Z");
    expect(newSessionPayload("operator", now).exp - now).toBe(SESSION_DURATION_MS);
    expect(newSessionPayload(GUEST_SUBJECT, now, GUEST_SESSION_DURATION_MS).exp - now).toBe(
      24 * 60 * 60 * 1000,
    );
  });
});
