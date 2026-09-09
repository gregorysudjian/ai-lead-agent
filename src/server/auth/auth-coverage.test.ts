import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SESSION_COOKIE } from "./session";

/**
 * Architecture guard: every page and every route handler is behind a session.
 *
 * Authentication that depends on remembering to add a line is authentication
 * that lapses. `proxy.ts` cannot be that safety net -- it deliberately checks
 * only that a cookie EXISTS, so a route with no guard of its own is reachable
 * by anyone willing to set `lf_session=anything`.
 *
 * So the guard is here: a new page or handler fails this test until it calls
 * `requireSession()` or `requireApiSession()`, and anything intentionally
 * public has to be added to an allow-list below, which is a visible diff.
 *
 * This asserts the CALL is present, not that authorization is correct. It
 * cannot catch a handler that checks the session and then ignores the answer.
 * It catches the failure that actually happens: forgetting entirely.
 */

const APP_DIR = path.join(process.cwd(), "src", "app");

/**
 * Pages that are meant to be reachable without a session.
 *
 * Two, and each earns it differently. `/login` has nothing to protect. `/s/`
 * serves one demo to the business it was made for, and its access control is
 * the share token in the path -- issued deliberately, expiring, revocable --
 * rather than a session. Adding to this set is the visible diff that makes
 * such a decision reviewable.
 */
const PUBLIC_PAGES = new Set(["login/page.tsx", "s/[token]/page.tsx"]);

/** Route handlers that are meant to be reachable without a session. */
const PUBLIC_ROUTES = new Set<string>([]);

/** Every file named `target` under `dir`, as a posix-style relative path. */
function filesNamed(dir: string, target: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...filesNamed(path.join(dir, entry.name), target, relative));
    } else if (entry.name === target) {
      found.push(relative);
    }
  }
  return found;
}

function read(relative: string): string {
  return readFileSync(path.join(APP_DIR, relative), "utf8");
}

// A character class avoids escaping the paren, which keeps this readable.
const HANDLER = /export async function (GET|POST|PATCH|PUT|DELETE)[(]/g;

/** Split a route file into one chunk per exported HTTP handler. */
function handlerBodies(source: string): { method: string; body: string }[] {
  const starts = [...source.matchAll(HANDLER)].map((match) => ({
    method: match[1],
    index: match.index,
  }));

  return starts.map((start, i) => ({
    method: start.method,
    body: source.slice(start.index, starts[i + 1]?.index ?? source.length),
  }));
}

describe("every page requires a session", () => {
  const pages = filesNamed(APP_DIR, "page.tsx");

  it("finds the pages at all", () => {
    // A walk that silently matched nothing would make every assertion below
    // vacuously true, which is how a guard like this rots without anyone
    // noticing. Assert it found something before trusting what it says.
    expect(pages.length).toBeGreaterThanOrEqual(5);
  });

  it("finds the login page, so the allow-list is not stale", () => {
    for (const allowed of PUBLIC_PAGES) {
      expect(pages).toContain(allowed);
    }
  });

  for (const page of filesNamed(APP_DIR, "page.tsx")) {
    const isPublic = PUBLIC_PAGES.has(page);

    it(`${page} ${isPublic ? "is deliberately public" : "calls requireSession()"}`, () => {
      const source = read(page);
      if (isPublic) {
        expect(source).not.toContain("requireSession(");
      } else {
        expect(source).toContain("await requireSession()");
      }
    });
  }
});

describe("every route handler requires a session", () => {
  const routes = filesNamed(APP_DIR, "route.ts");

  it("finds the route handlers at all", () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  for (const route of filesNamed(APP_DIR, "route.ts")) {
    const source = read(route);
    const handlers = handlerBodies(source);
    const isPublic = PUBLIC_ROUTES.has(route);

    it(`${route} exports at least one handler`, () => {
      expect(handlers.length).toBeGreaterThan(0);
    });

    for (const { method, body } of handlers) {
      it(`${route} ${method} ${isPublic ? "is deliberately public" : "calls requireApiSession()"}`, () => {
        if (isPublic) {
          expect(body).not.toContain("requireApiSession(");
          return;
        }
        expect(body).toContain("await requireApiSession()");
        // The denial must be RETURNED, not merely awaited: a bare
        // `await requireApiSession();` type-checks and protects nothing.
        expect(body).toContain("if (!guard.ok) return guard.response;");
      });
    }
  }
});

describe("proxy and the session module agree", () => {
  const proxySource = readFileSync(path.join(process.cwd(), "src", "proxy.ts"), "utf8");

  it("use the same cookie name", () => {
    // proxy.ts cannot import `@/server/auth` -- that module is server-only and
    // Proxy is not resolved under React's react-server condition -- so the
    // constant is duplicated there. This is what stops the two copies
    // drifting: a rename on one side only would sign everybody out silently.
    expect(proxySource).toContain(`const SESSION_COOKIE = "${SESSION_COOKIE}"`);
  });

  it("agree on which pages are public", () => {
    for (const page of PUBLIC_PAGES) {
      const route = `/${page.replace("/page.tsx", "")}`;
      // A dynamic segment is exempted by prefix rather than by literal path,
      // because the token varies. `/s/[token]` is allowed by `/s/`.
      const dynamic = route.indexOf("/[");
      const expected = dynamic === -1 ? route : `${route.slice(0, dynamic)}/`;
      expect(proxySource, `proxy.ts does not exempt ${route}`).toContain(`"${expected}"`);
    }
  });
});
