import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  SafeFetchError,
  buildRequestOptions,
  httpHopRequester,
  pinnedLookup,
  resolvePublicAddresses,
  safeFetch,
  type HopRequester,
  type HopResponse,
  type ResolvedAddress,
} from "./safe-fetch";
import { RESEARCH_USER_AGENT } from "./website-source";

/**
 * The network layer.
 *
 * NO EXTERNAL REQUEST IS MADE ANYWHERE IN THIS FILE. The redirect and
 * validation logic runs against injected fakes; the one test of the real
 * requester talks to a loopback server started by the test itself, which is
 * safe precisely because that function takes an ALREADY VALIDATED address.
 */

const PUBLIC: ResolvedAddress[] = [{ address: "93.184.216.34", family: 4 }];

const resolvesTo = (map: Record<string, ResolvedAddress[]>) => async (hostname: string) => {
  const answer = map[hostname];
  if (!answer) throw new Error(`no fake DNS entry for ${hostname}`);
  return answer;
};

const alwaysPublic = async () => PUBLIC;

interface Hop {
  url: string;
  address: string;
}

/** A requester that replays scripted responses and records what it was asked. */
function scripted(responses: HopResponse[]) {
  const hops: Hop[] = [];
  const requester: HopRequester = async (url, address) => {
    hops.push({ url: url.toString(), address });
    const next = responses[hops.length - 1];
    if (!next) throw new Error("scripted requester ran out of responses");
    return next;
  };
  return { requester, hops };
}

const html = (body = "<html></html>", status = 200): HopResponse => ({
  status,
  headers: { "content-type": "text/html; charset=utf-8" },
  body,
});

const redirect = (to: string, status = 302): HopResponse => ({
  status,
  headers: { location: to },
  body: "",
});

describe("DNS is resolved here, and every answer must be public", () => {
  it("accepts a name that resolves only to public addresses", async () => {
    await expect(resolvePublicAddresses("example.com", alwaysPublic)).resolves.toEqual(PUBLIC);
  });

  it("rejects a name that resolves to a private address", async () => {
    // The attack the URL guard alone cannot see: an ordinary hostname whose
    // DNS answer points inside the network.
    const resolver = async () => [{ address: "169.254.169.254", family: 4 }];
    const thrown = await resolvePublicAddresses("evil.example", resolver).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(SafeFetchError);
    expect((thrown as SafeFetchError).reason).toBe("dns");
  });

  it("rejects a MIXED answer rather than picking the public one", async () => {
    // A name answering with one public and one private address is not a
    // misconfiguration to work around; it is the shape of a rebinding attack.
    const resolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ];
    await expect(resolvePublicAddresses("evil.example", resolver)).rejects.toBeInstanceOf(
      SafeFetchError,
    );
  });

  it("rejects private IPv6 and IPv4-mapped forms from DNS", async () => {
    for (const address of ["::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      const resolver = async () => [{ address, family: 6 }];
      await expect(resolvePublicAddresses("evil.example", resolver), address).rejects.toBeInstanceOf(
        SafeFetchError,
      );
    }
  });

  it("rejects an empty answer and a resolver failure", async () => {
    await expect(resolvePublicAddresses("nowhere.example", async () => [])).rejects.toBeInstanceOf(
      SafeFetchError,
    );
    await expect(
      resolvePublicAddresses("nowhere.example", async () => {
        throw new Error("ENOTFOUND");
      }),
    ).rejects.toBeInstanceOf(SafeFetchError);
  });
});

describe("the connection is pinned to the validated address", () => {
  it("hands the request a lookup that ignores the hostname", () => {
    const lookup = pinnedLookup("93.184.216.34") as unknown as (
      hostname: string,
      options: unknown,
      callback: (...args: unknown[]) => void,
    ) => void;

    let single: unknown[] = [];
    lookup("anything.example", {}, (...args) => (single = args));
    expect(single).toEqual([null, "93.184.216.34", 4]);

    let all: unknown[] = [];
    lookup("anything.example", { all: true }, (...args) => (all = args));
    expect(all).toEqual([null, [{ address: "93.184.216.34", family: 4 }]]);
  });

  it("passes the validated address to the requester, not the hostname", async () => {
    const { requester, hops } = scripted([html()]);
    await safeFetch("https://example.com/", { resolver: alwaysPublic, requester });

    expect(hops[0].address).toBe("93.184.216.34");
    expect(hops[0].url).toBe("https://example.com/");
  });

  it("preserves the Host header and the SNI name", () => {
    const options = buildRequestOptions(new URL("https://example.com/page"), "93.184.216.34", "text/html");

    // Virtual hosting still works, and the certificate is still checked
    // against the name the data actually named.
    expect((options.headers as Record<string, string>).host).toBe("example.com");
    expect(options.servername).toBe("example.com");
    expect(options.hostname).toBe("example.com");
    expect(options.lookup).toBeTypeOf("function");
  });

  it("never disables TLS verification", () => {
    const options = buildRequestOptions(new URL("https://example.com/"), "93.184.216.34", "text/html");
    expect(options).not.toHaveProperty("rejectUnauthorized");
    expect(JSON.stringify(options)).not.toContain("rejectUnauthorized");
  });

  it("sets no SNI for plain http", () => {
    const options = buildRequestOptions(new URL("http://example.com/"), "93.184.216.34", "text/html");
    expect(options.servername).toBeUndefined();
  });

  it("sends no cookie, no credential and nothing from our environment", () => {
    const options = buildRequestOptions(new URL("https://example.com/"), "93.184.216.34", "text/html");
    const headers = options.headers as Record<string, string>;

    expect(Object.keys(headers).sort()).toEqual(["accept", "accept-encoding", "host", "user-agent"]);
    expect(headers["user-agent"]).toBe(RESEARCH_USER_AGENT);
    // Identity encoding, so a compression bomb cannot expand past the cap.
    expect(headers["accept-encoding"]).toBe("identity");
  });

  it("only ever issues GET", () => {
    expect(buildRequestOptions(new URL("https://example.com/"), "1.2.3.4", "text/html").method).toBe(
      "GET",
    );
  });
});

describe("redirects are followed by hand, and re-validated every hop", () => {
  it("does not let the HTTP client follow anything automatically", async () => {
    const { requester, hops } = scripted([redirect("https://example.com/b"), html()]);
    const result = await safeFetch("https://example.com/a", {
      resolver: alwaysPublic,
      requester,
    });

    // Two separate hops, each one made by us.
    expect(hops.map((h) => h.url)).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(result.finalUrl).toBe("https://example.com/b");
    expect(result.chain).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("re-resolves DNS on every hop", async () => {
    const seen: string[] = [];
    const resolver = async (hostname: string) => {
      seen.push(hostname);
      return PUBLIC;
    };
    const { requester } = scripted([redirect("https://other.example/"), html()]);

    await safeFetch("https://example.com/", { resolver, requester });
    expect(seen).toEqual(["example.com", "other.example"]);
  });

  it("rejects a redirect whose destination resolves privately", async () => {
    const resolver = resolvesTo({
      "example.com": PUBLIC,
      "inside.example": [{ address: "10.1.2.3", family: 4 }],
    });
    const { requester } = scripted([redirect("https://inside.example/"), html()]);

    const thrown = await safeFetch("https://example.com/", { resolver, requester }).catch(
      (e: unknown) => e,
    );
    expect((thrown as SafeFetchError).reason).toBe("dns");
  });

  it("rejects a redirect to a literal private address", async () => {
    const { requester } = scripted([redirect("http://169.254.169.254/latest/meta-data/")]);
    const thrown = await safeFetch("https://example.com/", {
      resolver: alwaysPublic,
      requester,
    }).catch((e: unknown) => e);

    expect((thrown as SafeFetchError).reason).toBe("bad-redirect");
  });

  it("rejects a redirect to a forbidden scheme or port", async () => {
    for (const location of ["file:///etc/passwd", "http://example.com:6379/", "javascript:alert(1)"]) {
      const { requester } = scripted([redirect(location)]);
      const thrown = await safeFetch("https://example.com/", {
        resolver: alwaysPublic,
        requester,
      }).catch((e: unknown) => e);

      expect((thrown as SafeFetchError).reason, location).toBe("bad-redirect");
    }
  });

  it("rejects a missing or empty Location", async () => {
    for (const headers of [{}, { location: "   " }]) {
      const { requester } = scripted([{ status: 302, headers, body: "" }]);
      const thrown = await safeFetch("https://example.com/", {
        resolver: alwaysPublic,
        requester,
      }).catch((e: unknown) => e);

      expect((thrown as SafeFetchError).reason).toBe("bad-redirect");
    }
  });

  it("resolves a relative Location against the current URL", async () => {
    const { requester, hops } = scripted([redirect("/landing"), html()]);
    await safeFetch("https://example.com/a/b", { resolver: alwaysPublic, requester });

    expect(hops[1].url).toBe("https://example.com/landing");
  });

  it("stops at the redirect limit", async () => {
    const { requester } = scripted([
      redirect("https://example.com/1"),
      redirect("https://example.com/2"),
      redirect("https://example.com/3"),
      redirect("https://example.com/4"),
    ]);

    const thrown = await safeFetch("https://example.com/0", {
      resolver: alwaysPublic,
      requester,
      maxRedirects: 2,
    }).catch((e: unknown) => e);

    expect((thrown as SafeFetchError).reason).toBe("too-many-redirects");
  });

  it("detects a loop rather than spending the whole redirect budget", async () => {
    const { requester } = scripted([
      redirect("https://example.com/b"),
      redirect("https://example.com/a"),
    ]);

    const thrown = await safeFetch("https://example.com/a", {
      resolver: alwaysPublic,
      requester,
    }).catch((e: unknown) => e);

    expect((thrown as SafeFetchError).reason).toBe("redirect-loop");
  });
});

describe("responses are checked before they are believed", () => {
  it("rejects a non-2xx status", async () => {
    for (const status of [400, 403, 404, 500, 503]) {
      const { requester } = scripted([html("", status)]);
      const thrown = await safeFetch("https://example.com/", {
        resolver: alwaysPublic,
        requester,
      }).catch((e: unknown) => e);

      expect((thrown as SafeFetchError).reason, String(status)).toBe("http-error");
    }
  });

  it("carries the status on the error, so a caller need not parse the message", async () => {
    // robots.txt handling turns on 4xx versus 5xx, and RFC 9309 gives those
    // opposite meanings. Reading the number back out of prose would be a
    // parser nobody signed up for.
    for (const status of [400, 401, 403, 404, 410, 429, 500, 503]) {
      const { requester } = scripted([html("", status)]);
      const thrown = await safeFetch("https://example.com/", {
        resolver: alwaysPublic,
        requester,
      }).catch((e: unknown) => e);

      expect((thrown as SafeFetchError).status, String(status)).toBe(status);
    }
  });

  it("leaves the status undefined for every failure that was not an HTTP response", async () => {
    const noStatus = [
      new SafeFetchError("x", "timeout"),
      new SafeFetchError("x", "dns"),
      new SafeFetchError("x", "network"),
      new SafeFetchError("x", "too-large"),
      new SafeFetchError("x", "unsafe-url"),
      new SafeFetchError("x", "redirect-loop"),
      new SafeFetchError("x", "unsupported-content-type"),
    ];
    for (const error of noStatus) expect(error.status, error.reason).toBeUndefined();
  });

  it("puts no response body on the error", async () => {
    const { requester } = scripted([
      { status: 503, headers: { "content-type": "text/html" }, body: "<secret>internal</secret>" },
    ]);
    const thrown = (await safeFetch("https://example.com/", {
      resolver: alwaysPublic,
      requester,
    }).catch((e: unknown) => e)) as SafeFetchError;

    expect(thrown.status).toBe(503);
    expect(thrown.message).not.toContain("secret");
    expect(thrown.message).toBe("The server answered 503.");
  });

  it("rejects a content type that is not markup", async () => {
    for (const type of ["application/pdf", "image/png", "application/octet-stream", "text/plain"]) {
      const { requester } = scripted([
        { status: 200, headers: { "content-type": type }, body: "x" },
      ]);
      const thrown = await safeFetch("https://example.com/", {
        resolver: alwaysPublic,
        requester,
      }).catch((e: unknown) => e);

      expect((thrown as SafeFetchError).reason, type).toBe("unsupported-content-type");
    }
  });

  it("rejects a response with no content type at all", async () => {
    const { requester } = scripted([{ status: 200, headers: {}, body: "x" }]);
    await expect(
      safeFetch("https://example.com/", { resolver: alwaysPublic, requester }),
    ).rejects.toBeInstanceOf(SafeFetchError);
  });

  it("accepts the declared markup types, ignoring charset", async () => {
    const { requester } = scripted([
      { status: 200, headers: { "content-type": "application/xhtml+xml; charset=utf-8" }, body: "<p/>" },
    ]);
    const result = await safeFetch("https://example.com/", { resolver: alwaysPublic, requester });
    expect(result.contentType).toBe("application/xhtml+xml");
  });

  it("refuses an unsafe URL before any resolution happens", async () => {
    let resolved = false;
    const resolver = async () => {
      resolved = true;
      return PUBLIC;
    };

    for (const url of ["file:///etc/passwd", "http://127.0.0.1/", "http://localhost/"]) {
      const thrown = await safeFetch(url, { resolver }).catch((e: unknown) => e);
      expect((thrown as SafeFetchError).reason, url).toBe("unsafe-url");
    }
    expect(resolved).toBe(false);
  });

  it("gives up once the overall deadline has passed", async () => {
    const { requester } = scripted([redirect("https://example.com/b"), html()]);
    const thrown = await safeFetch("https://example.com/a", {
      resolver: alwaysPublic,
      requester,
      timeoutMs: -1,
    }).catch((e: unknown) => e);

    expect((thrown as SafeFetchError).reason).toBe("timeout");
  });
});

/**
 * The real requester, against a server this test starts on loopback.
 *
 * Local only. It never leaves the machine, and it is the one way to check that
 * the actual socket code sends what `buildRequestOptions` says it does.
 */
describe("the real hop requester", () => {
  let server: Server;
  let port = 0;
  let lastHeaders: Record<string, string | string[] | undefined> = {};

  beforeAll(async () => {
    server = createServer((req, res) => {
      lastHeaders = req.headers;

      if (req.url === "/big") {
        res.writeHead(200, { "content-type": "text/html" });
        // More than the cap the test sets, written in one go.
        res.end("x".repeat(50_000));
        return;
      }
      if (req.url === "/slow") {
        res.writeHead(200, { "content-type": "text/html" });
        // Never finished, so only a deadline can end it.
        res.write("<html>");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<html><title>Local</title></html>");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("sends the Host header and our user agent, and no cookie or credential", async () => {
    const url = new URL(`http://example.com:${port}/`);
    // The address is supplied by the caller; this function does not resolve.
    await httpHopRequester(url, "127.0.0.1", 5000, 100_000).catch(() => undefined);

    expect(lastHeaders.host).toBe(`example.com:${port}`);
    expect(lastHeaders["user-agent"]).toBe(RESEARCH_USER_AGENT);
    expect(lastHeaders["accept-encoding"]).toBe("identity");
    expect(lastHeaders.cookie).toBeUndefined();
    expect(lastHeaders.authorization).toBeUndefined();
  });

  it("returns a bounded body and its headers", async () => {
    const url = new URL(`http://example.com:${port}/`);
    const response = await httpHopRequester(url, "127.0.0.1", 5000, 100_000);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("<title>Local</title>");
  });

  it("aborts a body that exceeds the cap", async () => {
    const url = new URL(`http://example.com:${port}/big`);
    const thrown = await httpHopRequester(url, "127.0.0.1", 5000, 1024).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(SafeFetchError);
    expect((thrown as SafeFetchError).reason).toBe("too-large");
  });

  it("times out a server that never finishes", async () => {
    const url = new URL(`http://example.com:${port}/slow`);
    const thrown = await httpHopRequester(url, "127.0.0.1", 300, 100_000).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(SafeFetchError);
    expect((thrown as SafeFetchError).reason).toBe("timeout");
  });
});
