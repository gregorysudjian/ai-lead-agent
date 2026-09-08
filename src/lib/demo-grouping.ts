/**
 * Group demo sites by the business they propose a site for.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Every generation is its own immutable row, so a demo shown to a prospect
 * months ago stays exactly as it was. That is deliberate and worth keeping:
 * regenerating must never silently rewrite what someone was already shown.
 *
 * But it makes the index misleading. Generate twice for one salon and the page
 * shows two cards for one business, as though there were two prospects. The
 * history is right; the flat listing of it is not.
 *
 * So the store stays append-only and the INDEX groups: one card per business,
 * showing the newest version and how many exist behind it.
 *
 * Pure and total -- no clock, no store, no I/O -- so the ordering rules below
 * are directly testable.
 */
import type { DemoSite } from "./demo-site";

export interface DemoGroup {
  /** The lead every demo in this group belongs to. */
  leadId: string;
  /** The newest demo, by `createdAt`. What the index shows. */
  latest: DemoSite;
  /**
   * Every demo for this lead, newest first, including `latest` at index 0.
   * Kept whole rather than reduced to a count, so a caller can offer the
   * history without going back to the store.
   */
  versions: DemoSite[];
}

/**
 * Newest first, with a stable tiebreak.
 *
 * Two demos can share a `createdAt` -- the JSON store writes an ISO string at
 * whole-millisecond resolution and generation is fast. Falling back to the id
 * keeps the order deterministic instead of dependent on input order, so the
 * page does not reshuffle between renders.
 */
function newestFirst(a: DemoSite, b: DemoSite): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

/**
 * One group per lead, groups ordered by their newest demo.
 *
 * A business whose demo was regenerated today sorts above one last touched a
 * week ago, which is the order someone reviewing recent work wants.
 */
export function groupDemosByLead(demos: readonly DemoSite[]): DemoGroup[] {
  const byLead = new Map<string, DemoSite[]>();

  for (const demo of demos) {
    const existing = byLead.get(demo.leadId);
    if (existing) existing.push(demo);
    else byLead.set(demo.leadId, [demo]);
  }

  const groups: DemoGroup[] = [];
  for (const [leadId, versions] of byLead) {
    const sorted = [...versions].sort(newestFirst);
    groups.push({ leadId, latest: sorted[0], versions: sorted });
  }

  return groups.sort((a, b) => newestFirst(a.latest, b.latest));
}
