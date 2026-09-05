import Link from "next/link";

/** Shown when a lead id does not exist in the store. */
export default function LeadNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Lead not found</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        No stored lead has that ID. It may have been removed from the development
        store.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
      >
        &larr; Back to dashboard
      </Link>
    </main>
  );
}
