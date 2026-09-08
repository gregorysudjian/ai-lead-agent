import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { readSession } from "./session";
import type { SessionPayload } from "./token";

/**
 * The authorization boundary. Everything that reads data goes through here.
 *
 * `proxy.ts` also redirects unauthenticated visitors, but that is a UX
 * convenience and NOT a security control -- it checks only that a cookie is
 * present, because Next's own guidance is that Proxy runs on every request
 * (including prefetches) and must stay cheap. The real check is here, next to
 * the data, where a forged or expired cookie is actually rejected.
 *
 * So: a page that forgets to call `requireSession()` is unprotected no matter
 * what proxy.ts says. `auth-coverage.test.ts` is what stops that happening.
 */

/**
 * Require a session, or redirect to the login page.
 *
 * Wrapped in React's `cache` so a page that checks in several places -- the
 * page body, a nested Server Component -- verifies once per render pass.
 *
 * `redirect()` throws a control-flow signal Next catches, so this never
 * returns to an unauthenticated caller.
 */
export const requireSession = cache(async (): Promise<SessionPayload> => {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
});

/**
 * The session if there is one, without redirecting.
 *
 * For rendering decisions only -- showing a sign-out button, say. Never use it
 * to decide whether to load data; that is `requireSession`'s job.
 */
export const optionalSession = cache(async (): Promise<SessionPayload | null> => {
  return readSession();
});

/**
 * The outcome of guarding a Route Handler.
 *
 * A discriminated union rather than `Response | null` so the session travels
 * with the success case. Handlers that rate-limit need the caller's identity,
 * and reading the cookie a second time to get it would be both wasteful and a
 * second place for the two reads to disagree.
 */
export type ApiGuard =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: Response };

/**
 * Guard a Route Handler.
 *
 * Handlers answer 401 rather than redirecting: they are called by `fetch` from
 * our own Client Components, and a 302 to an HTML login page would surface as
 * a JSON parse error rather than as "you are logged out".
 *
 *   const guard = await requireApiSession();
 *   if (!guard.ok) return guard.response;
 */
export async function requireApiSession(): Promise<ApiGuard> {
  const session = await readSession();
  if (session) return { ok: true, session };

  return {
    ok: false,
    response: Response.json({ error: "Authentication required." }, { status: 401 }),
  };
}
