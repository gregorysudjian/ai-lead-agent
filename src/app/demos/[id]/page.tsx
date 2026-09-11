import Link from "next/link";
import { notFound } from "next/navigation";

import { OsmAttribution, OvertureAttribution } from "@/components/attribution";
import { DEMO_FONT_VARIABLES } from "@/components/demo/fonts";
import { demoLocale, RenderedDemo } from "@/components/demo/rendered-demo";
import { SharePanel } from "@/components/demo/share-panel";
import { DIRECTIONS } from "@/lib/demo-design/directions";
import { DEMO_THEME_LABELS } from "@/lib/demo-site";
import { sampleSectionLabels } from "@/lib/demo-sample-policy";
import { Timestamp } from "@/components/ui/timestamp";
import { requireSession } from "@/server/auth";
import { sharesForDemo } from "@/server/share-service";
import { getDemoSiteRepository } from "@/server/repo";

/**
 * Internal preview of one generated demo site.
 *
 * NOT a public URL, and now enforced rather than asserted. This page requires
 * a session like every other page in the dashboard: the id is a UUID, but an
 * unguessable identifier is not an access control, and this preview carries a
 * named business plus copy written about it.
 *
 * That means there is currently no way to show a demo to the business it was
 * generated for. That is deliberate. Sharing a demo is a separate feature with
 * its own decisions -- a scoped share token, an expiry, a record of who it was
 * shown to -- and inheriting it by accident from "the URL is hard to guess" is
 * not the same thing.
 *
 * The dashboard chrome is deliberately absent (see `isChromeless` in
 * AppShell) so the preview reads as the proposed customer website rather than
 * as an admin screen. The one piece of our own UI is the bar at the top, which
 * states plainly what this is and links back to the lead.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Guarded too: metadata renders the business name into the document title,
  // which is a real disclosure even when the body below never renders.
  await requireSession();
  try {
    const demo = await getDemoSiteRepository().findById(id);
    // `absolute` so the tab reads as the proposed site rather than carrying
    // the dashboard's " | Lead Finder" suffix onto a customer-facing mock.
    if (demo) return { title: { absolute: demo.spec.business.name } };
  } catch {
    // Fall through to the generic title; the page itself reports the failure.
  }
  return { title: "Demo site" };
}

export default async function DemoPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;

  // Authorization boundary. See `requireSession` in server/auth/dal.ts.
  await requireSession();

  let demo;
  try {
    demo = await getDemoSiteRepository().findById(id);
  } catch (error) {
    console.error(`[demo ${id}] could not read demo store:`, error);
    throw new Error("Could not load this demo site.");
  }

  if (!demo) notFound();

  const { business, content } = demo.spec;
  const locale = demoLocale(demo.spec, lang);

  // Recomputed at render time from the stored flags, which were themselves
  // recomputed from held facts when the demo was generated. The chrome is
  // where this disclosure belongs: a generator cannot reach it, and it
  // survives a screenshot that crops the inline tags.
  const sampleSections = sampleSectionLabels(content);

  // Read here, on the server, like every other page in this app -- never by
  // the panel fetching its own API. A share store failure must not take the
  // preview down with it: the demo is still viewable, there is just no way to
  // hand it out until the store comes back.
  let shares: Awaited<ReturnType<typeof sharesForDemo>> = [];
  try {
    shares = await sharesForDemo(demo.id);
  } catch (error) {
    console.error(`[demo ${id}] could not read share links:`, error);
  }

  return (
    // The font variables must resolve on an ancestor of the preview.
    <div className={DEMO_FONT_VARIABLES}>
      {/* ---- Application-owned admin bar. Never generated. ---------------- */}
      <div className="border-b border-slate-800 bg-slate-900 text-slate-300">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="rounded bg-amber-400 px-1.5 py-0.5 font-semibold tracking-wide text-slate-900 uppercase">
              Internal preview
            </span>
            <span className="truncate font-medium text-slate-100">{business.name}</span>
            <span className="text-slate-400">
              {demo.spec.design
                ? `${DIRECTIONS[demo.spec.design.direction].label} style, variant ${demo.spec.design.variant}`
                : DEMO_THEME_LABELS[content.theme]}{" "}
              · generated by {demo.generator.name} ({demo.generator.model}) on{" "}
              <Timestamp iso={demo.createdAt} />
              {demo.spec.alternates?.fr ? " · French and English" : " · English only"}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-4 text-xs">
            <Link
              href={`/leads/${demo.leadId}`}
              className="rounded border border-slate-700 px-2.5 py-1 font-medium text-slate-200 hover:bg-slate-800"
            >
              &larr; Back to lead
            </Link>
            <Link href="/demos" className="font-medium text-slate-300 underline underline-offset-2 hover:text-white">
              All demos
            </Link>
            <SharePanel demoId={demo.id} shares={shares} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-3 sm:px-6">
          {/* The honesty lives here, in our chrome, where a generator cannot
              reach it -- rather than being sprinkled through the mock copy. */}
          <p className="text-[11px] leading-relaxed text-slate-400">
            Draft proposal. Business name, phone and address are copied from the lead
            record. Nothing on this page was supplied or approved by the business.
            {business.websiteListed
              ? " The provider listed an existing website for this business."
              : " The provider listed no website for this business, which is not proof that none exists."}
          </p>

          {sampleSections.length > 0 ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-300/90">
              <span className="font-semibold">Sample content:</span>{" "}
              {sampleSections.join(", ")}. These sections show what the finished page
              would say, written from what is typical for a {business.category.toLowerCase()}{" "}
              rather than from anything we know about this business. Confirm every line
              with the owner before using it.
            </p>
          ) : null}
          {business.source === "osm" ? (
            <OsmAttribution tone="inverted" className="mt-1" />
          ) : null}
          {business.source === "overture" ? (
            <OvertureAttribution tone="inverted" className="mt-1" />
          ) : null}
        </div>
      </div>

      {/* ---- The proposed website ---------------------------------------- */}
      <RenderedDemo spec={demo.spec} locale={locale} basePath={`/demos/${demo.id}`} />
    </div>
  );
}
