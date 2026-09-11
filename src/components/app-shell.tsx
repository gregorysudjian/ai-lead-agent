"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { SignOutButton } from "./sign-out-button";
import { FOCUS_RING } from "./ui/primitives";

/**
 * Dashboard shell: persistent sidebar on desktop, collapsible nav on mobile.
 *
 * A Client Component only because it needs the current pathname to mark the
 * active link and local state for the mobile menu. Page content is passed in as
 * children, so pages themselves stay Server Components.
 */

interface NavItem {
  href: string;
  label: string;
  /** Present when the feature is not built yet. Rendered disabled, never linked. */
  comingSoon?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/ai-analysis", label: "AI Analysis", comingSoon: true },
  { href: "/demos", label: "Demo Sites" },
  { href: "/outreach", label: "Outreach", comingSoon: true },
];

/**
 * Routes that render WITHOUT the dashboard chrome.
 *
 * Two unrelated reasons, both ending in "no sidebar":
 *
 * - A demo-site preview is meant to look like the customer's proposed website,
 *   not like our admin tool. The `/demos` index itself keeps the chrome; only
 *   an individual preview drops it.
 * - The login page has no session yet, so a nav bar of links the visitor
 *   cannot follow -- and a sign-out button for a session they do not have --
 *   would be nonsense.
 */
function isChromeless(pathname: string): boolean {
  if (pathname === "/login") return true;
  // A shared demo is somebody else's proposed website seen by somebody who is
  // not our operator. Our sidebar has no place on it at all.
  if (pathname.startsWith("/s/")) return true;
  return /^\/demos\/[^/]+$/.test(pathname);
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {NAV.map((item) => {
        if (item.comingSoon) {
          return (
            <li key={item.href}>
              <span
                aria-disabled="true"
                title="Not implemented yet"
                className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400 dark:text-slate-600"
              >
                {item.label}
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase dark:bg-slate-800 dark:text-slate-400">
                  Soon
                </span>
              </span>
            </li>
          );
        }

        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${FOCUS_RING} ${
                active
                  ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
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
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  /**
   * Escape closes the mobile menu and puts focus back where it came from.
   *
   * Without the second half the panel closes and focus is left on an element
   * that no longer exists, which drops a keyboard user back at the top of the
   * document. The handler sits on the wrapper rather than the panel so it also
   * fires while focus is still on the toggle.
   */
  function handleMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "Escape" || !menuOpen) return;
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  // Rendered full-bleed, with the page supplying its own chrome.
  if (isChromeless(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/*
        The first thing in the tab order, and visible only once focused.

        Every page put five nav links and a sign-out button in front of its
        own content, which a keyboard user had to tab past on every single
        navigation.
      */}
      <a
        href="#main-content"
        className={`sr-only z-50 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white ${FOCUS_RING}`}
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <Wordmark />
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
          <NavLinks />
        </nav>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <SignOutButton />
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Internal prototype. Review leads manually; nothing is contacted automatically.
          </p>
        </div>
      </aside>

      {/* Mobile header */}
      <div
        onKeyDown={handleMenuKeyDown}
        className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Wordmark />
          <button
            ref={menuButton}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className={`rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200 ${FOCUS_RING}`}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
        {menuOpen ? (
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="border-t border-slate-200 p-3 dark:border-slate-800"
          >
            <NavLinks onNavigate={() => setMenuOpen(false)} />
            <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
              <SignOutButton />
            </div>
          </nav>
        ) : null}
      </div>

      {/* `tabIndex={-1}` is what makes the skip link actually move focus:
          without it the browser scrolls to the target and leaves focus at the
          top of the document, so the next Tab lands back in the nav. */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
