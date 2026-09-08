/**
 * The authentication surface other modules import.
 *
 * Route handlers and pages import from `@/server/auth`; nothing outside this
 * folder imports `./token`, `./session` or `./dal` directly.
 */

export {
  createSession,
  destroySession,
  passwordMatches,
  readSession,
  OPERATOR_SUBJECT,
  SESSION_COOKIE,
} from "./session";

export { optionalSession, requireApiSession, requireSession, type ApiGuard } from "./dal";

export { SESSION_DURATION_MS, type SessionPayload } from "./token";
