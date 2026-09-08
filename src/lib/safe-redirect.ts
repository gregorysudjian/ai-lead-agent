/**
 * Reduce a caller-supplied "where was I going?" value to a safe internal path.
 *
 * The `?next=` parameter on the login page is attacker-controllable: a link to
 * `/login?next=https://evil.example` would, without this, hand a freshly
 * authenticated operator to someone else's site wearing our domain in the
 * referrer. That is an open redirect, and it is the standard phishing setup.
 *
 * Accepts ONLY a path beginning with a single `/`. Rejected outright:
 *   - absolute URLs (`https://evil.example`)
 *   - scheme-relative URLs (`//evil.example`), which browsers treat as absolute
 *   - backslash variants (`/\evil.example`), which some browsers normalise
 *   - anything with a control character, which can truncate a header
 *
 * Pure and total: returns `fallback` for everything it does not recognise,
 * so there is no failure mode where a caller forgets to handle an error.
 */
export function safeInternalPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  if (candidate.length === 0) return fallback;
  if (candidate.length > 2048) return fallback;

  // Must be rooted, and must not be scheme-relative.
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;

  // `/\host` is read as scheme-relative by some browsers.
  if (candidate.startsWith("/\\")) return fallback;

  // Control characters (including CR/LF and NUL) can split a Location header.
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  return candidate;
}
