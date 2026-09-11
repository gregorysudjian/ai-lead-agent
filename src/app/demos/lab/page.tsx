import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoSiteView } from "@/components/demo/demo-site-view";
import { DEMO_FONT_VARIABLES } from "@/components/demo/fonts";
import { sampleSectionLabels } from "@/lib/demo-sample-policy";
import { requireSession } from "@/server/auth";
import { labDemoForBusiness } from "@/server/demo-lab";

/**
 * The demo lab: the website generation would produce for one catalog
 * business, rendered in memory and saved nowhere.
 *
 * Chromeless like the stored preview (`isChromeless` matches `/demos/<one
 * segment>`), so the page reads as the proposed site. The dark bar at the top
 * is ours and says plainly that this is a lab rendering, not a stored demo.
 *
 * Requires a session like every page but `/s/`: it names a real business and
 * shows copy written about it.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Demo lab" };

export default async function DemoLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const params = await searchParams;
  const businessId = typeof params.business === "string" ? params.business : null;
  if (businessId === null || !/^[0-9a-f-]{36}$/i.test(businessId)) notFound();

  const lab = await labDemoForBusiness(businessId);
  if (lab === null) notFound();

  const { business, spec } = lab;
  const samples = sampleSectionLabels(spec.content);

  return (
    <div className={DEMO_FONT_VARIABLES}>
      <div className="border-b border-slate-800 bg-slate-900 text-slate-300">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 text-xs sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded bg-sky-400 px-1.5 py-0.5 font-semibold tracking-wide text-slate-900 uppercase">
              Lab preview · not saved
            </span>
            <span className="truncate font-medium text-slate-100">{business.provider.name}</span>
            <span className="text-slate-400">
              {business.provider.category} · {business.provider.city}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link
              href="/businesses"
              className="rounded border border-slate-700 px-2.5 py-1 font-medium text-slate-200 hover:bg-slate-800"
            >
              ← Businesses
            </Link>
          </div>
        </div>
        {samples.length > 0 ? (
          <p className="mx-auto w-full max-w-7xl px-4 pb-3 text-[11px] leading-relaxed text-amber-300/90 sm:px-6">
            <span className="font-semibold">Sample content:</span> {samples.join(", ")}. Written from
            what is typical for the trade, not from anything we know about this business.
          </p>
        ) : null}
      </div>

      <DemoSiteView spec={spec} />
    </div>
  );
}
