import Link from "next/link";

import { PageHeader } from "@/components/ui/primitives";
import { CATALOG_TRADES, catalogTradeByKey, catalogTradeForLabel } from "@/lib/catalog/trades";
import type { CatalogBusiness } from "@/lib/catalog/types";
import { designFor } from "@/lib/demo-design/genome";
import { requireSession } from "@/server/auth";
import { getCatalogRepository } from "@/server/repo";

/**
 * Twelve lab sites side by side: the fastest way to see whether the generator
 * really gives every business its own site, or twelve recolours of one.
 *
 * Each tile is the real lab page in an iframe, scaled down, so what is shown
 * is exactly what a business would see -- nothing is re-rendered specially for
 * the grid. Like the lab itself it writes nothing and calls nothing paid.
 *
 * `?trade=` narrows to one trade (a closed set of keys); `?page=` moves
 * through the catalog in a fixed shuffled order, so page 3 is always page 3.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Demo lab grid" };

const PER_PAGE = 12;

type Params = Record<string, string | string[] | undefined>;

/** FNV-1a; a stable shuffle key, so the grid does not reorder between visits. */
function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function gridHref(trade: string | null, page: number): string {
  const query = new URLSearchParams();
  if (trade) query.set("trade", trade);
  if (page > 0) query.set("page", String(page));
  const text = query.toString();
  return text ? `/demos/lab/grid?${text}` : "/demos/lab/grid";
}

export default async function DemoLabGridPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireSession();

  const params = await searchParams;
  const tradeParam = typeof params.trade === "string" ? params.trade : null;
  const trade = tradeParam ? catalogTradeByKey(tradeParam) : null;
  const rawPage = Number.parseInt(typeof params.page === "string" ? params.page : "0", 10);
  const page = Number.isInteger(rawPage) && rawPage >= 0 && rawPage < 1000 ? rawPage : 0;

  const all = await getCatalogRepository().listAll();
  const newest = all.reduce((max, b) => (b.lastSeenRelease > max ? b.lastSeenRelease : max), "");
  const pool = all
    .filter((b) => b.lastSeenRelease === newest)
    .filter((b) => trade === null || catalogTradeForLabel(b.provider.category)?.key === trade.key)
    .sort((a, b) => stableHash(a.id) - stableHash(b.id));
  const pages = Math.max(1, Math.ceil(pool.length / PER_PAGE));
  const shown: CatalogBusiness[] = pool.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  const chip = "rounded-full border px-3 py-1 text-xs font-medium";
  const chipOn = "border-slate-900 bg-slate-900 text-white";
  const chipOff = "border-slate-300 text-slate-700 hover:bg-slate-100";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo lab grid"
        subtitle="Twelve catalog businesses, each rendered with its own generated design. Nothing here is saved."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link href={gridHref(null, 0)} className={`${chip} ${trade === null ? chipOn : chipOff}`}>
          All trades
        </Link>
        {CATALOG_TRADES.map((t) => (
          <Link key={t.key} href={gridHref(t.key, 0)} className={`${chip} ${trade?.key === t.key ? chipOn : chipOff}`}>
            {t.label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          Page {page + 1} of {pages} · {pool.length} businesses
        </span>
        {page > 0 ? (
          <Link href={gridHref(trade?.key ?? null, page - 1)} className={`${chip} ${chipOff}`}>
            ← Previous
          </Link>
        ) : null}
        {page + 1 < pages ? (
          <Link href={gridHref(trade?.key ?? null, page + 1)} className={`${chip} ${chipOff}`}>
            Next →
          </Link>
        ) : null}
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((business) => {
          const design = designFor({
            name: business.provider.name,
            category: business.provider.category,
            address: business.provider.address,
          });
          const href = `/demos/lab?business=${business.id}`;
          return (
            <li key={business.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {/* The page drawn four times the tile's size, then shrunk to a
                  quarter: a desktop-width render in a small tile. The frame is
                  inert (no pointer events); the link below opens the page. */}
              <div className="relative aspect-[1440/1100] overflow-hidden bg-slate-100">
                <iframe
                  src={href}
                  title={`Lab preview of ${business.provider.name}`}
                  loading="lazy"
                  tabIndex={-1}
                  className="pointer-events-none absolute top-0 left-0 h-[400%] w-[400%] origin-top-left scale-25 border-0"
                />
              </div>
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{business.provider.name}</p>
                  <p className="truncate font-mono text-[11px] text-slate-500">
                    {design.direction} · {design.hero} · {design.fonts.display}
                  </p>
                </div>
                <Link href={href} className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Open
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
