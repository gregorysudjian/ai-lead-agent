import { z } from "zod";

import { DemoSiteProviderError } from "@/server/demo";
import {
  AnalysisLeadMismatchError,
  AnalysisNotFoundError,
  demoSitesForLead,
  generateDemoSite,
  LeadNotFoundError,
} from "@/server/demo-service";
import { DemoSiteRepositoryError } from "@/server/repo";
import { requireApiSession } from "@/server/auth";
import { enforceRateLimit } from "@/server/rate-limit";

/**
 * POST /api/leads/[id]/demo  -- generate a demo site and persist it
 * GET  /api/leads/[id]/demo  -- list demo sites for the lead, newest first
 *
 * The body carries at most ONE value: which stored analysis to build from. The
 * lead, the analysis and every business fact are loaded server-side from the
 * database, so a client cannot supply a spec, a business name or a contact
 * detail for us to store and later show to a prospect.
 *
 * Nothing here is triggered automatically. One request generates exactly one
 * demo site, and only in response to a person clicking the button.
 */

/**
 * `analysisId` is optional; omitting it means "the lead's latest analysis".
 * `strictObject` rejects any other key outright rather than ignoring it, so an
 * attempt to smuggle a spec or a business fact fails loudly rather than
 * silently doing nothing.
 */
const bodySchema = z.strictObject({
  analysisId: z.uuid().optional(),
});

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const limited = enforceRateLimit("demo", guard.session.sub);
  if (limited) return limited;

  const { id } = await context.params;

  // An empty body is valid and means "use the latest analysis".
  const raw: unknown = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return errorResponse("Invalid request.", 400);
  }

  try {
    const demoSite = await generateDemoSite(id, parsed.data.analysisId);
    return Response.json({ demoSite }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadNotFoundError) {
      return errorResponse("Lead not found.", 404);
    }

    if (error instanceof AnalysisNotFoundError) {
      return errorResponse("Analyse this lead before generating a demo site.", 409);
    }

    if (error instanceof AnalysisLeadMismatchError) {
      // Logged as a mismatch because it is the shape a deliberate attempt to
      // graft another business's analysis onto this lead would take.
      console.error(`[POST /api/leads/${id}/demo] analysis/lead mismatch:`, error.message);
      return errorResponse("That analysis does not belong to this lead.", 409);
    }

    if (error instanceof DemoSiteProviderError) {
      console.error(`[POST /api/leads/${id}/demo] generator failed:`, error.message);
      return errorResponse("Could not generate a demo site. Please try again.", 502);
    }

    if (error instanceof DemoSiteRepositoryError) {
      console.error(`[POST /api/leads/${id}/demo] persistence failed:`, error.message);
      return errorResponse("The demo site could not be saved. Please try again.", 500);
    }

    // Invalid generator output lands here (the repository throws on
    // validation), as does anything unexpected. Log the detail, return
    // something generic -- no database or provider message reaches the browser.
    console.error(`[POST /api/leads/${id}/demo] generation failed:`, error);
    return errorResponse("Could not generate a demo site. Please try again.", 500);
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  try {
    const demoSites = await demoSitesForLead(id);
    return Response.json({ count: demoSites.length, demoSites });
  } catch (error) {
    console.error(`[GET /api/leads/${id}/demo] could not read demo sites:`, error);
    return errorResponse("Could not load demo sites.", 500);
  }
}
