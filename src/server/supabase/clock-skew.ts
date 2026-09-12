/**
 * Retry the one Supabase error that is a clock problem, not a request problem.
 *
 * With Supabase's new API keys, the gateway turns our secret key into a
 * short-lived token for each request. Now and then the gateway's clock runs a
 * little ahead of the database API's, and the API refuses the token as
 * "JWT issued at future" (PostgREST code PGRST303, HTTP 401). Nothing about the
 * request was wrong -- a second later the same token time is in the past --
 * but the page that asked gets an error. It was seen on the dashboard, where
 * the "last updated" date then went missing.
 *
 * So exactly that response is retried, once, after a short pause. Every other
 * response, including every other 401, passes through untouched: a wrong key
 * must fail immediately, not twice.
 */

type Fetch = typeof fetch;

export const CLOCK_SKEW_RETRY_DELAY_MS = 1000;

async function isIssuedInFuture(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const body = (await response.clone().json()) as { code?: unknown; message?: unknown };
    return body.code === "PGRST303" && typeof body.message === "string" && /issued at future/i.test(body.message);
  } catch {
    return false;
  }
}

/** A request can be sent again only if its body is not a one-shot stream. */
function isReplayable(init: RequestInit | undefined): boolean {
  const body = init?.body;
  return body === undefined || body === null || typeof body === "string";
}

export function withClockSkewRetry(
  fetchImpl: Fetch,
  options: { delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Fetch {
  const delayMs = options.delayMs ?? CLOCK_SKEW_RETRY_DELAY_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  return async (input, init) => {
    const first = await fetchImpl(input, init);
    if (input instanceof Request || !isReplayable(init) || !(await isIssuedInFuture(first))) return first;
    console.warn("[supabase] token refused as issued in the future (clock skew); retrying once");
    await sleep(delayMs);
    return fetchImpl(input, init);
  };
}
