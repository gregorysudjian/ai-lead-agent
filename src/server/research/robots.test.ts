import { describe, expect, it } from "vitest";

import { checkRobots, isPathAllowed, parseRobots, ROBOTS_USER_AGENT_TOKEN } from "./robots";
import { SafeFetchError, type HopRequester, type HopResponse } from "./safe-fetch";

/** No external request: robots is fetched through the injected fake below. */

const PUBLIC = async () => [{ address: "93.184.216.34", family: 4 }];

function servingRobots(body: string, contentType = "text/plain"): { requester: HopRequester; urls: string[] } {
  const urls: string[] = [];
  const requester: HopRequester = async (url) => {
    urls.push(url.toString());
    return { status: 200, headers: { "content-type": contentType }, body } as HopResponse;
  };
  return { requester, urls };
}

const failing = (reason: SafeFetchError["reason"]): HopRequester => async () => {
  throw new SafeFetchError("nope", reason);
};

const rules = (text: string) => parseRobots(text).rules;

describe("parsing takes only the directives we implement", () => {
  it("reads the wildcard group", () => {
    const parsed = parseRobots("User-agent: *\nDisallow: /admin\n");
    expect(parsed.matchedGroup).toBe(true);
    expect(parsed.rules).toEqual([{ allow: false, path: "/admin" }]);
  });

  it("prefers our own token over the wildcard group", () => {
    const parsed = parseRobots(
      `User-agent: *\nDisallow: /\n\nUser-agent: ${ROBOTS_USER_AGENT_TOKEN}\nDisallow: /private\n`,
    );
    expect(parsed.rules).toEqual([{ allow: false, path: "/private" }]);
  });

  it("ignores comments, blank lines and directives we do not implement", () => {
    const parsed = parseRobots(
      "# a comment\nUser-agent: *\nCrawl-delay: 10\nSitemap: https://x.example/s.xml\nDisallow: /a\n",
    );
    expect(parsed.rules).toEqual([{ allow: false, path: "/a" }]);
  });

  it("reports no matching group when the file names other crawlers only", () => {
    expect(parseRobots("User-agent: GPTBot\nDisallow: /\n").matchedGroup).toBe(false);
  });

  it("shares one group across consecutive user-agent lines", () => {
    const parsed = parseRobots(`User-agent: other\nUser-agent: *\nDisallow: /x\n`);
    expect(parsed.rules).toEqual([{ allow: false, path: "/x" }]);
  });
});

describe("path matching follows the standard's two rules", () => {
  it("allows a path nothing disallows", () => {
    expect(isPathAllowed(rules("User-agent: *\nDisallow: /admin\n"), "/")).toBe(true);
  });

  it("disallows a matching prefix", () => {
    expect(isPathAllowed(rules("User-agent: *\nDisallow: /admin\n"), "/admin/users")).toBe(false);
  });

  it("treats an empty Disallow as no restriction", () => {
    expect(isPathAllowed(rules("User-agent: *\nDisallow:\n"), "/anything")).toBe(true);
  });

  it("lets the longest match win", () => {
    const parsed = rules("User-agent: *\nDisallow: /\nAllow: /public\n");
    expect(isPathAllowed(parsed, "/public/page")).toBe(true);
    expect(isPathAllowed(parsed, "/private")).toBe(false);
  });

  it("lets Allow win a tie", () => {
    const parsed = rules("User-agent: *\nDisallow: /x\nAllow: /x\n");
    expect(isPathAllowed(parsed, "/x")).toBe(true);
  });

  it("supports the * and $ wildcards, and nothing beyond them", () => {
    expect(isPathAllowed(rules("User-agent: *\nDisallow: /*.pdf$\n"), "/a/b.pdf")).toBe(false);
    expect(isPathAllowed(rules("User-agent: *\nDisallow: /*.pdf$\n"), "/a/b.pdf?x=1")).toBe(true);
    expect(isPathAllowed(rules("User-agent: *\nDisallow: /a/*/c\n"), "/a/b/c")).toBe(false);
  });

  it("blocks everything under a bare slash", () => {
    expect(isPathAllowed(rules("User-agent: *\nDisallow: /\n"), "/")).toBe(false);
  });
});

describe("the decision, and what happens when robots cannot be read", () => {
  const target = new URL("https://example.com/");

  it("fetches robots.txt from the origin, through the safe layer", async () => {
    const { requester, urls } = servingRobots("User-agent: *\nDisallow:\n");
    const decision = await checkRobots(target, { resolver: PUBLIC, requester });

    expect(urls).toEqual(["https://example.com/robots.txt"]);
    expect(decision.allowed).toBe(true);
  });

  it("refuses a disallowed path and says so in plain words", async () => {
    const { requester } = servingRobots("User-agent: *\nDisallow: /\n");
    const decision = await checkRobots(target, { resolver: PUBLIC, requester });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("disallows");
  });

  it("treats an HTTP error as no robots file, so no rule forbids the page", async () => {
    // RFC 9309: a 4xx means there are no rules. This is the common case for
    // small business sites, and refusing them all would make the feature
    // useless.
    const decision = await checkRobots(target, { resolver: PUBLIC, requester: failing("http-error") });
    expect(decision.allowed).toBe(true);
  });

  it("refuses when robots cannot be read at all", async () => {
    // A timeout is not a statement about anything. Guessing "allowed" from
    // silence is how a polite fetcher becomes an impolite one.
    for (const reason of ["timeout", "dns", "network", "too-large", "unsafe-url"] as const) {
      const decision = await checkRobots(target, { resolver: PUBLIC, requester: failing(reason) });
      expect(decision.allowed, reason).toBe(false);
      expect(decision.reason).toContain("could not be read");
    }
  });

  it("refuses when robots.txt is not text", async () => {
    // Enforced by the content-type allowlist in the fetch layer.
    const { requester } = servingRobots("<html>not robots</html>", "text/html");
    const decision = await checkRobots(target, { resolver: PUBLIC, requester });
    expect(decision.allowed).toBe(false);
  });

  it("allows when the file names only other crawlers", async () => {
    const { requester } = servingRobots("User-agent: SomeoneElse\nDisallow: /\n");
    const decision = await checkRobots(target, { resolver: PUBLIC, requester });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain("no rule for this crawler");
  });

  it("applies the same SSRF rules to a robots redirect", async () => {
    const requester: HopRequester = async (url) =>
      url.pathname === "/robots.txt"
        ? { status: 302, headers: { location: "http://169.254.169.254/" }, body: "" }
        : { status: 200, headers: { "content-type": "text/plain" }, body: "" };

    const decision = await checkRobots(target, { resolver: PUBLIC, requester });
    // The redirect is refused by the fetch layer, so robots is unreadable, so
    // the conservative branch applies.
    expect(decision.allowed).toBe(false);
  });

  it("checks the path that will actually be fetched", async () => {
    const { requester } = servingRobots("User-agent: *\nDisallow: /shop\n");

    await expect(
      checkRobots(new URL("https://example.com/shop/x"), { resolver: PUBLIC, requester }),
    ).resolves.toMatchObject({ allowed: false });

    const second = servingRobots("User-agent: *\nDisallow: /shop\n");
    await expect(
      checkRobots(new URL("https://example.com/about"), {
        resolver: PUBLIC,
        requester: second.requester,
      }),
    ).resolves.toMatchObject({ allowed: true });
  });
});
