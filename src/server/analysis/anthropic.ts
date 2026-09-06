import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import type { AnalysisProviderInput, AnalysisProviderResult } from "@/lib/analysis";
import { anthropicApiKey } from "@/server/env";

import { ANALYSIS_SYSTEM_PROMPT, ANTHROPIC_ANALYSIS_MODEL, buildAnalysisUserMessage } from "./prompt";
import { analysisResultSchema } from "./schema";
import { AnalysisProviderError, type AnalysisProvider } from "./types";

/**
 * Claude-backed analyser.
 *
 * Server-only: it reads ANTHROPIC_API_KEY, which must never reach the browser.
 *
 * COST AND SAFETY POSTURE
 *   - one request per analysis, no batching, no background work
 *   - `maxRetries: 0` -- the SDK retries twice by default, and silently
 *     repeating a paid request on a timeout is not a decision to make
 *     implicitly. A failure is reported to the user, who can retry deliberately.
 *   - a bounded `max_tokens` sized for this structured response
 *   - no conversation history: each analysis sees one listing and nothing else
 *
 * The model returns ONLY recommendations (see `AnalysisProviderResult`), so it
 * has no field in which to assert a provider fact.
 */

/** Enough for the structured strategy plus adaptive thinking, and no more. */
const MAX_TOKENS = 8000;

/** Client timeout in MILLISECONDS (the TypeScript SDK's unit). */
const REQUEST_TIMEOUT_MS = 60_000;

export interface AnthropicProviderOptions {
  /** Test seam: inject a stub so tests never reach the network. */
  client?: Pick<Anthropic["messages"], "parse">;
}

function createClient(): Pick<Anthropic["messages"], "parse"> {
  // Throws a clear configuration error when the key is absent. The message
  // names the VARIABLE, never any value.
  const apiKey = anthropicApiKey();

  return new Anthropic({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    // Deliberate: no automatic retry of a paid request.
    maxRetries: 0,
  }).messages;
}

/**
 * Map an SDK error to our own, keeping upstream detail out of the message.
 *
 * The returned message is safe for a server log. Route handlers substitute a
 * generic message for the browser, so no upstream body, request id or key
 * fragment can reach a client either way.
 */
function toProviderError(error: unknown): AnalysisProviderError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new AnalysisProviderError("Anthropic rejected the credentials.", { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AnalysisProviderError("Anthropic rate limit reached.", { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AnalysisProviderError("Anthropic request timed out.", { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AnalysisProviderError("Could not reach Anthropic.", { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    // Status only. Response bodies can echo request content.
    return new AnalysisProviderError(`Anthropic returned HTTP ${error.status ?? "error"}.`, {
      cause: error,
    });
  }
  if (error instanceof AnalysisProviderError) return error;
  return new AnalysisProviderError("Anthropic analysis failed.", { cause: error });
}

export function createAnthropicAnalysisProvider(
  options: AnthropicProviderOptions = {},
): AnalysisProvider {
  return {
    name: "anthropic",
    model: ANTHROPIC_ANALYSIS_MODEL,

    async analyse(input: AnalysisProviderInput): Promise<AnalysisProviderResult> {
      // Configuration failures surface as AnalysisProviderError too, so a
      // caller has exactly one error type to handle. The env helper's message
      // names the VARIABLE only, so it is safe to carry through.
      let messages: Pick<Anthropic["messages"], "parse">;
      try {
        messages = options.client ?? createClient();
      } catch (error) {
        throw new AnalysisProviderError(
          error instanceof Error ? error.message : "Anthropic is not configured.",
          { cause: error },
        );
      }

      let response;
      try {
        response = await messages.parse({
          model: ANTHROPIC_ANALYSIS_MODEL,
          max_tokens: MAX_TOKENS,
          system: ANALYSIS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildAnalysisUserMessage(input) }],
          output_config: { format: zodOutputFormat(analysisResultSchema) },
        });
      } catch (error) {
        throw toProviderError(error);
      }

      // A refusal is a successful HTTP call with no usable content.
      if (response.stop_reason === "refusal") {
        throw new AnalysisProviderError("Anthropic declined to analyse this listing.");
      }

      const parsed = response.parsed_output;
      if (!parsed) {
        throw new AnalysisProviderError("Anthropic returned no parseable structured output.");
      }

      // Validate again in our own code. Structured output is an additional
      // guarantee, not a replacement for validating what we are about to store.
      const validated = analysisResultSchema.safeParse(parsed);
      if (!validated.success) {
        throw new AnalysisProviderError("Anthropic output did not match the analysis schema.");
      }

      return validated.data;
    },
  };
}

export const anthropicAnalysisProvider: AnalysisProvider = createAnthropicAnalysisProvider();
