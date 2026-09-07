import { z } from "zod";

import { markSent, updateOutreach } from "@/server/outreach-service";
import { OutreachRepositoryError } from "@/server/repo";

/**
 * PATCH /api/outreach/[id] -- a human's changes to one outreach record
 *
 * Status, wording and the outcome note. Setting status to "sent" records that a
 * PERSON sent it: the server does not deliver anything, and `sentAt` is stamped
 * at the moment the person says so rather than inferred from anything the
 * system did.
 */

const patchSchema = z
  .strictObject({
    status: z.enum(["draft", "approved", "sent", "replied", "closed"]).optional(),
    subject: z.string().trim().min(1).max(300).nullable().optional(),
    body: z.string().trim().min(1).max(8000).optional(),
    outcome: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field is required",
  });

function errorResponse(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...(extra ?? {}) }, { status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(body)",
      message: issue.message,
    }));
    return errorResponse("Invalid request body.", 400, { issues });
  }

  try {
    // "Sent" goes through its own operation, because it is the one change that
    // asserts something happened in the world.
    const record =
      parsed.data.status === "sent"
        ? await markSent(id, new Date().toISOString())
        : await updateOutreach(id, parsed.data);

    if (!record) return errorResponse("Outreach record not found.", 404);
    return Response.json({ record });
  } catch (error) {
    if (error instanceof OutreachRepositoryError) {
      console.error(`[PATCH /api/outreach/${id}] persistence failed:`, error.message);
      return errorResponse("The change could not be saved. Please try again.", 500);
    }

    console.error(`[PATCH /api/outreach/${id}] update failed:`, error);
    return errorResponse("Could not update the outreach record.", 500);
  }
}
