import { getLeadRepository } from "@/server/repo";

/**
 * GET /api/leads
 *
 * Returns every stored lead. Phase 2 keeps this deliberately dumb -- no
 * pagination, filtering or sorting. It exists to verify that persistence works,
 * and will later back the dashboard.
 *
 * `force-dynamic` because this route reads a data store. Without it Next can
 * prerender a GET handler at build time, which would both bake a stale response
 * into the build and touch the lead store during `next build`.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const leads = await getLeadRepository().list();
    return Response.json({ count: leads.length, leads });
  } catch (error) {
    // Repository errors mention filesystem paths -- log them, never return them.
    console.error("[GET /api/leads] could not read lead store:", error);
    return Response.json({ error: "Could not load leads." }, { status: 500 });
  }
}
