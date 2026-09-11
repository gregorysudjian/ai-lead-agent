import { z } from "zod";

import { addBusinessToLeads } from "@/server/catalog-service";
import { requireApiSession } from "@/server/auth";

/**
 * POST /api/businesses/[id]/lead -- make one catalog business a lead.
 *
 * The only way a lead is created from search. One business per request and
 * no body at all: the business id in the path is the whole input, so a client
 * cannot supply the business's details and have them stored as a lead.
 *
 * Idempotent. A second request for the same business returns the same lead
 * with `created: false`, which is what the button shows as "In your leads".
 */

const params = z.object({ id: z.uuid() });

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const parsed = params.safeParse(await context.params);
  if (!parsed.success) return errorResponse("Business not found.", 404);
  const { id } = parsed.data;

  try {
    const result = await addBusinessToLeads(id);
    if (result.status === "not-found") return errorResponse("Business not found.", 404);
    return Response.json(
      { leadId: result.leadId, created: result.status === "added" },
      { status: result.status === "added" ? 201 : 200 },
    );
  } catch (error) {
    // Repository errors can carry driver messages. Log them; say nothing.
    console.error(`[POST /api/businesses/${id}/lead] could not add to leads:`, error);
    return errorResponse("Could not add this business to your leads. Please try again.", 500);
  }
}
