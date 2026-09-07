import { describe, expect, it } from "vitest";

import {
  ALLOWED_CONTENT_TYPES,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  RESEARCH_USER_AGENT,
  UnsafeResearchUrlError,
  assertResearchableUrl,
  isResearchableUrl,
} from "./website-source";

/**
 * The SSRF guard.
 *
 * No fetching exists yet, and this file makes no request. What it pins is the
 * check that must run BEFORE one ever does: "fetch the website on this lead"
 * means asking our server to request a URL that arrived from a database anyone
 * can edit, and on a cloud host the difference between that and a credential
 * leak is exactly this function.
 */

describe("only public http(s) destinations are researchable", () => {
  it("accepts ordinary business websites", () => {
    for (const url of [
      "https://example.com",
      "http://example.com/",
      "https://www.salon-milano.example/services",
      "https://example.co.uk:443/",
      "http://example.com:80/index.html",
      "https://xn--bcher-kva.example/",
    ]) {
      expect(isResearchableUrl(url), url).toBe(true);
    }
  });

  it("returns the parsed URL so a caller cannot re-parse differently", () => {
    const url = assertResearchableUrl("https://Example.COM/Path?q=1");
    expect(url.hostname).toBe("example.com");
    expect(url.pathname).toBe("/Path");
  });
});

describe("schemes", () => {
  it("rejects every scheme but http and https", () => {
    for (const url of [
      "file:///etc/passwd",
      "file://C:/Windows/win.ini",
      "data:text/html,<script>alert(1)</script>",
      "javascript:alert(1)",
      "ftp://example.com/",
      "gopher://example.com/",
      "blob:https://example.com/uuid",
      "ws://example.com/",
    ]) {
      expect(isResearchableUrl(url), url).toBe(false);
    }
  });

  it("rejects anything that is not an absolute URL", () => {
    for (const url of ["example.com", "/relative", "//example.com", "", "   "]) {
      expect(isResearchableUrl(url), url).toBe(false);
    }
  });
});

describe("private and non-routable destinations", () => {
  it("rejects loopback in both address families", () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://127.1.2.3/",
      "https://[::1]/",
      "http://localhost/",
      "http://LOCALHOST:80/",
      "http://api.localhost/",
    ]) {
      expect(isResearchableUrl(url), url).toBe(false);
    }
  });

  it("rejects the cloud metadata endpoint and the rest of link-local", () => {
    // 169.254.169.254 is why this function was written first.
    expect(isResearchableUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isResearchableUrl("http://169.254.1.1/")).toBe(false);
    expect(isResearchableUrl("http://[fe80::1]/")).toBe(false);
  });

  it("rejects every private IPv4 range", () => {
    for (const url of [
      "http://10.0.0.1/",
      "http://10.255.255.255/",
      "http://172.16.0.1/",
      "http://172.31.255.1/",
      "http://192.168.1.1/",
      "http://0.0.0.0/",
      "http://100.64.0.1/",
      "http://192.0.0.1/",
      "http://198.18.0.1/",
      "http://224.0.0.1/",
      "http://255.255.255.255/",
    ]) {
      expect(isResearchableUrl(url), url).toBe(false);
    }
  });

  it("still allows public addresses that merely look adjacent", () => {
    for (const url of ["http://172.32.0.1/", "http://11.0.0.1/", "http://192.169.0.1/"]) {
      expect(isResearchableUrl(url), url).toBe(true);
    }
  });

  it("rejects unique-local and multicast IPv6", () => {
    for (const url of ["http://[fd00::1]/", "http://[fc00::1]/", "http://[ff02::1]/", "http://[::]/"]) {
      expect(isResearchableUrl(url), url).toBe(false);
    }
  });

  it("rejects an IPv4 address smuggled through an IPv6 literal", () => {
    for (const url of ["http://[::ffff:127.0.0.1]/", "http://[::ffff:169.254.169.254]/"]) {
      expect(isResearchableUrl(url), url).toBe(false);
    }
  });

  it("rejects internal hostnames that resolve through a search domain", () => {
    for (const url of ["http://intranet/", "http://db/", "http://printer.local/"]) {
      expect(isResearchableUrl(url), url).toBe(false);
    }
  });
});

describe("other request-shaping hazards", () => {
  it("rejects credentials embedded in the URL", () => {
    // They leak into logs and Referer headers.
    expect(isResearchableUrl("https://user:pass@example.com/")).toBe(false);
    expect(isResearchableUrl("https://user@example.com/")).toBe(false);
  });

  it("rejects non-default ports, which aim at infrastructure not websites", () => {
    for (const url of [
      "http://example.com:6379/",
      "http://example.com:9200/",
      "http://example.com:8080/",
      "http://example.com:22/",
    ]) {
      expect(isResearchableUrl(url), url).toBe(false);
    }
  });

  it("throws a typed error naming the reason, without echoing the URL", () => {
    const thrown = (() => {
      try {
        assertResearchableUrl("http://169.254.169.254/");
      } catch (e) {
        return e;
      }
    })();

    expect(thrown).toBeInstanceOf(UnsafeResearchUrlError);
    expect((thrown as Error).message).toBe("Non-public address.");
  });
});

describe("the limits a future adapter must honour are declared, not left to taste", () => {
  it("bounds time, size and redirects", () => {
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
    expect(MAX_RESPONSE_BYTES).toBeGreaterThan(0);
    expect(MAX_RESPONSE_BYTES).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(MAX_REDIRECTS).toBeGreaterThan(0);
    expect(MAX_REDIRECTS).toBeLessThanOrEqual(5);
  });

  it("parses markup only", () => {
    expect(ALLOWED_CONTENT_TYPES).toContain("text/html");
    for (const forbidden of ["application/pdf", "application/octet-stream", "image/png", "*/*"]) {
      expect(ALLOWED_CONTENT_TYPES).not.toContain(forbidden);
    }
  });

  it("identifies itself rather than pretending to be a browser", () => {
    expect(RESEARCH_USER_AGENT).toContain("LeadFinderResearchBot");
    expect(RESEARCH_USER_AGENT.toLowerCase()).not.toContain("mozilla");
  });
});

describe("nothing here performs a request", () => {
  it("exports no fetcher", async () => {
    const exported = await import("./website-source");
    for (const [name, value] of Object.entries(exported)) {
      if (typeof value !== "function") continue;
      // Only the guards are callable. A crawler is explicitly out of scope for
      // this phase, and its absence should fail loudly if that changes.
      expect(["assertResearchableUrl", "isResearchableUrl", "UnsafeResearchUrlError"]).toContain(
        name,
      );
    }
  });
});
