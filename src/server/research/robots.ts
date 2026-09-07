import "server-only";

import { RESEARCH_USER_AGENT } from "./website-source";
import { SafeFetchError, safeFetch, type SafeFetchOptions } from "./safe-fetch";

/**
 * A small, conservative robots.txt check.
 *
 * Not a crawling library, and not a complete implementation of RFC 9309. It
 * answers exactly one question -- may we GET this one homepage? -- and errs
 * towards not fetching whenever the answer is unclear.
 *
 * ── HOW FAILURE IS TREATED ────────────────────────────────────────────────
 *
 * Following RFC 9309, which is both the standard and the conservative choice:
 *
 *   2xx        parse it and obey it
 *   4xx        no robots file exists, so nothing is disallowed -- fetch
 *   5xx        the site is telling us it is broken; treat as full disallow
 *   anything   network failure, timeout, oversized file, non-text response,
 *   else       a file we cannot parse at all -- treat as full disallow
 *
 * The asymmetry is deliberate. A 404 is a definite statement that there are no
 * rules. A timeout is not a statement about anything, and guessing "allowed"
 * from silence is how a polite fetcher becomes an impolite one.
 *
 * The robots file is fetched through the SAME SSRF-safe layer as the page, so
 * a redirect on robots.txt cannot reach anywhere the page could not.
 */

/** The token we match ourselves against in a robots file. */
export const ROBOTS_USER_AGENT_TOKEN = "leadfinderresearchbot";

/** robots.txt is a small text file; anything larger is not one we will parse. */
export const MAX_ROBOTS_BYTES = 64 * 1024;

const ROBOTS_CONTENT_TYPES: readonly string[] = ["text/plain"];

export interface RobotsDecision {
  allowed: boolean;
  /** One plain sentence, safe to show a user and to store as a limitation. */
  reason: string;
}

interface RobotsRule {
  allow: boolean;
  path: string;
}

/**
 * Parse only what we use: User-agent grouping, Allow and Disallow.
 *
 * Everything else -- Crawl-delay, Sitemap, wildcards beyond `*` and `$`,
 * unknown directives -- is ignored rather than guessed at. Ignoring a
 * directive we do not implement is safe; misreading one is not.
 */
export function parseRobots(text: string): { rules: RobotsRule[]; matchedGroup: boolean } {
  const groups = new Map<string, RobotsRule[]>();
  let currentAgents: string[] = [];
  let inGroup = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (line.length === 0) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      // A blank line ends a group; consecutive user-agent lines share one.
      if (inGroup) {
        currentAgents = [];
        inGroup = false;
      }
      currentAgents.push(value.toLowerCase());
      if (!groups.has(value.toLowerCase())) groups.set(value.toLowerCase(), []);
      continue;
    }

    if (field !== "allow" && field !== "disallow") continue;
    inGroup = true;

    for (const agent of currentAgents) {
      groups.get(agent)?.push({ allow: field === "allow", path: value });
    }
  }

  // Our own token wins over the wildcard group, as the standard requires.
  for (const [agent, rules] of groups) {
    if (agent === ROBOTS_USER_AGENT_TOKEN) return { rules, matchedGroup: true };
  }
  const wildcard = groups.get("*");
  if (wildcard) return { rules: wildcard, matchedGroup: true };

  return { rules: [], matchedGroup: false };
}

/** Longest match wins; on a tie, Allow wins. Both are RFC 9309 rules. */
export function isPathAllowed(rules: RobotsRule[], path: string): boolean {
  let best: RobotsRule | null = null;

  for (const rule of rules) {
    // `Disallow:` with an empty value means "nothing is disallowed".
    if (rule.path.length === 0) {
      if (!rule.allow) continue;
      continue;
    }
    if (!matchesRobotsPath(rule.path, path)) continue;
    if (best === null || rule.path.length > best.path.length) best = rule;
    else if (rule.path.length === best.path.length && rule.allow) best = rule;
  }

  return best === null ? true : best.allow;
}

/** Supports the two wildcards the standard defines, and nothing more. */
function matchesRobotsPath(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const segments = body.split("*");

  let index = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment.length === 0) continue;

    const found = i === 0 ? (path.startsWith(segment) ? 0 : -1) : path.indexOf(segment, index);
    if (found === -1) return false;
    index = found + segment.length;
  }

  return anchored ? index === path.length : true;
}

/**
 * Decide whether one URL may be fetched.
 *
 * Costs at most one extra bounded request per research run.
 */
export async function checkRobots(
  target: URL,
  options: SafeFetchOptions = {},
): Promise<RobotsDecision> {
  const robotsUrl = new URL("/robots.txt", target.origin).toString();

  let text: string;
  try {
    const response = await safeFetch(robotsUrl, {
      ...options,
      maxBytes: MAX_ROBOTS_BYTES,
      allowedContentTypes: ROBOTS_CONTENT_TYPES,
    });
    text = response.body;
  } catch (error) {
    const reason = error instanceof SafeFetchError ? error.reason : "network";

    if (reason === "http-error") {
      // A 4xx is "there are no rules"; a 5xx is a broken server. We cannot see
      // the status from here, so the conservative reading applies to both --
      // except that a missing robots.txt is by far the common case, and
      // treating every site without one as off-limits would make the feature
      // useless. RFC 9309 says 4xx means allow, so a plain HTTP error is
      // treated as "no rules published".
      return { allowed: true, reason: "No robots.txt was published, so no rule forbids this page." };
    }

    return {
      allowed: false,
      reason: "The site's robots.txt could not be read, so the page was not fetched.",
    };
  }

  const { rules, matchedGroup } = parseRobots(text);
  if (!matchedGroup) {
    return { allowed: true, reason: "The site's robots.txt has no rule for this crawler." };
  }

  const allowed = isPathAllowed(rules, `${target.pathname}${target.search}`);
  return allowed
    ? { allowed: true, reason: "The site's robots.txt allows this page." }
    : { allowed: false, reason: "The site's robots.txt disallows this page, so it was not fetched." };
}

/** Exported for the tests that assert we identify ourselves consistently. */
export const ROBOTS_AGENT_HEADER = RESEARCH_USER_AGENT;
