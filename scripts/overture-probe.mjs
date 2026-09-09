/**
 * Assess a region in Overture before committing to ingesting it.
 *
 * NOT part of the application. An offline script, run by hand, that answers
 * the question the region-wide expansion rests on: does Overture know about
 * businesses OpenStreetMap does not, and is its "no website" signal good
 * enough to act on?
 *
 * Reads Overture's public Parquet over HTTPS. DuckDB pushes the bounding-box
 * filter down to the row-group level, so this reads a fraction of a ~7GB
 * dataset. Nothing is downloaded to disk and nothing is written to any
 * database -- it only reports.
 *
 *   node scripts/overture-probe.mjs
 *   node scripts/overture-probe.mjs --west=-97.9 --south=30.0 --east=-97.5 --north=30.5
 *
 * The bbox prunes row groups; it does NOT decide membership. Overture places
 * carry structured `region` and `locality` on their address, and those are what
 * an actual ingest filters on -- which is why this probe's sample rows include
 * towns just outside the box.
 */
import { DuckDBInstance } from "@duckdb/node-api";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.slice(name.length + 3)) : fallback;
};

// Island of Montreal, generously.
const BBOX = {
  west: arg("west", -73.99),
  south: arg("south", 45.4),
  east: arg("east", -73.46),
  north: arg("north", 45.72),
};

const RELEASE = process.env.OVERTURE_RELEASE ?? "2026-08-19.0";
const PLACES = `s3://overturemaps-us-west-2/release/${RELEASE}/theme=places/type=place/*.parquet`;

/** The categories this business actually sells to. */
const CATEGORIES = [
  "bakery", "barber", "hair_salon", "beauty_salon", "nail_salon",
  "restaurant", "cafe", "dentist", "pharmacy", "gym", "florist",
  "automotive_repair",
];

/**
 * Hosts that are not a website the business owns.
 *
 * Deliberately wider than `social-hosts.ts` was when this was written: the
 * probe found that directory listings (pj.ca, yp.ca) and booking platforms
 * (fresha, gorendezvous) are as common as social profiles in this data, and
 * a business whose only "website" is a Yellow Pages entry is a prospect, not
 * a business with a website.
 */
const NOT_OWN_SITE = [
  "instagram.com", "facebook.com", "fb.com", "fb.me", "linktr.ee", "linktree.com",
  "twitter.com", "x.com", "tiktok.com", "youtube.com", "pinterest.com", "threads.net",
  "linkedin.com", "beacons.ai", "carrd.co", "about.me",
  "yelp.com", "yelp.ca", "pj.ca", "yp.ca", "pagesjaunes.ca", "yellowpages.ca",
  "fresha.com", "gorendezvous.com", "booksy.com", "square.site", "setmore.com",
  "wa.me", "business.site", "sites.google.com",
];

const instance = await DuckDBInstance.create(":memory:");
const db = await instance.connect();
await db.run("INSTALL httpfs; LOAD httpfs;");
await db.run("SET s3_region='us-west-2';");

const rows = async (sql) => (await db.runAndReadAll(sql)).getRowObjects();
const plain = (list) =>
  list.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]),
    ),
  );

const inBox = `
  bbox.xmin BETWEEN ${BBOX.west} AND ${BBOX.east}
  AND bbox.ymin BETWEEN ${BBOX.south} AND ${BBOX.north}
`;
const inCategories = `categories.primary IN (${CATEGORIES.map((c) => `'${c}'`).join(",")})`;
const notOwnSite = NOT_OWN_SITE.map((h) => `lower(websites[1]) LIKE '%${h}%'`).join(" OR ");

console.log(`Overture release ${RELEASE}`);
console.log(`bbox  W ${BBOX.west}  S ${BBOX.south}  E ${BBOX.east}  N ${BBOX.north}\n`);

console.log("--- by category ---");
console.table(
  plain(
    await rows(`
      SELECT categories.primary AS category,
             count(*) AS places,
             count(*) FILTER (WHERE websites IS NULL) AS no_website,
             count(*) FILTER (WHERE websites IS NOT NULL AND (${notOwnSite})) AS not_own_site,
             count(*) FILTER (WHERE (websites IS NULL OR (${notOwnSite}))
                                AND phones IS NOT NULL
                                AND confidence >= 0.5) AS addressable
      FROM read_parquet('${PLACES}')
      WHERE ${inBox} AND ${inCategories}
      GROUP BY 1 ORDER BY addressable DESC
    `),
  ),
);

console.log("--- what the website field actually holds ---");
console.table(
  plain(
    await rows(`
      SELECT regexp_extract(lower(websites[1]), 'https?://(?:www\.)?([^/]+)', 1) AS host,
             count(*) AS n
      FROM read_parquet('${PLACES}')
      WHERE ${inBox} AND ${inCategories} AND websites IS NOT NULL
      GROUP BY 1 ORDER BY n DESC LIMIT 15
    `),
  ),
);

console.log("--- confidence, for places with no site of their own ---");
console.table(
  plain(
    await rows(`
      SELECT round(confidence, 1) AS confidence, count(*) AS n
      FROM read_parquet('${PLACES}')
      WHERE ${inBox} AND ${inCategories} AND (websites IS NULL OR (${notOwnSite}))
      GROUP BY 1 ORDER BY 1 DESC
    `),
  ),
);

await db.closeSync();
