import { z } from "zod";

import { requireApiSession } from "@/server/auth";
import {
  AnalysisNotFoundError,
  LeadNotFoundError,
  generateDemoSiteForLead,
} from "@/server/demo-service";
import { AnalysisProviderError } from "@/server/analysis";
import { DemoSiteProviderError } from "@/server/demo";
import { enforceRateLimit } from "@/server/rate-limit";

/**
 * POST /api/demos
 *
 * Body: { "leadId": string }
 *
 * The one-click path: pick a business, get a website. It analyses the lead
 * first when it has no analysis, then generates the demo.
 *
 * Distinct from POST /api/leads/[id]/demo, which generates from ONE named
 * analysis and is what the lead page uses. That route stays the precise tool;
 * this one is the convenient one. Both go through the same service, so neither
 * can produce a demo the other could not.
 *
 * The body carries a lead id and nothing else. Business facts, recommendations
 * and page content are all loaded or derived server-side, so a browser cannot
 * inject a "fact" into a stored demo.
 */

const requestSchema = z.strictObject({
  leadId: z.string().trim().min(1, "leadId is required").max(200),
});

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  // Counted against the demo allowance: this path can run an analysis AND a
  // generation, so it is never cheaper than the route it wraps.
  const limited = enforceRateLimit("demo", guard.session.sub);
  if (limited) return limited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse("Invalid request body.", 400);
  }

  const { leadId } = parsed.data;

  try {
    const demo = await generateDemoSiteForLead(leadId);
    return Response.json({ demo }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadNotFoundError) {
      return errorResponse("Lead not found.", 404);
    }

    // The lead could not be analysed, so there is nothing to build a demo on.
    if (error instanceof AnalysisNotFoundError) {
      return errorResponse("This business could not be analysed.", 422);
    }

    // A generator failed. Reported as a dependency failure rather than
    // pretending a demo was produced; nothing partial is ever stored.
    if (error instanceof AnalysisProviderError || error instanceof DemoSiteProviderError) {
      console.error("[POST /api/demos] generation failed:", error.message);
      return errorResponse("Could not generate a website for this business.", 502);
    }

    // Anything else: log the detail, return something deliberately vague.
    // Provider and repository errors can carry keys, quota data and paths.
    console.error("[POST /api/demos] failed:", error);
    return errorResponse("Could not generate a website. Please try again.", 500);
  }
}
