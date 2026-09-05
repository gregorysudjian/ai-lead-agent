import { z } from "zod";

import { getPlacesProvider } from "@/server/places";

/**
 * POST /api/search
 *
 * Body: { "category": string, "city": string }
 *
 * Runs a business-discovery search through the configured PlacesProvider. This
 * handler never touches fixture data directly -- it depends only on the
 * provider interface, so Phase 5 can swap in Google Places without editing this
 * file.
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
    const provider = getPlacesProvider();
    const results = await provider.search(query);

    // An empty result set is a successful search, not an error.
    return Response.json({
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    // Log the detail server-side; return something deliberately vague. Provider
    // errors can carry API keys, quota data and stack traces.
    console.error("[POST /api/search] provider search failed:", error);
    return errorResponse("Search failed. Please try again.", 500);
  }
}
