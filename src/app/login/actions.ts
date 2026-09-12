"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeInternalPath } from "@/lib/safe-redirect";
import { createSession, destroySession, passwordMatches } from "@/server/auth";
import {
  checkSharedSignInLimit,
  hashVisitor,
  recordSignInOutcome,
  supabaseAttemptStore,
  type AttemptStore,
} from "@/server/auth/sign-in-attempts";
import { leadRepositoryName, sessionSecret } from "@/server/env";
import { checkRateLimit, clientIdentity } from "@/server/rate-limit";
import { getSupabaseClient } from "@/server/supabase/client";

/**
 * Sign in and sign out.
 *
 * Server Actions rather than route handlers so the login form works without
 * JavaScript and so the password never travels through a URL or a client-side
 * fetch we would have to write by hand.
 */

/** The shared failure count lives in Supabase when the app uses Supabase. */
function attemptStore(): AttemptStore | null {
  try {
    return leadRepositoryName() === "supabase" ? supabaseAttemptStore(getSupabaseClient()) : null;
  } catch (error) {
    console.error("[signIn] no shared attempt store:", error);
    return null;
  }
}

const signInSchema = z.object({
  password: z.string().min(1, "Enter your password.").max(200),
  next: z.string().optional(),
});

export interface SignInState {
  error?: string;
}

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "Enter your password." };
  }

  // The only unauthenticated entry point in the app, so the only one where a
  // limit is guarding against guessing rather than protecting a third party.
  // See `clientIdentity` for why this slows a script rather than stopping one.
  const address = clientIdentity({ headers: await headers() });
  const attempt = checkRateLimit("signIn", address);
  if (!attempt.allowed) {
    return {
      error: `Too many sign-in attempts. Try again in ${Math.ceil(
        attempt.retryAfterSeconds / 60,
      )} minute(s).`,
    };
  }

  // The same limit, counted where every server can see it. See
  // `sign-in-attempts.ts`: a missing or failing store never locks anyone out.
  let visitor: string | null = null;
  let store: AttemptStore | null = null;
  try {
    visitor = hashVisitor(address, sessionSecret());
    store = attemptStore();
  } catch (error) {
    console.error("[signIn] shared attempt limit not configured:", error);
  }
  if (visitor !== null) {
    const shared = await checkSharedSignInLimit(store, visitor);
    if (!shared.allowed) {
      return { error: `Too many sign-in attempts. Try again in ${shared.retryAfterMinutes} minutes.` };
    }
  }

  let ok: boolean;
  try {
    ok = passwordMatches(parsed.data.password);
  } catch (error) {
    // Thrown when AUTH_PASSWORD is unset or too short. That is a deployment
    // fault, not the operator's: log the detail, show something generic.
    console.error("[signIn] authentication is not configured:", error);
    return { error: "Sign-in is not configured. Check the server logs." };
  }

  if (visitor !== null) await recordSignInOutcome(store, visitor, ok);

  if (!ok) {
    // One message for a wrong password, deliberately saying nothing about
    // whether anything else was right. There is only one account, so there is
    // no username to enumerate -- but the habit is worth keeping.
    return { error: "Incorrect password." };
  }

  await createSession();

  // `next` came from a query string an attacker can write. Reduced to an
  // internal path, or dropped entirely. See `safeInternalPath`.
  redirect(safeInternalPath(parsed.data.next, "/"));
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
