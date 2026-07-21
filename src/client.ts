import { OpenAI, type ClientOptions } from "openai";

import { resolveBaseURL, resolveCometAPIKey } from "./config.js";

/** Public constructor options accepted by {@link CometAPI}. */
export interface CometAPIOptions extends Omit<
  ClientOptions,
  "apiKey" | "baseURL"
> {
  /** CometAPI API key. Defaults to `COMETAPI_KEY`. */
  apiKey?: string;
  /** OpenAI-compatible API base. Defaults to `COMETAPI_BASE_URL`, then CometAPI. */
  baseURL?: string;
}

/**
 * OpenAI-compatible CometAPI client.
 *
 * The supported 0.1 surface is `chat.completions.create`,
 * `responses.create`, and `models.list`. Transport, streaming, retries,
 * pagination, errors, and protocol types are inherited from the official
 * OpenAI JavaScript client.
 */
export class CometAPI extends OpenAI {
  constructor(options: CometAPIOptions = {}) {
    const {
      apiKey: explicitAPIKey,
      baseURL: explicitBaseURL,
      ...openAIOptions
    } = options;
    super({
      ...openAIOptions,
      apiKey: resolveCometAPIKey(explicitAPIKey),
      baseURL: resolveBaseURL(explicitBaseURL),
    });
  }
}
