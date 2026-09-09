import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy -- what Next.js called Middleware before 16. Runs before every matched
 * request.
 *
 * THIS IS NOT THE SECURITY BOUNDARY. It performs one optimistic check: is a
 * session cookie present? It does not verify the signature, because Next's
 * guidance is explicit that Proxy runs on every request including prefetches
 * and should stay cheap, and because a check here is too far from the data to
 * be trustworthy anyway.
 *
 * Anyone can set a cookie called `lf_session` to junk and get past this file.
 * They will then be rejected by `requireSession()` in the Data Access Layer or
 * by `requireApiSession()` in the route handler, which verify the HMAC. What
 * this file buys is that a logged-out human browsing to /leads lands on the
 * login form instead of a redirect from deeper in the render.
 *
 * Keep the two lists below in sync with `auth-coverage.test.ts`, which asserts
 * that every page and route handler outside them actually calls a guard.
 */

/** The session cookie name. Duplicated from `@/server/auth` deliberately: that
 *  module is `server-only`, which Proxy does not resolve. The constant is
 *  asserted equal in `auth-coverage.test.ts`, so the two cannot drift. */
const SESSION_COOKIE = "lf_session";

/** Pages reachable without a session. Everything else needs one. */
const PUBLIC_PATHS = new Set(["/login"]);

/**
 * Page prefixes reachable without a session.
 *
 * Only `/s/`, which serves a demo to the business it was made for. Its access
 * control is the token in the path -- 32 random bytes, with an expiry and a
 * revoke -- checked by the page itself against the share store. Listing it
 * here exempts it from the session redirect and from nothing else.
 */
const PUBLIC_PREFIXES = ["/s/"];

/** API routes reachable without a session. */
const PUBLIC_API_PREFIXES = ["/api/auth/"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Signed in and heading for the login form: send them to the dashboard.
  if (hasCookie && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  if (isPublic(pathname) || hasCookie) {
    return NextResponse.next();
  }

  // API callers get JSON, not an HTML redirect. A `fetch` from one of our
  // Client Components would otherwise try to parse a login page as JSON and
  // report a syntax error instead of "signed out".
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const login = new URL("/login", request.nextUrl);
  // Remember where they were going, so login lands them there rather than on
  // the dashboard. Validated as an internal path on the way back out.
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Everything except Next's own static output and the favicon.
   *
   * API routes ARE matched -- the 401 above is what stops an unauthenticated
   * `fetch` from reaching a handler at all. Next's documented default matcher
   * excludes them; ours does not, on purpose.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
