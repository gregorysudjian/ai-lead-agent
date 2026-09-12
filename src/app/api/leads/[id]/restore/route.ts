import { requireApiSession } from "@/server/auth";
import { restoreLead } from "@/server/catalog-service";

/**
 * POST /api/leads/[id]/restore
 *
 * Puts a removed lead back on the operator's list. No body: the only thing
 * this can do is undo a removal. A removal itself is not exposed here -- it is
 * made by the Google Maps check, run by hand (scripts/catalog-google-check.mts).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  try {
    const restored = await restoreLead(id);
    if (!restored) return Response.json({ error: "Lead not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`[POST /api/leads/${id}/restore] failed:`, error);
    return Response.json({ error: "Could not restore the lead." }, { status: 500 });
  }
}
