import { OpenAIError } from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CometAPI, type CometAPIOptions } from "../src/index.js";
import { createMockFetch, jsonResponse } from "./helpers/http.js";

const ENV_KEYS = [
  "COMETAPI_KEY",
  "COMETAPI_BASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
] as const;

const savedEnvironment = new Map<string, string | undefined>();
const UNSUPPORTED_OPTION_CASES = [
  {
    label: "provider object",
    optionName: "provider",
    unsupportedOptions: {
      provider: { credential: "provider-secret-must-not-leak" },
    },
  },
  {
    label: "null provider",
    optionName: "provider",
    unsupportedOptions: { provider: null },
  },
  {
    label: "workload identity object",
    optionName: "workloadIdentity",
    unsupportedOptions: {
      workloadIdentity: {
        clientSecret: "workload-secret-must-not-leak",
      },
    },
  },
  {
    label: "null workload identity",
    optionName: "workloadIdentity",
    unsupportedOptions: { workloadIdentity: null },
  },
  {
    label: "enabled browser bypass",
    optionName: "dangerouslyAllowBrowser",
    unsupportedOptions: { dangerouslyAllowBrowser: true },
  },
  {
    label: "disabled browser bypass",
    optionName: "dangerouslyAllowBrowser",
    unsupportedOptions: { dangerouslyAllowBrowser: false },
  },
] as const;

function createLogger() {
  return {
    debug: vi.fn((...values: unknown[]) => values),
    error: vi.fn((...values: unknown[]) => values),
    info: vi.fn((...values: unknown[]) => values),
    warn: vi.fn((...values: unknown[]) => values),
  };
}

function captureConfigurationError(
  options: ConstructorParameters<typeof CometAPI>[0],
): OpenAIError {
  let caught: unknown;
  try {
    new CometAPI(options);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(OpenAIError);
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).constructor).toBe(OpenAIError);
  return caught as OpenAIError;
}

function captureWithOptionsError(
  client: CometAPI,
  options: Partial<CometAPIOptions>,
): OpenAIError {
  let caught: unknown;
  try {
    client.withOptions(options);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(OpenAIError);
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).constructor).toBe(OpenAIError);
  return caught as OpenAIError;
}

function expectSecretFreeError(
  error: OpenAIError,
  secrets: readonly string[],
  logger: ReturnType<typeof createLogger>,
): void {
  const serializedValues = [
    String(error),
    error.message,
    error.stack ?? "",
    JSON.stringify(error),
    JSON.stringify({ error }),
  ].join("\n");
  const loggedValues = Object.values(logger)
    .flatMap((method) => method.mock.calls)
    .flatMap((call) => call)
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
    .join("\n");

  for (const secret of secrets) {
    expect(serializedValues).not.toContain(secret);
    expect(loggedValues).not.toContain(secret);
  }
  for (const method of Object.values(logger)) {
    expect(method).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnvironment.set(key, process.env[key]);
    Reflect.deleteProperty(process.env, key);
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    const value = savedEnvironment.get(key);
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
  savedEnvironment.clear();
});

describe("CometAPI configuration", () => {
  it("uses the CometAPI default base URL", async () => {
    const mock = createMockFetch(() =>
      jsonResponse({ object: "list", data: [] }),
    );
    const client = new CometAPI({
      apiKey: "test-default-key",
      fetch: mock.fetch,
    });

    await client.models.list();

    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0]?.url).toBe("https://api.cometapi.com/v1/models");
    expect(mock.requests[0]?.headers.get("authorization")).toBe(
      "Bearer test-default-key",
    );
  });

  it("uses COMETAPI_KEY and COMETAPI_BASE_URL when options are absent", async () => {
    process.env.COMETAPI_KEY = "  test-environment-key  ";
    process.env.COMETAPI_BASE_URL = "  https://proxy.example.test/openai/v1/  ";
    const mock = createMockFetch(() =>
      jsonResponse({ object: "list", data: [] }),
    );
    const client = new CometAPI({ fetch: mock.fetch });

    await client.models.list();

    expect(mock.requests[0]?.url).toBe(
      "https://proxy.example.test/openai/v1/models",
    );
    expect(mock.requests[0]?.headers.get("authorization")).toBe(
      "Bearer test-environment-key",
    );
  });

  it("gives explicit options precedence over CometAPI environment variables", async () => {
    process.env.COMETAPI_KEY = "test-environment-key";
    process.env.COMETAPI_BASE_URL = "https://environment.example.test/v1";
    const mock = createMockFetch(() =>
      jsonResponse({ object: "list", data: [] }),
    );
    const client = new CometAPI({
      apiKey: "test-explicit-key",
      baseURL: "https://explicit.example.test/custom/v1/",
      fetch: mock.fetch,
    });

    await client.models.list();

    expect(mock.requests[0]?.url).toBe(
      "https://explicit.example.test/custom/v1/models",
    );
    expect(mock.requests[0]?.headers.get("authorization")).toBe(
      "Bearer test-explicit-key",
    );
  });

  it("throws an OpenAIError without falling back to OpenAI environment variables", () => {
    const openAIKey = "test-openai-key-must-not-leak";
    const openAIBaseURL = "https://openai-environment.example.test/v1";
    const logger = createLogger();
    process.env.OPENAI_API_KEY = openAIKey;
    process.env.OPENAI_BASE_URL = "https://openai-environment.example.test/v1";

    const error = captureConfigurationError({ logger, logLevel: "debug" });

    expect(error.message).toMatch(/CometAPI API key.*COMETAPI_KEY/i);
    expectSecretFreeError(error, [openAIKey, openAIBaseURL], logger);
  });

  it("rejects a blank explicit API key with a secret-free OpenAIError instead of falling back", () => {
    const environmentKey = "environment-key-must-not-be-used-or-leaked";
    const environmentBaseURL = "https://environment.example.test/v1";
    const logger = createLogger();
    process.env.COMETAPI_KEY = environmentKey;
    process.env.COMETAPI_BASE_URL = environmentBaseURL;

    const error = captureConfigurationError({
      apiKey: "   ",
      logger,
      logLevel: "debug",
    });

    expect(error.message).toMatch(/CometAPI API key is required/);
    expectSecretFreeError(error, [environmentKey, environmentBaseURL], logger);
  });

  it("rejects a blank explicit base URL with a secret-free OpenAIError instead of falling back", () => {
    const explicitKey = "explicit-key-must-not-leak";
    const environmentKey = "environment-key-must-not-be-used-or-leaked";
    const environmentBaseURL = "https://environment.example.test/v1";
    const logger = createLogger();
    process.env.COMETAPI_KEY = environmentKey;
    process.env.COMETAPI_BASE_URL = environmentBaseURL;

    const error = captureConfigurationError({
      apiKey: explicitKey,
      baseURL: "   ",
      logger,
      logLevel: "debug",
    });

    expect(error.message).toMatch(/CometAPI baseURL must be a non-empty URL/);
    expectSecretFreeError(
      error,
      [explicitKey, environmentKey, environmentBaseURL],
      logger,
    );
  });

  it.each(UNSUPPORTED_OPTION_CASES)(
    "rejects the unsupported $label constructor option with a secret-free OpenAIError",
    ({ optionName, unsupportedOptions }) => {
      const apiKey = "unsupported-constructor-key-must-not-leak";
      const logger = createLogger();
      const error = captureConfigurationError({
        apiKey,
        logger,
        logLevel: "debug",
        ...unsupportedOptions,
      } as unknown as CometAPIOptions);

      expect(error.message).toContain(`\`${optionName}\``);
      expect(error.message).toMatch(/not supported by CometAPI/i);
      expectSecretFreeError(
        error,
        [
          apiKey,
          "provider-secret-must-not-leak",
          "workload-secret-must-not-leak",
        ],
        logger,
      );
    },
  );

  it.each(UNSUPPORTED_OPTION_CASES)(
    "rejects the unsupported $label withOptions override with a secret-free OpenAIError",
    ({ optionName, unsupportedOptions }) => {
      const apiKey = "unsupported-with-options-key-must-not-leak";
      const logger = createLogger();
      const client = new CometAPI({ apiKey, logger, logLevel: "debug" });
      const error = captureWithOptionsError(
        client,
        unsupportedOptions as unknown as Partial<CometAPIOptions>,
      );

      expect(error.message).toContain(`\`${optionName}\``);
      expect(error.message).toMatch(/not supported by CometAPI/i);
      expectSecretFreeError(
        error,
        [
          apiKey,
          "provider-secret-must-not-leak",
          "workload-secret-must-not-leak",
        ],
        logger,
      );
    },
  );

  it("cannot enable browser use by changing an accessor after validation", () => {
    const browserKey = "browser-accessor-key-must-not-leak";
    const logger = createLogger();
    let reads = 0;
    const options = Object.defineProperty(
      { apiKey: browserKey, logger, logLevel: "debug" },
      "dangerouslyAllowBrowser",
      {
        enumerable: true,
        get() {
          reads += 1;
          return reads === 1 ? undefined : true;
        },
      },
    );
    vi.stubGlobal("window", { document: {} });
    vi.stubGlobal("navigator", {});

    const error = captureConfigurationError(
      options as unknown as CometAPIOptions,
    );

    expect(reads).toBe(1);
    expect(error.message).toMatch(/browser-like environment/i);
    expectSecretFreeError(error, [browserKey], logger);
  });

  it("preserves inherited public client options across withOptions", async () => {
    const original = createMockFetch(() =>
      jsonResponse({ object: "list", data: [] }),
    );
    const overridden = createMockFetch(() =>
      jsonResponse({ object: "list", data: [] }),
    );
    const logger = createLogger();
    const client = new CometAPI({
      adminAPIKey: "test-admin-key",
      apiKey: "test-lifecycle-key",
      baseURL: "https://original.example.test/v1",
      defaultHeaders: { "x-default-option": "preserved" },
      defaultQuery: { source: "with-options" },
      fetch: original.fetch,
      fetchOptions: { cache: "no-store" },
      logger,
      maxRetries: 0,
      organization: "test-organization",
      project: "test-project",
      timeout: 2_000,
      webhookSecret: "test-webhook-secret",
    });

    const derived = client.withOptions({
      baseURL: "https://derived.example.test/v1",
      fetch: overridden.fetch,
      timeout: 1_000,
    });
    await derived.models.list();

    expect(derived).toBeInstanceOf(CometAPI);
    expect(derived.adminAPIKey).toBe("test-admin-key");
    expect(derived.logger).toBe(logger);
    expect(derived.maxRetries).toBe(0);
    expect(derived.organization).toBe("test-organization");
    expect(derived.project).toBe("test-project");
    expect(derived.timeout).toBe(1_000);
    expect(derived.webhookSecret).toBe("test-webhook-secret");
    expect(original.requests).toHaveLength(0);
    const request = overridden.requests[0];
    expect(request?.url).toBe(
      "https://derived.example.test/v1/models?source=with-options",
    );
    expect(request?.headers.get("authorization")).toBe(
      "Bearer test-lifecycle-key",
    );
    expect(request?.headers.get("x-default-option")).toBe("preserved");
    expect(request?.init?.cache).toBe("no-store");
  });
});
