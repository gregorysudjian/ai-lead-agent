import { z } from "zod";

import { DEFAULT_SHARE_DAYS, MAX_SHARE_DAYS, MIN_SHARE_DAYS, sharePath } from "@/lib/demo-share";
import { requireApiSession } from "@/server/auth";
import { DemoNotFoundError, revokeShare, shareDemo, sharesForDemo } from "@/server/share-service";

/**
 * POST   /api/demos/[id]/share   issue a link for this demo
 * GET    /api/demos/[id]/share   list the links issued for it
 * DELETE /api/demos/[id]/share   withdraw one, by share id
 *
 * The operator's side of sharing. All three require a session; the page a
 * recipient opens is `/s/[token]`, which is the only public route in the app.
 *
 * Sharing is always a deliberate act. There is no "share on generate", because
 * a link that appears without anyone deciding to create it is a link nobody
 * remembers to revoke.
 *
 * Note this does not send anything. It produces a URL for a human to pass on
 * by hand, exactly like an outreach draft -- hard rule 1 is untouched.
 */

const createSchema = z.strictObject({
  /** Omitted means the default. Clamped again in the service. */
  days: z.number().int().min(MIN_SHARE_DAYS).max(MAX_SHARE_DAYS).optional(),
  /** The operator's own note. Never shown to the recipient. */
  note: z.string().trim().max(300).optional(),
});

const revokeSchema = z.strictObject({
  shareId: z.string().trim().min(1).max(200),
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

  const { id } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    // An empty body is a valid request: share with the defaults.
    rawBody = {};
  }

  const parsed = createSchema.safeParse(rawBody ?? {});
  if (!parsed.success) return errorResponse("Invalid request body.", 400);

  try {
    const share = await shareDemo(id, {
      days: parsed.data.days ?? DEFAULT_SHARE_DAYS,
      note: parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null,
    });

    // The path, not an absolute URL. The server does not reliably know the
    // public origin, and guessing one would produce a link that silently fails
    // in someone's hands; the client joins it to the origin it is already on.
    return Response.json({ share, path: sharePath(share.token) }, { status: 201 });
  } catch (error) {
    if (error instanceof DemoNotFoundError) return errorResponse("Demo not found.", 404);

    console.error(`[POST /api/demos/${id}/share] failed:`, error);
    return errorResponse("Could not create a share link. Please try again.", 500);
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
    const shares = await sharesForDemo(id);
    return Response.json({
      // Paths alongside the records, so the operator's view never has to
      // rebuild a URL from a token and get the prefix wrong.
      shares: shares.map((share) => ({ ...share, path: sharePath(share.token) })),
    });
  } catch (error) {
    console.error(`[GET /api/demos/${id}/share] failed:`, error);
    return errorResponse("Could not read share links.", 500);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireApiSession();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parsed = revokeSchema.safeParse(rawBody);
  if (!parsed.success) return errorResponse("Invalid request body.", 400);

  try {
    const revoked = await revokeShare(parsed.data.shareId);
    if (revoked === null) return errorResponse("Share link not found.", 404);
    return Response.json({ share: revoked });
  } catch (error) {
    console.error(`[DELETE /api/demos/${id}/share] failed:`, error);
    return errorResponse("Could not revoke the share link.", 500);
  }
}
