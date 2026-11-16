/**
 * Whether the catalog's upkeep looks stalled. Pure: the caller passes the time.
 *
 * The weekly refresh failed every Monday for seven weeks in autumn 2026 and
 * nobody saw it, because a job that fails on GitHub says nothing in the app.
 * So the dashboard says it instead.
 *
 * A refresh records a run only when Overture has published something new, and
 * Overture publishes about once a month. A healthy job therefore leaves gaps
 * of four to six weeks between completed runs, and a stricter threshold would
 * warn about a job that is working. Forty-five days is past any normal gap
 * and still catches a broken job inside two missed releases.
 */
export const STALLED_AFTER_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

export function refreshLooksStalled(lastCompletedAt: string | null, now: number): boolean {
  if (lastCompletedAt === null) return false;
  const finished = Date.parse(lastCompletedAt);
  if (Number.isNaN(finished)) return false;
  return now - finished > STALLED_AFTER_DAYS * DAY_MS;
}
