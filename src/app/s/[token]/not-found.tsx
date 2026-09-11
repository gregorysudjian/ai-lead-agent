import type { Metadata } from "next";

/**
 * The 404 for a share link, and the ONLY one this route ever renders.
 *
 * Unknown, expired, revoked and "the demo behind it is gone" all arrive here,
 * and the page cannot say which. A distinct "this link has expired" would
 * confirm to a stranger holding a guess that the token was once real, which is
 * exactly the signal that makes guessing worth continuing.
 *
 * So the copy is deliberately incurious about the reason, names no business,
 * and carries no link back into the application: there is nothing here for
 * anyone who is not already holding a working link.
 */
export const metadata: Metadata = {
  title: { absolute: "Link unavailable" },
  robots: { index: false, follow: false },
};

export default function SharedDemoNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          This link is not available
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          The link you followed does not open anything. Links like this one are
          temporary by design and stop working after a while.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          If somebody shared a draft website proposal with you, ask them for a new
          link.
        </p>
      </div>
    </div>
  );
}
