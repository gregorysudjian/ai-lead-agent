import { z } from "zod";

import { discoverAndSaveLeads } from "@/server/discovery";

/**
 * POST /api/search
 *
 * Body: { "category": string, "city": string }
 *
 * Runs a business-discovery search and persists what it finds as leads.
 *
 * The handler stays a thin HTTP shell: it validates input, delegates to the
 * discovery service, and serializes the result. It never touches fixture data
 * or the lead store directly, so swapping either implementation leaves this
 * file untouched.
 *
 * Route Handlers run exclusively on the server, which is what allows provider
 * credentials to stay out of the browser bundle.
 */

const searchRequestSchema = z.strictObject({
  category: z.string().trim().min(1, "category is required").max(100),
  city: z.string().trim().min(1, "city is required").max(100),
});

/** Shape returned for any rejected request. Never contains internal detail. */
function errorResponse(
  message: string,
  status: number,
  issues?: { field: string; message: string }[],
) {
  return Response.json({ error: message, ...(issues ? { issues } : {}) }, { status });
}

export async function POST(request: Request): Promise<Response> {
  // A malformed body is a client error, not a crash.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parsed = searchRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    // Safe to return: these describe the caller's own input, not our internals.
    const issues = parsed.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(body)",
      message: issue.message,
    }));
    return errorResponse("Invalid request body.", 400, issues);
  }

  const query = parsed.data;

  try {
    const { results, saved } = await discoverAndSaveLeads(query);

    // An empty result set is a successful search, not an error.
    return Response.json({
      query,
      count: results.length,
      saved,
      results,
    });
  } catch (error) {
    // Log the detail server-side; return something deliberately vague. Provider
    // and repository errors can carry API keys, quota data and filesystem paths.
    // Persistence failures land here too: we never report success for a search
    // whose results were not stored.
    console.error("[POST /api/search] discovery failed:", error);
    return errorResponse("Search failed. Please try again.", 500);
  }
}
