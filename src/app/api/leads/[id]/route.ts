import { z } from "zod";

import { getLeadRepository } from "@/server/repo";
import { requireApiSession } from "@/server/auth";

/**
 * PATCH /api/leads/[id]
 *
 * Body: { "status": "new" | "reviewed" }
 *
 * Status is the ONLY editable field on a lead. The schema is strict and lists
 * status explicitly, so a request carrying `provider`, `id` or `createdAt` is
 * rejected outright rather than partially applied -- the endpoint cannot be
 * used to rewrite provider data or an internal id.
 */

const updateLeadSchema = z.strictObject({
  status: z.enum(["new", "reviewed"]),
});

export async function PATCH(
  request: Request,
  // Next 16 passes route params as a Promise.
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = updateLeadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request body.",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(body)",
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const lead = await getLeadRepository().updateStatus(id, parsed.data.status);

    // A missing lead is a normal outcome, not a failure.
    if (!lead) {
      return Response.json({ error: "Lead not found." }, { status: 404 });
    }

    return Response.json({ lead });
  } catch (error) {
    // Repository errors mention filesystem paths -- log, never return.
    console.error(`[PATCH /api/leads/${id}] status update failed:`, error);
    return Response.json({ error: "Could not update lead." }, { status: 500 });
  }
}
