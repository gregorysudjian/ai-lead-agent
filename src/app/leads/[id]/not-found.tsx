import Link from "next/link";

import { EmptyState, LINK } from "@/components/ui/primitives";

/** Shown when a lead id does not exist in the store. */
export default function LeadNotFound() {
  return (
    <EmptyState
      title="Lead not found"
      description="No stored lead has that ID. It may have been removed from the store."
      action={
        <Link href="/leads" className={`text-sm ${LINK}`}>
          &larr; Back to leads
        </Link>
      }
    />
  );
}
