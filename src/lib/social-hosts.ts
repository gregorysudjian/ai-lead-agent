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
export const SOCIAL_PROFILE_HOSTS: readonly string[] = [
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
];

/**
 * Directories that list a business rather than host its site.
 *
 * Yelp was here first and the rest arrived from real data. Probing Overture's
 * Montreal coverage found Yellow Pages (pj.ca, yp.ca, pagesjaunes.ca) among
 * the most common "websites" for salons and garages -- 532 businesses across
 * six categories listed a link that was not their own site, and every one of
 * them had been counted as a business that already has a website.
 *
 * A directory entry is written ABOUT a business, usually not BY it. It is the
 * clearest possible signal of a prospect, and the opposite of what the field
 * was being read as.
 */
const DIRECTORY_HOSTS: readonly string[] = [
  "yelp.com",
  "yelp.ca",
  "pj.ca",
  "pagesjaunes.ca",
  "yp.ca",
  "yellowpages.ca",
  "yellowpages.com",
  "411.ca",
  "foursquare.com",
  "tripadvisor.com",
  "tripadvisor.ca",
];

/**
 * Booking and ordering platforms.
 *
 * A Fresha page takes appointments; it does not say who the business is, what
 * it stands for, or why anyone should choose it. A salon whose only web
 * presence is a booking widget has exactly the gap this product fills.
 *
 * `business.site` is Google's auto-generated page for businesses that have no
 * site of their own, which makes it the strongest prospect signal in the list.
 */
const BOOKING_HOSTS: readonly string[] = [
  "fresha.com",
  "gorendezvous.com",
  "booksy.com",
  "setmore.com",
  "planity.com",
  "wa.me",
  "business.site",
];

/**
 * ── TWO QUESTIONS, TWO LISTS ──────────────────────────────────────────────
 *
 * These look like one concept and are not, and conflating them broke booking
 * extraction the first time round.
 *
 *   "Is this listed website actually their own site?"  -> SOCIAL_PAGE_HOSTS
 *      Asked by scoring and the lead UI. A Fresha booking page answers NO,
 *      which is what makes that salon a prospect.
 *
 *   "Is this link on their page a social profile?"     -> SOCIAL_PROFILE_HOSTS
 *      Asked by the research extractor while reading a business's own site. A
 *      Fresha link answers NO -- it is a BOOKING link, a genuinely useful and
 *      different fact, recorded as `web.bookingUrl`.
 *
 * The same host gives opposite answers to the two questions, so a single list
 * cannot serve both. Putting booking hosts in the broad list and pointing the
 * extractor at it made every booking link get filed as a social profile and
 * silently dropped `web.bookingUrl` from every researched business.
 *
 * Every host that publishes a page rather than a website.
 *
 * Composed from the groups above rather than written flat, so a future reader
 * can see WHY each entry qualifies -- the three reasons are different and a
 * single list would hide that.
 *
 * Deliberately absent: platform site builders such as Squarespace, Wix,
 * `square.site` and `sites.google.com`. A business that built a site on a
 * platform HAS a site -- it may be a poor one, and it may still be worth a
 * conversation, but calling it "no website" would be the same overstatement
 * this module exists to prevent, pointed the other way.
 */
export const SOCIAL_PAGE_HOSTS: readonly string[] = [
  ...SOCIAL_PROFILE_HOSTS,
  ...DIRECTORY_HOSTS,
  ...BOOKING_HOSTS,
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
