import { describe, expect, it, vi } from "vitest";

import { withClockSkewRetry } from "./clock-skew";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const skew = () => json(401, { code: "PGRST303", details: null, hint: null, message: "JWT issued at future" });

function fakeFetch(...responses: Response[]) {
  const calls: unknown[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([input, init]);
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const noSleep = { sleep: async () => undefined };

describe("withClockSkewRetry", () => {
  it("retries a token refused as issued in the future, once", async () => {
    const { impl, calls } = fakeFetch(skew(), json(200, [{ id: 1 }]));
    const response = await withClockSkewRetry(impl, noSleep)("https://x.supabase.co/rest/v1/ingest_runs", { method: "GET" });
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("gives up after one retry, returning the second answer", async () => {
    const { impl, calls } = fakeFetch(skew(), skew());
    const response = await withClockSkewRetry(impl, noSleep)("https://x/rest/v1/t", { method: "GET" });
    expect(response.status).toBe(401);
    expect(calls).toHaveLength(2);
  });

  it("never retries any other failure", async () => {
    for (const other of [
      json(401, { code: "PGRST301", message: "JWT could not be decoded" }),
      json(401, { message: "Invalid API key" }),
      json(500, { code: "PGRST303", message: "JWT issued at future" }),
      json(404, { code: "PGRST205" }),
      new Response("not json", { status: 401 }),
    ]) {
      const { impl, calls } = fakeFetch(other);
      await withClockSkewRetry(impl, noSleep)("https://x/rest/v1/t", { method: "GET" });
      expect(calls).toHaveLength(1);
    }
  });

  it("replays a request with a text body, and never one with a stream", async () => {
    const withText = fakeFetch(skew(), json(201, {}));
    await withClockSkewRetry(withText.impl, noSleep)("https://x/rest/v1/t", { method: "POST", body: '{"a":1}' });
    expect(withText.calls).toHaveLength(2);

    const withStream = fakeFetch(skew());
    const stream = new ReadableStream();
    await withClockSkewRetry(withStream.impl, noSleep)("https://x/rest/v1/t", { method: "POST", body: stream });
    expect(withStream.calls).toHaveLength(1);
  });

  it("passes the successful answer through untouched", async () => {
    const { impl, calls } = fakeFetch(json(200, [{ id: 7 }]));
    const response = await withClockSkewRetry(impl, noSleep)("https://x/rest/v1/t");
    expect(await response.json()).toEqual([{ id: 7 }]);
    expect(calls).toHaveLength(1);
  });
});
