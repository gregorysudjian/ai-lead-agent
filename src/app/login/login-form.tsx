"use client";

import { useActionState, useState } from "react";

import { FOCUS_RING } from "@/components/ui/primitives";

import { signIn, type SignInState } from "./actions";

/**
 * The password form.
 *
 * A Client Component only so a failed attempt can be shown without losing the
 * page. The action itself runs on the server; the password is never held in
 * client state.
 */

/**
 * Eye / eye-with-slash.
 *
 * Inline SVG rather than an icon dependency -- two paths do not justify a
 * package. `aria-hidden` because the button already carries the label.
 */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {open ? <path d="M4 20 20 4" /> : null}
    </svg>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});
  const [visible, setVisible] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            // Toggled by the eye button. Defaults to hidden: the reveal is
            // there for typing a long password, not for leaving it on screen.
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            required
            aria-describedby={state.error ? "password-error" : undefined}
            aria-invalid={state.error ? true : undefined}
            className={`w-full rounded-lg border border-slate-300 bg-white py-2 pr-11 pl-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${FOCUS_RING}`}
          />
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            // Not in the tab order between the field and Sign in: keyboard
            // users tab straight from password to submit.
            tabIndex={-1}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            title={visible ? "Hide password" : "Show password"}
            className={`absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 ${FOCUS_RING}`}
          >
            <EyeIcon open={visible} />
          </button>
        </div>
      </div>

      {state.error ? (
        <p
          id="password-error"
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
