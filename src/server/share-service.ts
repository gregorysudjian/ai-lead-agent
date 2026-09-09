import "server-only";

import type { DemoSite } from "@/lib/demo-site";
import { isShareViewable, shareExpiry, type DemoShare } from "@/lib/demo-share";
import { getDemoShareRepository, getDemoSiteRepository } from "@/server/repo";

/**
 * Issuing, resolving and withdrawing share links.
 *
 * The business rules live here rather than in a route handler, so the public
 * page and the operator's API cannot disagree about what makes a link usable.
 */

/** The demo named does not exist. A normal outcome the caller reports as 404. */
export class DemoNotFoundError extends Error {
  constructor(demoId: string) {
    super(`No demo site with id ${demoId}.`);
    this.name = "DemoNotFoundError";
  }
}

/**
 * Issue a share for a demo.
 *
 * The demo is loaded first, so a share can never be created for something that
 * does not exist -- an orphaned token would resolve to nothing and look like a
 * bug to whoever was handed it.
 */
export async function shareDemo(
  demoId: string,
  options: { days: number; note: string | null },
): Promise<DemoShare> {
  const demo = await getDemoSiteRepository().findById(demoId);
  if (!demo) throw new DemoNotFoundError(demoId);

  return getDemoShareRepository().create({
    demoId: demo.id,
    // Clamped by `shareExpiry`, so no route can issue a link that outlives the
    // maximum however it validates its own input.
    expiresAt: shareExpiry(options.days),
    note: options.note,
  });
}

/** Every share issued for a demo, newest first. For the operator's view. */
export async function sharesForDemo(demoId: string): Promise<DemoShare[]> {
  return getDemoShareRepository().listForDemo(demoId);
}

/** Withdraw a link. Returns null when no share has that id. */
export async function revokeShare(shareId: string): Promise<DemoShare | null> {
  return getDemoShareRepository().revoke(shareId);
}

/**
 * Resolve a token to the demo it grants access to.
 *
 * Returns null for EVERY failure -- unknown token, expired, revoked, or a
 * share whose demo has since been deleted. The caller renders one 404 for all
 * of them.
 *
 * That flattening is deliberate. A distinct "this link has expired" would
 * confirm to a stranger holding a guess that the token was once real, which is
 * more than they are entitled to learn. The operator sees the true state in
 * their own view, where `shareState` reports it precisely.
 *
 * This function performs NO write. A public page that recorded a view would be
 * a write triggered by an unauthenticated request, and anyone holding the
 * token could drive it.
 */
export async function resolveSharedDemo(token: string): Promise<DemoSite | null> {
  // A token far outside the issued length is not worth a database round trip.
  if (typeof token !== "string" || token.length < 32 || token.length > 128) return null;

  const share = await getDemoShareRepository().findByToken(token);
  if (share === null) return null;
  if (!isShareViewable(share)) return null;

  return getDemoSiteRepository().findById(share.demoId);
}
