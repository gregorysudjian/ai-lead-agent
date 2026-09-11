/**
 * Photograph lab demos, so a design can be judged by looking at it.
 *
 *   # The dev server must be running (npm run dev -- -p 3002).
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/demo-screens.mts
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/demo-screens.mts --count=24 --name=after
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/demo-screens.mts --ids=<uuid>,<uuid>
 *
 * Writes `data/screens/<name>/` -- a desktop and a mobile full-page PNG per
 * business, and `index.html`, a contact sheet of them all. `data/` is
 * gitignored: these are pictures of named businesses' proposed sites.
 *
 * ── WHY THESE BUSINESSES ──────────────────────────────────────────────────
 *
 * A generator that looks good on "Salon Lumière, 4500 Rue Wellington, phone
 * and address listed" can still fall apart on a 60-character name with no
 * phone. So the sample is chosen to cover the cases that break designs: every
 * trade, the longest and shortest names, missing phone, missing address, a
 * listed website, and several municipalities. Deterministic, so a "before"
 * and an "after" run photograph the same businesses.
 *
 * ── HOW ───────────────────────────────────────────────────────────────────
 *
 * `playwright-core` drives the Edge already installed on this machine; no
 * browser is downloaded. A session cookie is minted with the app's own signing
 * code, exactly as a login would issue one. Screenshots are taken with
 * reduced motion, so scroll-driven effects show their finished state rather
 * than a random mid-animation frame.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright-core";

import { CATALOG_TRADE_KEYS, catalogTradeForLabel } from "../src/lib/catalog/trades";
import type { CatalogBusiness } from "../src/lib/catalog/types";
import { newSessionPayload, signSessionToken } from "../src/server/auth/token";
import { getCatalogRepository } from "../src/server/repo";

function flag(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const base = flag("base") ?? "http://localhost:3002";
const count = Number(flag("count") ?? 20);
const runName = flag("name") ?? new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join("data/screens", runName);
const explicitIds = flag("ids")?.split(",").filter(Boolean) ?? null;
const extraQuery = flag("query") ?? "";

const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error("SESSION_SECRET is not set; run with --env-file=.env.local.");

/** A deterministic, deliberately awkward sample of the catalog. */
function chooseSample(all: CatalogBusiness[], n: number): CatalogBusiness[] {
  const current = all.filter((b) => b.lastSeenRelease === all[0]?.lastSeenRelease || true);
  const byName = [...current].sort((a, b) => a.provider.name.localeCompare(b.provider.name, "en"));
  const picked = new Map<string, CatalogBusiness>();
  const take = (b: CatalogBusiness | undefined) => {
    if (b && picked.size < n) picked.set(b.id, b);
  };

  // The shapes that break layouts.
  take([...byName].sort((a, b) => b.provider.name.length - a.provider.name.length)[0]);
  take([...byName].sort((a, b) => a.provider.name.length - b.provider.name.length)[0]);
  take(byName.find((b) => b.provider.phone === null));
  take(byName.find((b) => b.provider.address === null));
  take(byName.find((b) => b.provider.website !== null && !b.provider.website.includes("instagram")));
  take(byName.find((b) => b.municipality !== "Montréal"));

  // Then round-robin across trades, spreading through the alphabet.
  const perTrade = CATALOG_TRADE_KEYS.map((key) =>
    byName.filter((b) => catalogTradeForLabel(b.provider.category)?.key === key),
  );
  for (let round = 0; picked.size < n && round < 50; round += 1) {
    for (const pool of perTrade) {
      if (pool.length === 0) continue;
      take(pool[Math.floor(((round * 7919) % 997) / 997 * pool.length) % pool.length]);
    }
  }
  return [...picked.values()];
}

const catalog = getCatalogRepository();
const all = await catalog.listAll();
const targets = explicitIds
  ? all.filter((b) => explicitIds.includes(b.id))
  : chooseSample(all, count);

mkdirSync(outDir, { recursive: true });
const cookie = signSessionToken(newSessionPayload("operator"), secret);
const host = new URL(base).hostname;

const browser = await chromium.launch({ channel: "msedge", headless: true });
const shots: { business: CatalogBusiness; desktop: string; mobile: string }[] = [];

try {
  for (const [index, business] of targets.entries()) {
    const slug = business.provider.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const entry = { business, desktop: "", mobile: "" };

    for (const viewport of [
      { key: "desktop", width: 1440, height: 900 },
      { key: "mobile", width: 390, height: 844 },
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      await context.addCookies([{ name: "lf_session", value: cookie, domain: host, path: "/" }]);
      const page = await context.newPage();
      const url = `${base}/demos/lab?business=${business.id}${extraQuery ? `&${extraQuery}` : ""}`;
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      if (!response || response.status() !== 200) {
        console.warn(`  ${business.provider.name}: HTTP ${response?.status()}`);
      }
      await page.evaluate(() => document.fonts.ready);
      const file = `${String(index + 1).padStart(2, "0")}-${slug}-${viewport.key}.png`;
      await page.screenshot({ path: join(outDir, file), fullPage: true });
      entry[viewport.key] = file;
      await context.close();
    }
    shots.push(entry);
    console.log(`${index + 1}/${targets.length}  ${business.provider.name}`);
  }
} finally {
  await browser.close();
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Demo screens · ${escape(runName)}</title>
<style>
body{font:14px system-ui;margin:24px;background:#f4f4f5;color:#18181b}
.row{display:grid;grid-template-columns:3fr 1fr;gap:16px;margin:0 0 40px;align-items:start}
img{width:100%;border:1px solid #d4d4d8;background:#fff}
h2{font-size:15px;margin:0 0 8px}
</style>
<h1>Demo screens — ${escape(runName)}</h1>
${shots
  .map(
    (s) => `<h2>${escape(s.business.provider.name)} · ${escape(s.business.provider.category)} · ${escape(s.business.provider.city)}</h2>
<div class="row"><a href="${s.desktop}"><img src="${s.desktop}" loading="lazy"></a><a href="${s.mobile}"><img src="${s.mobile}" loading="lazy"></a></div>`,
  )
  .join("\n")}`,
  "utf8",
);

console.log(`\nwrote ${shots.length * 2} screenshots and ${join(outDir, "index.html")}`);
