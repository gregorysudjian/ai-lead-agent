import { ResearchProviderError } from "@/server/research";
import { LeadNotFoundError, profilesForLead, researchLead } from "@/server/research-service";
import { BusinessProfileRepositoryError } from "@/server/repo";

/**
 * POST /api/leads/[id]/research  -- run one research pass and persist it
 * GET  /api/leads/[id]/research  -- list profiles for the lead, newest first
 *
 * The request body is ignored on POST. Every fact recorded comes from the
 * stored lead or from a source the researcher itself consulted and cited, so a
 * client cannot inject a "fact" into the evidence record. The lead id in the
 * path is the only input.
 *
 * One request researches one lead. There is no bulk endpoint, and nothing runs
 * on a schedule -- a research pass will eventually make outbound requests to a
 * real business's website, and that must always be someone's deliberate act.
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
    const profile = await researchLead(id);
    return Response.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadNotFoundError) {
      return errorResponse("Lead not found.", 404);
    }

    if (error instanceof ResearchProviderError) {
      console.error(`[POST /api/leads/${id}/research] researcher failed:`, error.message);
      return errorResponse("Could not research this business. Please try again.", 502);
    }

    if (error instanceof BusinessProfileRepositoryError) {
      console.error(`[POST /api/leads/${id}/research] persistence failed:`, error.message);
      return errorResponse("The business profile could not be saved. Please try again.", 500);
    }

    // Invalid researcher output lands here (the repository throws on
    // validation), as does anything unexpected. Log the detail, return
    // something generic -- no database or upstream message reaches the browser.
    console.error(`[POST /api/leads/${id}/research] research failed:`, error);
    return errorResponse("Could not research this business. Please try again.", 500);
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  try {
    const profiles = await profilesForLead(id);
    return Response.json({ count: profiles.length, profiles });
  } catch (error) {
    console.error(`[GET /api/leads/${id}/research] could not read profiles:`, error);
    return errorResponse("Could not load business profiles.", 500);
  }
}
