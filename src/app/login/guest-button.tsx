"use client";

import { useActionState } from "react";

import { BUTTON_SECONDARY } from "@/components/ui/primitives";

import { signInAsGuest, type SignInState } from "./actions";

/**
 * "Continue as guest": a read-only look around, no password.
 *
 * Its own form, so it never submits the password field beside it.
 */
export function GuestButton() {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAsGuest, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button type="submit" disabled={pending} className={`${BUTTON_SECONDARY} w-full py-2`}>
        {pending ? "Opening…" : "Continue as guest"}
      </button>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Look around every page. Nothing can be changed.
      </p>
      {state.error ? (
        <p role="alert" className="text-center text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
