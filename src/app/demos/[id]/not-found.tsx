import Link from "next/link";

import { BUTTON_SECONDARY, EmptyState } from "@/components/ui/primitives";

/** Shown when a demo id does not resolve to a stored demo site. */
export default function DemoNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <EmptyState
        title="Demo site not found"
        description="No stored demo site has that id. It may never have existed, or the lead it belonged to may have been removed."
        action={
          <Link href="/demos" className={BUTTON_SECONDARY}>
            Back to demo sites
          </Link>
        }
      />
    </div>
  );
}
