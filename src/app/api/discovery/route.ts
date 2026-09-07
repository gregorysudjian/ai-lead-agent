import { z } from "zod";

import { discoverCandidates } from "@/server/discovery-service";
import { DiscoveryFailedError, DiscoveryValidationError } from "@/server/discovery";
import { LeadRepositoryError } from "@/server/repo";

/**
 * POST /api/discovery
 *
 * Body: { "city": string, "category": string, "sources"?: string[] }
 *
 * Runs one multi-source discovery pass and returns transient candidates plus a
 * per-source status. It PERSISTS NOTHING -- no lead is created, refreshed or
 * touched. Saving OpenStreetMap results remains POST /api/search.
 *
 * One request is one bounded run. There is no bulk endpoint, no pagination
 * parameter and nothing scheduled: a run can reach a billable API and community
 * infrastructure, so it must always be someone's deliberate act.
 *
 * What the browser sends is a city, a category and optionally a subset of the
 * sources this server has enabled. Everything else -- which sources exist,
 * credentials, provider calls, normalization, grouping, the lead lookup -- stays
 * on this side of the boundary, and no configuration is echoed back beyond the
 * NAMES of enabled sources.
 */

const discoveryRequestSchema = z.strictObject({
  city: z.string().trim().min(1, "city is required").max(100),
  category: z.string().trim().min(1, "category is required").max(100),
  // Bounded: the enabled set is tiny, and an unbounded array is free work.
  sources: z.array(z.string().trim().min(1).max(30)).min(1).max(10).optional(),
});

function errorResponse(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return Response.json({ error: message, ...(extra ?? {}) }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parsed = discoveryRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    // Safe to return: these describe the caller's own input, not our internals.
    const issues = parsed.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(body)",
      message: issue.message,
    }));
    return errorResponse("Invalid request body.", 400, { issues });
  }

  try {
    const result = await discoverCandidates(parsed.data);

    return Response.json({
      query: result.query,
      availableSources: result.availableSources,
      requestedSources: result.requestedSources,
      // Per-source outcome, always present. A failed source appears here as a
      // failure and never as a source that happened to return nothing.
      sources: result.statuses,
      truncated: result.truncated,
      count: result.candidates.length,
      candidates: result.candidates,
    });
  } catch (error) {
    // The caller asked for a city, category or source we do not support. Safe
    // to echo: the message names only our own supported values.
    if (error instanceof DiscoveryValidationError) {
      return Response.json(
        { error: error.message, supported: error.supported },
        { status: 400 },
      );
    }

    // Every source failed. Report it as a dependency failure and hand back the
    // per-source statuses, so the UI can say WHICH failed rather than implying
    // the city is empty.
    if (error instanceof DiscoveryFailedError) {
      console.error("[POST /api/discovery] all sources failed");
      return errorResponse(
        "No discovery source could be reached. Try again shortly.",
        503,
        { sources: error.statuses },
      );
    }

    if (error instanceof LeadRepositoryError) {
      console.error("[POST /api/discovery] lead store failed:", error.message);
      return errorResponse("Could not read stored leads. Please try again.", 500);
    }

    // Anything else: log the detail, return something deliberately vague.
    // Provider and configuration errors can carry keys, quota data and paths.
    console.error("[POST /api/discovery] discovery failed:", error);
    return errorResponse("Discovery failed. Please try again.", 500);
  }
}
