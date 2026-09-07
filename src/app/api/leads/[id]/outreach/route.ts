import { z } from "zod";

import { draftOutreach, LeadNotFoundError, outreachForLead } from "@/server/outreach-service";
import { OutreachRepositoryError } from "@/server/repo";

/**
 * GET  /api/leads/[id]/outreach  -- contact sheet plus every record for a lead
 * POST /api/leads/[id]/outreach  -- write a draft for one channel
 *
 * A POST creates a DRAFT. It does not send anything: this application has no
 * transport, no queue and no delivery path of any kind. The response is words
 * for a human to read, edit and act on themselves.
 *
 * The body carries a channel and, optionally, the human's own wording. It can
 * never carry facts about the business -- everything a draft asserts is read
 * server-side from the stored lead and its research profile.
 */

const draftRequestSchema = z.strictObject({
  channel: z.enum(["phone", "email", "social", "in-person"]),
  // A person writing their own opening is the point; it is still bounded.
  body: z.string().trim().min(1).max(8000).optional(),
  subject: z.string().trim().min(1).max(300).nullable().optional(),
});

function errorResponse(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...(extra ?? {}) }, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  try {
    const view = await outreachForLead(id);
    return Response.json(view);
  } catch (error) {
    if (error instanceof LeadNotFoundError) return errorResponse("Lead not found.", 404);

    console.error(`[GET /api/leads/${id}/outreach] failed:`, error);
    return errorResponse("Could not load outreach for this lead.", 500);
  }
}

export async function POST(
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

  const parsed = draftRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(body)",
      message: issue.message,
    }));
    return errorResponse("Invalid request body.", 400, { issues });
  }

  try {
    const record = await draftOutreach(id, parsed.data.channel, {
      body: parsed.data.body,
      subject: parsed.data.subject,
    });
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadNotFoundError) return errorResponse("Lead not found.", 404);

    if (error instanceof OutreachRepositoryError) {
      console.error(`[POST /api/leads/${id}/outreach] persistence failed:`, error.message);
      return errorResponse("The draft could not be saved. Please try again.", 500);
    }

    console.error(`[POST /api/leads/${id}/outreach] draft failed:`, error);
    return errorResponse("Could not write a draft. Please try again.", 500);
  }
}
