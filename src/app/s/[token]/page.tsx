import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DEMO_FONT_VARIABLES } from "@/components/demo/fonts";
import { demoLocale, RenderedDemo } from "@/components/demo/rendered-demo";
import { contentFor } from "@/lib/demo-site";
import type { Locale } from "@/lib/locale";
import { sampleSectionLabels } from "@/lib/demo-sample-policy";
import { clientIdentity, enforceRateLimit } from "@/server/rate-limit";
import { resolveSharedDemo } from "@/server/share-service";
import { headers } from "next/headers";

/**
 * A demo site, shown to the business it was made for.
 *
 * ── THE ONLY PUBLIC PAGE IN THE APPLICATION ───────────────────────────────
 *
 * Everything else requires a session. This route is listed in `PUBLIC_PREFIXES`
 * in `proxy.ts` and in the allow-list in `auth-coverage.test.ts`, and it
 * deliberately calls no session guard. Its access control is the token: 32
 * random bytes issued by the operator, with an expiry and a revoke.
 *
 * Unknown, expired and revoked tokens all render the SAME 404. A distinct
 * "this link has expired" would confirm to a stranger holding a guess that the
 * token was once real.
 *
 * ── WHAT THIS PAGE MAY NOT LEAK ───────────────────────────────────────────
 *
 * The internal preview at `/demos/[id]` carries operator chrome -- the lead it
 * belongs to, which analysis shaped it, which generator and model wrote it,
 * links back into the dashboard. None of that appears here. The recipient sees
 * the proposed website and an honest note about what it is, and nothing about
 * how we found them or what we recorded.
 *
 * ── WHAT IT MUST STILL SAY ────────────────────────────────────────────────
 *
 * The sample-content marks stay. This is the one place a business owner
 * actually sees them, so removing them to make the page look finished would
 * invert the entire point of marking anything: they exist to be read by the
 * person who can tell us which parts are wrong.
 */

export const dynamic = "force-dynamic";

/**
 * Deliberately generic, and never the business's name.
 *
 * A title is the one part of a page that leaks into a browser history, a
 * shared screenshot and a link preview. Naming the business there would
 * broadcast that we hold a record of them to anyone glancing at the tab.
 */
export const metadata: Metadata = {
  title: { absolute: "Proposition de site web · Website proposal" },
  // Not that it should be reachable, but a draft proposal for someone else's
  // business has no business in an index.
  robots: { index: false, follow: false },
};

/**
 * Our own bar, in the page's language.
 *
 * Written here rather than generated, like everything in the bar. The French
 * is the same disclosure, not a softer one: that this is a draft, that the
 * business did not make or approve it, that nothing is published, and which
 * sections are placeholders for them to correct.
 */
const BAR: Record<
  Locale,
  { badge: string; what: (name: string) => string; samples: (list: string, category: string) => string }
> = {
  en: {
    badge: "Draft proposal",
    what: (name) =>
      `This is a draft website put together for ${name}. It is a proposal, not a live website, and it was not made by or with the business. Nothing on it has been published.`,
    samples: (list, category) =>
      `Sections marked \u201csample content\u201d (${list}) are placeholders showing what the finished page would say. They are written from what is typical for a ${category.toLowerCase()}, not from anything we know about this business, and every line of them is yours to correct.`,
  },
  fr: {
    badge: "Ébauche de proposition",
    what: (name) =>
      `Ceci est une ébauche de site web préparée pour ${name}. C’est une proposition, pas un site en ligne, et elle n’a été faite ni par l’entreprise ni avec elle. Rien n’y a été publié.`,
    samples: (list) =>
      `Les sections marquées «\u00a0contenu d’exemple\u00a0» (${list}) sont des textes provisoires qui montrent ce que dirait la page finale. Ils s’inspirent de ce qui est courant dans ce type de commerce, pas de ce qu’on sait de cette entreprise, et chaque ligne est à corriger par vous.`,
  },
};

export default async function SharedDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;

  // The only unauthenticated route that reads data, so it is the only one
  // where a limit is guarding against enumeration rather than protecting a
  // third party. Keyed by client address; see `clientIdentity` for why that
  // slows a script rather than stopping one.
  const limited = enforceRateLimit("sharedDemo", clientIdentity({ headers: await headers() }));
  if (limited) notFound();

  let demo;
  try {
    demo = await resolveSharedDemo(token);
  } catch (error) {
    // Never surface the reason: it distinguishes "no such token" from "the
    // store is down", which is a detail a stranger does not need.
    console.error("[shared demo] could not resolve a share token:", error);
    notFound();
  }

  if (!demo) notFound();

  const { business } = demo.spec;
  const locale = demoLocale(demo.spec, lang);
  const bar = BAR[locale];
  // Listed by the headings the recipient actually sees, in their language.
  const sampleSections = sampleSectionLabels(contentFor(demo.spec, locale));

  return (
    <div className={DEMO_FONT_VARIABLES}>
      {/* ---- Our own bar. Never generated, and never operator chrome. ----- */}
      <div className="border-b border-slate-800 bg-slate-900 text-slate-300">
        <div className="mx-auto w-full max-w-6xl px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-slate-900 uppercase">
              {bar.badge}
            </span>
            <span className="text-sm font-medium text-slate-100">{business.name}</span>
          </div>

          {/* Said plainly, because the recipient did not ask for this. An
              unsolicited mock-up that does not say what it is reads as a
              claim to represent the business. */}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{bar.what(business.name)}</p>

          {sampleSections.length > 0 ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-300/90">
              {bar.samples(sampleSections.join(", "), business.category)}
            </p>
          ) : null}
        </div>
      </div>

      {/* ---- The proposed website ---------------------------------------- */}
      <RenderedDemo spec={demo.spec} locale={locale} basePath={`/s/${token}`} />
    </div>
  );
}
