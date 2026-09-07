/**
 * Hosts that publish a business PAGE rather than a business WEBSITE.
 *
 * ── WHY THIS DISTINCTION EARNS ITS OWN MODULE ─────────────────────────────
 *
 * A directory records "website: https://facebook.com/their-shop" because that
 * is the link the business gave it. For most purposes that is fine. For THIS
 * product it is the difference between a prospect and a non-prospect: a shop
 * whose entire web presence is a Facebook page is exactly who a web designer
 * should be talking to, and treating that link as "they already have a
 * website" removes them from the list.
 *
 * The real batch made the cost concrete. Of 27 leads that listed a website,
 * seven listed a Facebook page -- and every one of them was being scored as a
 * business that already has a site, losing the single largest factor in the
 * rubric and sinking down the review order.
 *
 * Pure, no I/O, safe on both sides of the boundary, and deliberately an
 * ALLOWLIST of hosts we recognise. An unknown host is treated as a real
 * website, because guessing the other way would quietly promote businesses we
 * know nothing about.
 */

/**
 * Social and link-in-bio hosts.
 *
 * Link-in-bio services belong here for the same reason as social networks: a
 * Linktree is a list of links, not a website, and a business relying on one has
 * the problem this product solves.
 */
export const SOCIAL_PAGE_HOSTS: readonly string[] = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "threads.net",
  "linktr.ee",
  "beacons.ai",
  "carrd.co",
  "about.me",
  "yelp.com",
  "yelp.ca",
];

/** Exact host or a subdomain of one, with `www.` ignored. */
export function isSocialHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return SOCIAL_PAGE_HOSTS.some(
    (candidate) => host === candidate || host.endsWith(`.${candidate}`),
  );
}

/**
 * Is this listed "website" actually a social or link-in-bio page?
 *
 * `false` for null, for anything unparseable, and for any host we do not
 * recognise -- all of which are treated as a real website. Only a host we can
 * positively identify counts as a page.
 */
export function isSocialProfileUrl(value: string | null): boolean {
  if (value === null) return false;
  const raw = value.trim();
  if (raw.length === 0) return false;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return isSocialHost(url.hostname);
  } catch {
    return false;
  }
}
