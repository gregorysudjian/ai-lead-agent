import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import type { DemoSiteGeneratorInput, DemoSiteGeneratorResult } from "@/lib/demo-site";
import { anthropicApiKey } from "@/server/env";

import { ANTHROPIC_DEMO_MODEL, DEMO_SYSTEM_PROMPT, buildDemoUserMessage } from "./prompt";
import { demoContentSchema } from "./schema";
import { DemoSiteProviderError, type DemoSiteProvider } from "./types";

/**
 * Claude-backed demo-site generator.
 *
 * Server-only: it reads ANTHROPIC_API_KEY, which must never reach the browser.
 *
 * COST AND SAFETY POSTURE, matching the analyser it sits beside:
 *   - one request per demo, no batching, no background work
 *   - `maxRetries: 0` -- the SDK retries twice by default, and silently
 *     repeating a paid request on a timeout is not a decision to make
 *     implicitly. A failure is reported; a person retries deliberately.
 *   - a bounded `max_tokens` sized for this structured response
 *   - no conversation history: each demo sees one business and nothing else
 *
 * WHAT THE MODEL CANNOT DO. It returns `DemoSiteContent` and nothing else --
 * wording, structure and a theme from a closed set. There is no field for a
 * business name, phone number, address, opening time, price or URL, so the
 * facts a demo displays are still supplied entirely by application code from
 * the lead and its researched profile. The prompt asks the model not to invent;
 * the schema means it could not persist an invention if it tried.
 */

/** Enough for a full page of structured copy plus adaptive thinking. */
const MAX_TOKENS = 16000;

/** Client timeout in MILLISECONDS (the TypeScript SDK's unit). */
const REQUEST_TIMEOUT_MS = 120_000;

export interface AnthropicDemoProviderOptions {
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
function toProviderError(error: unknown): DemoSiteProviderError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new DemoSiteProviderError("Anthropic rejected the credentials.", { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new DemoSiteProviderError("Anthropic rate limit reached.", { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new DemoSiteProviderError("Anthropic request timed out.", { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new DemoSiteProviderError("Could not reach Anthropic.", { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    // Status only. Response bodies can echo request content.
    return new DemoSiteProviderError(`Anthropic returned HTTP ${error.status ?? "error"}.`, {
      cause: error,
    });
  }
  if (error instanceof DemoSiteProviderError) return error;
  return new DemoSiteProviderError("Anthropic demo generation failed.", { cause: error });
}

export function createAnthropicDemoSiteProvider(
  options: AnthropicDemoProviderOptions = {},
): DemoSiteProvider {
  return {
    name: "anthropic",
    model: ANTHROPIC_DEMO_MODEL,

    async generate(input: DemoSiteGeneratorInput): Promise<DemoSiteGeneratorResult> {
      // Configuration failures surface as DemoSiteProviderError too, so a
      // caller has exactly one error type to handle. The env helper's message
      // names the VARIABLE only, so it is safe to carry through.
      let messages: Pick<Anthropic["messages"], "parse">;
      try {
        messages = options.client ?? createClient();
      } catch (error) {
        throw new DemoSiteProviderError(
          error instanceof Error ? error.message : "Anthropic is not configured.",
          { cause: error },
        );
      }

      let response;
      try {
        response = await messages.parse({
          model: ANTHROPIC_DEMO_MODEL,
          max_tokens: MAX_TOKENS,
          system: DEMO_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildDemoUserMessage(input) }],
          output_config: { format: zodOutputFormat(demoContentSchema) },
        });
      } catch (error) {
        throw toProviderError(error);
      }

      // A refusal is a successful HTTP call with no usable content.
      if (response.stop_reason === "refusal") {
        throw new DemoSiteProviderError("Anthropic declined to write copy for this business.");
      }

      const parsed = response.parsed_output;
      if (!parsed) {
        throw new DemoSiteProviderError("Anthropic returned no parseable structured output.");
      }

      // Validate again in our own code. Structured output is an additional
      // guarantee, not a replacement for validating what we are about to store.
      const validated = demoContentSchema.safeParse(parsed);
      if (!validated.success) {
        throw new DemoSiteProviderError("Anthropic output did not match the demo schema.");
      }

      return validated.data;
    },
  };
}

export const anthropicDemoSiteProvider: DemoSiteProvider = createAnthropicDemoSiteProvider();
