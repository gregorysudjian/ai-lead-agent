"use client";

import { signOut } from "@/app/login/actions";

import { FOCUS_RING } from "./ui/primitives";
import { useIsGuest } from "./viewer";

/**
 * Sign out.
 *
 * A form posting to a Server Action rather than a link, because signing out
 * changes state and a GET that mutates is a CSRF footgun -- a prefetch or an
 * image tag pointing at it would log the operator out.
 */
export function SignOutButton() {
  const guest = useIsGuest();
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${FOCUS_RING}`}
      >
        {guest ? "Leave guest view" : "Sign out"}
      </button>
    </form>
  );
}
