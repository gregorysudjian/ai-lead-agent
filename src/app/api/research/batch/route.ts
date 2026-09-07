import { z } from "zod";

import { MAX_BATCH_SIZE, researchLeadsWithoutProfiles } from "@/server/research-service";

/**
 * POST /api/research/batch -- research up to N leads that have no profile yet
 *
 * One request is one bounded, sequential run. There is no scheduler, nothing
 * calls this on a timer, and the cap is small on purpose: each lead means
 * fetching a real business's homepage, and possibly one billable directory
 * lookup to find its address.
 *
 * Leads that already have a profile are skipped, so re-running is cheap and is
 * not a way to re-fetch the same sites over and over.
 */

const batchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(MAX_BATCH_SIZE).optional(),
});

export async function POST(request: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    // An empty body is a valid request for the default batch size.
    rawBody = {};
  }

  const parsed = batchRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      {
        error: `Invalid request body. limit must be an integer between 1 and ${MAX_BATCH_SIZE}.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await researchLeadsWithoutProfiles(parsed.data.limit ?? 10);
    return Response.json(result);
  } catch (error) {
    console.error("[POST /api/research/batch] batch failed:", error);
    return Response.json({ error: "The research batch failed." }, { status: 500 });
  }
}
