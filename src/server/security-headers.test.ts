import { describe, expect, it } from "vitest";

import nextConfig, { SECURITY_HEADERS } from "../../next.config";

/** The headers a public, password-protected dashboard must always send. */
describe("security headers", () => {
  const byKey = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key.toLowerCase(), h.value]));

  it("refuses framing by other sites but keeps our own design grid working", () => {
    expect(byKey["x-frame-options"]).toBe("SAMEORIGIN");
    expect(byKey["content-security-policy"]).toBe("frame-ancestors 'self'");
  });

  it("keeps every page out of search indexes", () => {
    expect(byKey["x-robots-tag"]).toContain("noindex");
  });

  it("sends them on every route, and no referrer at all from a share link", async () => {
    const rules = await nextConfig.headers!();
    expect(rules.find((r) => r.source === "/:path*")?.headers).toEqual(SECURITY_HEADERS);
    expect(rules.find((r) => r.source === "/s/:path*")?.headers).toEqual([{ key: "Referrer-Policy", value: "no-referrer" }]);
  });
});
