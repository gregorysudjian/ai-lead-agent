import type { Metadata } from "next";

import { safeInternalPath } from "@/lib/safe-redirect";

import { LoginForm } from "./login-form";

/**
 * The one page reachable without a session.
 *
 * Listed in `PUBLIC_PATHS` in `proxy.ts` and in the allow-list in
 * `auth-coverage.test.ts`; it deliberately calls no session guard.
 */
export const metadata: Metadata = { title: "Sign in" };

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Sanitised here as well as in the action, so a hostile `next` never even
  // reaches the rendered HTML as a form value.
  const target = safeInternalPath(next, "/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
          >
            LF
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Lead Finder
          </span>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Sign in
        </h1>
        <p className="mt-1 mb-6 text-sm text-slate-600 dark:text-slate-400">
          This tool holds lead records and draft outreach. It is for the operator only.
        </p>

        <LoginForm next={target} />
      </div>
    </div>
  );
}
