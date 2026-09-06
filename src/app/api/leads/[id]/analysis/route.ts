import { AnalysisProviderError } from "@/server/analysis";
import { analyseLead, analysesForLead, LeadNotFoundError } from "@/server/analysis-service";
import { AnalysisRepositoryError } from "@/server/repo";

/**
 * POST /api/leads/[id]/analysis  -- run an analysis and persist it
 * GET  /api/leads/[id]/analysis  -- list analyses for the lead, newest first
 *
 * The request body is ignored on POST: the analysed facts come from the stored
 * lead snapshot, so a client cannot inject business "facts" for the analyser to
 * reason from. The lead id in the path is the only input.
 */

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  try {
    const analysis = await analyseLead(id);
    return Response.json({ analysis }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadNotFoundError) {
      return errorResponse("Lead not found.", 404);
    }

    // The analyser failed or returned something unusable. Report it as a
    // dependency failure; nothing was stored.
    if (error instanceof AnalysisProviderError) {
      console.error(`[POST /api/leads/${id}/analysis] provider failed:`, error.message);
      return errorResponse("Could not analyse this lead. Please try again.", 502);
    }

    if (error instanceof AnalysisRepositoryError) {
      console.error(`[POST /api/leads/${id}/analysis] persistence failed:`, error.message);
      return errorResponse("The analysis could not be saved. Please try again.", 500);
    }

    // Invalid provider output lands here (the repository throws on validation),
    // as does anything unexpected. Log the detail, return something generic.
    console.error(`[POST /api/leads/${id}/analysis] analysis failed:`, error);
    return errorResponse("Could not analyse this lead. Please try again.", 500);
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  try {
    const analyses = await analysesForLead(id);
    return Response.json({ count: analyses.length, analyses });
  } catch (error) {
    console.error(`[GET /api/leads/${id}/analysis] could not read analyses:`, error);
    return errorResponse("Could not load analyses.", 500);
  }
}
