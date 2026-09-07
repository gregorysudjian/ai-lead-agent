import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";

import {
  ALLOWED_CONTENT_TYPES,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  RESEARCH_USER_AGENT,
  assertResearchableUrl,
  isPublicAddress,
} from "./website-source";

/**
 * The only place in this application that opens a socket to a third party.
 *
 * ── WHY `fetch()` IS NOT ENOUGH ───────────────────────────────────────────
 *
 * The Phase 9A guard checks a URL's SYNTAX. That stops `file://`, `[::1]` and
 * `169.254.169.254` written literally. It does nothing about the far more
 * likely attack: a perfectly ordinary hostname that RESOLVES to a private
 * address.
 *
 *   assertResearchableUrl("https://evil.example/")   // passes, it is a name
 *   evil.example.  A  169.254.169.254                // and this is the answer
 *
 * Validating and then calling `fetch(url)` would resolve the name a SECOND
 * time, and nothing forces the second answer to match the first. That gap is
 * DNS rebinding, and it is won by a TTL of zero.
 *
 * So resolution happens here, once, and the connection is PINNED to an address
 * this module validated:
 *
 *   1. assertResearchableUrl on the URL
 *   2. resolve the hostname to every address it has
 *   3. reject the request outright if ANY of them is non-public -- not "use
 *      the good one", because a name that answers with a private address at
 *      all is not a business website
 *   4. connect to a validated address by handing `node:https` a `lookup` that
 *      returns only that address, so there is no second resolution to race
 *
 * Host and SNI stay the original hostname, so virtual hosting still works and
 * the certificate is still verified against the name the user's data named.
 * TLS verification is never disabled; there is no `rejectUnauthorized` here.
 *
 * ── EVERYTHING ELSE IS BOUNDED ────────────────────────────────────────────
 *
 * One overall deadline across all hops, a byte cap enforced as the body
 * streams, redirects followed manually with every hop re-validated and
 * re-resolved, `identity` encoding so a compression bomb cannot expand, and
 * an allowlist of content types. No cookies, no credentials, no header taken
 * from our environment.
 */

/** One completed, bounded response. */
export interface SafeFetchResult {
  /** The URL actually read, after any redirects. */
  finalUrl: string;
  status: number;
  contentType: string;
  /** Decoded body, never larger than the byte cap. */
  body: string;
  /** Every URL in the redirect chain, starting with the requested one. */
  chain: string[];
}

export class SafeFetchError extends Error {
  /**
   * The HTTP status, present only when the failure WAS an HTTP response.
   *
   * Carried structurally so a caller can act on the difference between "the
   * server said 404" and "the server said 503" -- robots.txt handling turns
   * on exactly that, and RFC 9309 gives the two opposite meanings. It is a
   * status code and nothing else: no headers, no body, nothing a third party
   * wrote. Undefined for every non-HTTP failure (DNS, timeout, redirect,
   * size, content type), where there is no status to report and the caller
   * must take the conservative branch.
   */
  readonly status?: number;

  constructor(
    message: string,
    /** Coarse reason, safe to log. Never contains a response body. */
    readonly reason:
      | "unsafe-url"
      | "dns"
      | "network"
      | "timeout"
      | "too-many-redirects"
      | "redirect-loop"
      | "bad-redirect"
      | "too-large"
      | "unsupported-content-type"
      | "http-error",
    options?: { cause?: unknown; status?: number },
  ) {
    super(message, options);
    this.name = "SafeFetchError";
    this.status = options?.status;
  }
}

/** A resolved address, as `dns.lookup(..., { all: true })` returns them. */
export interface ResolvedAddress {
  address: string;
  family: number;
}

export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

/** One hop: send a GET, return status/headers/body. Never follows redirects. */
export interface HopResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: string;
}

export type HopRequester = (
  url: URL,
  address: string,
  deadlineMs: number,
  maxBytes: number,
) => Promise<HopResponse>;

export interface SafeFetchOptions {
  /** Overall byte cap for the body. */
  maxBytes?: number;
  /** Overall deadline across every hop. */
  timeoutMs?: number;
  maxRedirects?: number;
  /** Content types the caller will accept. Defaults to HTML. */
  allowedContentTypes?: readonly string[];
  /** Test seams. Neither is used in production. */
  resolver?: AddressResolver;
  requester?: HopRequester;
}

const DEFAULT_RESOLVER: AddressResolver = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

/**
 * Resolve a hostname and refuse it unless EVERY answer is a public address.
 *
 * Rejecting the whole name, rather than filtering to the public answers, is
 * deliberate. A round-robin record mixing one public and one private address
 * is not a misconfiguration to work around; it is the shape of an attack, and
 * a real business website never has one.
 */
export async function resolvePublicAddresses(
  hostname: string,
  resolver: AddressResolver = DEFAULT_RESOLVER,
): Promise<ResolvedAddress[]> {
  let answers: ResolvedAddress[];
  try {
    answers = await resolver(hostname);
  } catch (error) {
    throw new SafeFetchError("The hostname could not be resolved.", "dns", { cause: error });
  }

  if (answers.length === 0) {
    throw new SafeFetchError("The hostname resolved to no address.", "dns");
  }

  for (const answer of answers) {
    if (!isPublicAddress(answer.address)) {
      throw new SafeFetchError("The hostname resolves to a non-public address.", "dns");
    }
  }
  return answers;
}

/**
 * Build the request options for one hop.
 *
 * Exported so the security-relevant parts can be asserted directly rather than
 * inferred from behaviour: the pinned lookup, the preserved Host, the SNI
 * name, the absence of cookies, credentials and compression.
 */
export function buildRequestOptions(
  url: URL,
  address: string,
  accept: string,
): RequestOptions & { servername?: string } {
  const options: RequestOptions & { servername?: string } = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port.length > 0 ? url.port : url.protocol === "https:" ? 443 : 80,
    path: `${url.pathname}${url.search}`,
    method: "GET",
    headers: {
      // The original host, so virtual hosting resolves the way the URL meant.
      host: url.host,
      "user-agent": RESEARCH_USER_AGENT,
      accept,
      // No compression: a gzip bomb expands after the byte cap would have
      // stopped it, so the simplest defence is not to accept one.
      "accept-encoding": "identity",
      // No cookie, no authorization, no header derived from our environment.
      // Nothing about this deployment reaches a third-party server.
    },
    // THE PIN. Node connects to exactly this address; there is no second
    // resolution between validation and connection.
    lookup: pinnedLookup(address),
  };

  if (url.protocol === "https:") {
    // SNI, and therefore certificate verification, stays on the real hostname.
    // `rejectUnauthorized` is deliberately not set: the secure default stands.
    options.servername = url.hostname;
  }
  return options;
}

/** A `dns.lookup`-shaped function that always answers with one pinned address. */
export function pinnedLookup(address: string): RequestOptions["lookup"] {
  const family = address.includes(":") ? 6 : 4;

  return ((
    _hostname: string,
    options: { all?: boolean } | ((...args: unknown[]) => void),
    callback?: (...args: unknown[]) => void,
  ) => {
    const done = (typeof options === "function" ? options : callback) as (
      ...args: unknown[]
    ) => void;
    const wantsAll = typeof options === "object" && options !== null && options.all === true;

    if (wantsAll) done(null, [{ address, family }]);
    else done(null, address, family);
  }) as RequestOptions["lookup"];
}

/**
 * The production hop: one GET over node:http(s), bounded and never redirected.
 *
 * Exported so it can be exercised against a loopback server in tests -- it
 * takes an ALREADY VALIDATED address, which is what makes that safe to do.
 */
export const httpHopRequester: HopRequester = (url, address, deadlineMs, maxBytes) =>
  new Promise<HopResponse>((resolve, reject) => {
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const accept = `${ALLOWED_CONTENT_TYPES.join(", ")};q=0.9, */*;q=0.1`;

    const req = send(buildRequestOptions(url, address, accept), (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      let size = 0;

      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          // Abort as soon as the cap is passed, rather than reading to the end
          // and discarding: a body with no end must not be able to hold a
          // socket, or memory, indefinitely.
          res.destroy();
          req.destroy();
          reject(new SafeFetchError("The response exceeded the size limit.", "too-large"));
          return;
        }
        chunks.push(chunk);
      });

      res.on("end", () => {
        const headers: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }
        resolve({
          status: res.statusCode ?? 0,
          headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });

      res.on("error", (error) =>
        reject(new SafeFetchError("The response failed.", "network", { cause: error })),
      );
    });

    // One deadline for this hop, drawn from what remains of the overall one.
    req.setTimeout(Math.max(1, deadlineMs), () => {
      req.destroy();
      reject(new SafeFetchError("The request timed out.", "timeout"));
    });

    req.on("error", (error) =>
      reject(new SafeFetchError("The request failed.", "network", { cause: error })),
    );
    req.end();
  });

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Fetch one page safely.
 *
 * Redirects are followed HERE, by hand, so every hop goes through the same
 * validation and resolution as the first. An HTTP client following redirects
 * for us would follow one into a private network without asking.
 */
export async function safeFetch(
  requestedUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const allowed = options.allowedContentTypes ?? ALLOWED_CONTENT_TYPES;
  const resolver = options.resolver ?? DEFAULT_RESOLVER;
  const requester = options.requester ?? httpHopRequester;
  const deadline = Date.now() + (options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  let current: URL;
  try {
    current = assertResearchableUrl(requestedUrl);
  } catch (error) {
    throw new SafeFetchError("The URL is not safe to research.", "unsafe-url", { cause: error });
  }

  const chain: string[] = [current.toString()];
  const seen = new Set<string>([current.toString()]);

  for (let hop = 0; ; hop += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SafeFetchError("The request timed out.", "timeout");

    const [address] = await resolvePublicAddresses(current.hostname, resolver);
    const response = await requester(current, address.address, remaining, maxBytes);

    if (!REDIRECT_STATUSES.has(response.status)) {
      if (response.status < 200 || response.status >= 300) {
        // The status travels on the error, not only inside its message. A
        // caller that needs it must not have to parse it back out of prose.
        throw new SafeFetchError(`The server answered ${response.status}.`, "http-error", {
          status: response.status,
        });
      }

      const contentType = (response.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (!allowed.includes(contentType)) {
        throw new SafeFetchError(
          "The response was not a supported content type.",
          "unsupported-content-type",
        );
      }

      return { finalUrl: current.toString(), status: response.status, contentType, body: response.body, chain };
    }

    if (hop >= maxRedirects) {
      throw new SafeFetchError("Too many redirects.", "too-many-redirects");
    }

    const location = response.headers.location;
    if (location === undefined || location.trim().length === 0) {
      throw new SafeFetchError("The redirect had no destination.", "bad-redirect");
    }

    let next: URL;
    try {
      // Resolved against the CURRENT url, so a relative Location works, and
      // then re-validated from scratch as though it had been the input.
      next = assertResearchableUrl(new URL(location, current).toString());
    } catch (error) {
      throw new SafeFetchError("The redirect destination is not safe to research.", "bad-redirect", {
        cause: error,
      });
    }

    if (seen.has(next.toString())) {
      throw new SafeFetchError("The redirects formed a loop.", "redirect-loop");
    }

    seen.add(next.toString());
    chain.push(next.toString());
    current = next;
  }
}
