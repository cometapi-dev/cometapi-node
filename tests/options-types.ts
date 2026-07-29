import type { ClientOptions } from "openai";

import { CometAPI, type CometAPIOptions } from "../src/index.js";

const supportedOptions: CometAPIOptions = {
  adminAPIKey: "test-admin-key",
  apiKey: "test-api-key",
  baseURL: "https://options.example.test/v1",
  defaultHeaders: { "x-options-test": "header" },
  defaultQuery: { source: "type-test" },
  fetch: globalThis.fetch,
  fetchOptions: { cache: "no-store" },
  logger: console,
  logLevel: "warn",
  maxRetries: 1,
  organization: "test-organization",
  project: "test-project",
  timeout: 1_000,
  webhookSecret: "test-webhook-secret",
};

const client = new CometAPI(supportedOptions);
client.withOptions({
  baseURL: "https://derived-options.example.test/v1",
  defaultHeaders: { "x-derived-options-test": "header" },
  defaultQuery: { source: "derived-type-test" },
  fetch: globalThis.fetch,
  fetchOptions: { cache: "reload" },
  logger: console,
  maxRetries: 0,
  timeout: 2_000,
});

const providerOptions: CometAPIOptions = {
  // @ts-expect-error CometAPI owns routing and does not accept OpenAI providers.
  provider: {} as NonNullable<ClientOptions["provider"]>,
};
const workloadIdentityOptions: CometAPIOptions = {
  // @ts-expect-error CometAPI owns API-key authentication.
  workloadIdentity: {} as NonNullable<ClientOptions["workloadIdentity"]>,
};
const browserOptions: CometAPIOptions = {
  // @ts-expect-error Browser-side long-lived key use is unsupported.
  dangerouslyAllowBrowser: true,
};

client.withOptions({
  // @ts-expect-error withOptions must not expose OpenAI provider routing.
  provider: {} as NonNullable<ClientOptions["provider"]>,
});
client.withOptions({
  // @ts-expect-error withOptions must not expose workload identity authentication.
  workloadIdentity: {} as NonNullable<ClientOptions["workloadIdentity"]>,
});
client.withOptions({
  // @ts-expect-error withOptions must not expose the browser safety bypass.
  dangerouslyAllowBrowser: true,
});

void [browserOptions, providerOptions, workloadIdentityOptions];
