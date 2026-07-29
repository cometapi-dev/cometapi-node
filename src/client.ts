import { OpenAI, OpenAIError, type ClientOptions } from "openai";

import { resolveBaseURL, resolveCometAPIKey } from "./config.js";

const UNSUPPORTED_COMETAPI_OPTIONS = [
  "provider",
  "workloadIdentity",
  "dangerouslyAllowBrowser",
] as const satisfies readonly (keyof ClientOptions)[];
type UnsupportedCometAPIOption = (typeof UNSUPPORTED_COMETAPI_OPTIONS)[number];

function sanitizeOptions<T extends Partial<ClientOptions>>(
  options: T,
): Omit<T, UnsupportedCometAPIOption> {
  const {
    provider,
    workloadIdentity,
    dangerouslyAllowBrowser,
    ...supportedOptions
  } = options;
  const unsupportedOptions = {
    provider,
    workloadIdentity,
    dangerouslyAllowBrowser,
  };

  for (const option of UNSUPPORTED_COMETAPI_OPTIONS) {
    if (unsupportedOptions[option] !== undefined) {
      throw new OpenAIError(
        `The \`${option}\` option is not supported by CometAPI.`,
      );
    }
  }

  return supportedOptions;
}

/** Public constructor options accepted by {@link CometAPI}. */
export interface CometAPIOptions extends Omit<
  ClientOptions,
  | "apiKey"
  | "baseURL"
  | "provider"
  | "workloadIdentity"
  | "dangerouslyAllowBrowser"
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
    const supportedOptions = sanitizeOptions(options);
    const {
      apiKey: explicitAPIKey,
      baseURL: explicitBaseURL,
      ...openAIOptions
    } = supportedOptions;
    super({
      ...openAIOptions,
      apiKey: resolveCometAPIKey(explicitAPIKey),
      baseURL: resolveBaseURL(explicitBaseURL),
    });
  }

  override withOptions(options: Partial<CometAPIOptions>): this {
    return super.withOptions(sanitizeOptions(options));
  }
}
