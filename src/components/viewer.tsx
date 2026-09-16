"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Who is looking: the operator, or a read-only guest.
 *
 * Read ONCE on the server (the root layout verifies the session cookie) and
 * handed down, so a button can show itself disabled for a guest. This is
 * presentation only -- the server refuses a guest's writes regardless of what
 * any button does. See `server/auth/access.ts`.
 */
const GuestContext = createContext(false);

export function ViewerProvider({ guest, children }: { guest: boolean; children: ReactNode }) {
  return <GuestContext.Provider value={guest}>{children}</GuestContext.Provider>;
}

export function useIsGuest(): boolean {
  return useContext(GuestContext);
}

/** The tooltip on every control a guest cannot use. */
export const GUEST_DISABLED_TITLE = "Read-only guest view: sign in as the operator to use this.";
