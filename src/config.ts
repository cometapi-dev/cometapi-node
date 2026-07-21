import { OpenAIError } from "openai";

/** Default OpenAI-compatible CometAPI base URL. */
export const DEFAULT_COMETAPI_BASE_URL = "https://api.cometapi.com/v1";

function readEnvironmentVariable(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === "" ? undefined : value;
}

export function resolveCometAPIKey(explicitAPIKey?: string): string {
  const apiKey =
    explicitAPIKey === undefined
      ? readEnvironmentVariable("COMETAPI_KEY")
      : explicitAPIKey.trim();

  if (!apiKey) {
    throw new OpenAIError(
      "A CometAPI API key is required. Pass apiKey or set COMETAPI_KEY.",
    );
  }

  return apiKey;
}

export function resolveBaseURL(explicitBaseURL?: string): string {
  if (explicitBaseURL !== undefined) {
    const baseURL = explicitBaseURL.trim();
    if (!baseURL) {
      throw new OpenAIError("CometAPI baseURL must be a non-empty URL.");
    }
    return baseURL;
  }

  return (
    readEnvironmentVariable("COMETAPI_BASE_URL") ?? DEFAULT_COMETAPI_BASE_URL
  );
}
