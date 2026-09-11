import Link from "next/link";

import { BUTTON_SECONDARY, EmptyState } from "@/components/ui/primitives";

/**
 * An address that matches no route.
 *
 * Renders inside the dashboard chrome, because anyone who reaches it is a
 * signed-in operator who mistyped a URL -- not a stranger. The routes that a
 * stranger can reach supply their own 404s, which say considerably less.
 */
export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="That address does not match anything in this application. It may have been a typo, or a link to a screen that no longer exists."
      action={
        <Link href="/" className={BUTTON_SECONDARY}>
          Back to the dashboard
        </Link>
      }
    />
  );
}
