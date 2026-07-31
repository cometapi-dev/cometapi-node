import { OpenAI, OpenAIError, type ClientOptions } from "openai";

import { resolveBaseURL, resolveCometAPIKey } from "./config.js";

const UNSUPPORTED_COMETAPI_OPTIONS = [
  "provider",
  "workloadIdentity",
  "dangerouslyAllowBrowser",
] as const satisfies readonly (keyof ClientOptions)[];
type UnsupportedCometAPIOption = (typeof UNSUPPORTED_COMETAPI_OPTIONS)[number];

function validateAndSnapshotOptions<T extends Partial<ClientOptions>>(
  options: T,
): Omit<T, UnsupportedCometAPIOption> {
  for (const option of UNSUPPORTED_COMETAPI_OPTIONS) {
    if (Reflect.get(options, option) !== undefined) {
      throw new OpenAIError(
        `The \`${option}\` option is not supported by CometAPI.`,
      );
    }
  }

  const supportedOptions = {} as Omit<T, UnsupportedCometAPIOption>;
  for (const option of Reflect.ownKeys(options)) {
    if (
      UNSUPPORTED_COMETAPI_OPTIONS.includes(
        option as UnsupportedCometAPIOption,
      ) ||
      !Object.prototype.propertyIsEnumerable.call(options, option)
    ) {
      continue;
    }
    Object.defineProperty(supportedOptions, option, {
      configurable: true,
      enumerable: true,
      value: Reflect.get(options, option),
      writable: true,
    });
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
  /** CometAPI owns provider routing. */
  provider?: never;
  /** CometAPI owns API-key authentication. */
  workloadIdentity?: never;
  /** Browser-side long-lived key use is unsupported. */
  dangerouslyAllowBrowser?: never;
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
    const supportedOptions = validateAndSnapshotOptions(options);
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
    return super.withOptions(validateAndSnapshotOptions(options));
  }
}
