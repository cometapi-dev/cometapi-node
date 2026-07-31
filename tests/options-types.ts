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
const supportedOverrides: Partial<CometAPIOptions> = {
  baseURL: "https://derived-options.example.test/v1",
  defaultHeaders: { "x-derived-options-test": "header" },
  defaultQuery: { source: "derived-type-test" },
  fetch: globalThis.fetch,
  fetchOptions: { cache: "reload" },
  logger: console,
  maxRetries: 0,
  timeout: 2_000,
};
client.withOptions(supportedOverrides);
new CometAPI({ ...supportedOptions });
client.withOptions({ ...supportedOverrides });

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
// @ts-expect-error Exact optional types must reject an explicit provider key.
new CometAPI({ provider: undefined });
// @ts-expect-error Exact optional types must reject an explicit workload key.
new CometAPI({ workloadIdentity: undefined });
// @ts-expect-error Exact optional types must reject an explicit browser key.
new CometAPI({ dangerouslyAllowBrowser: undefined });
// @ts-expect-error Exact optional types must reject an explicit provider key.
client.withOptions({ provider: undefined });
// @ts-expect-error Exact optional types must reject an explicit workload key.
client.withOptions({ workloadIdentity: undefined });
// @ts-expect-error Exact optional types must reject an explicit browser key.
client.withOptions({ dangerouslyAllowBrowser: undefined });

const inferredProviderOptions = {
  provider: {} as NonNullable<ClientOptions["provider"]>,
  timeout: 1_001,
};
const inferredWorkloadIdentityOptions = {
  timeout: 1_002,
  workloadIdentity: {} as NonNullable<ClientOptions["workloadIdentity"]>,
};
const inferredBrowserOptions = {
  dangerouslyAllowBrowser: true,
  timeout: 1_003,
};

// @ts-expect-error Variables must not bypass CometAPI provider routing.
new CometAPI(inferredProviderOptions);
// @ts-expect-error Variables must not bypass CometAPI workload authentication.
new CometAPI(inferredWorkloadIdentityOptions);
// @ts-expect-error Variables must not bypass the CometAPI browser boundary.
new CometAPI(inferredBrowserOptions);
// @ts-expect-error withOptions variables must not bypass provider routing.
client.withOptions(inferredProviderOptions);
// @ts-expect-error withOptions variables must not bypass workload authentication.
client.withOptions(inferredWorkloadIdentityOptions);
// @ts-expect-error withOptions variables must not bypass the browser boundary.
client.withOptions(inferredBrowserOptions);

const providerOptionsSatisfyingClientOptions = {
  provider: {} as NonNullable<ClientOptions["provider"]>,
  timeout: 1_004,
} satisfies ClientOptions;
const workloadOptionsSatisfyingClientOptions = {
  timeout: 1_005,
  workloadIdentity: {} as NonNullable<ClientOptions["workloadIdentity"]>,
} satisfies ClientOptions;
const browserOptionsSatisfyingClientOptions = {
  dangerouslyAllowBrowser: true,
  timeout: 1_006,
} satisfies ClientOptions;

// @ts-expect-error ClientOptions variables must not bypass provider routing.
new CometAPI(providerOptionsSatisfyingClientOptions);
// @ts-expect-error ClientOptions variables must not bypass workload authentication.
new CometAPI(workloadOptionsSatisfyingClientOptions);
// @ts-expect-error ClientOptions variables must not bypass the browser boundary.
new CometAPI(browserOptionsSatisfyingClientOptions);
// @ts-expect-error withOptions must reject ClientOptions provider variables.
client.withOptions(providerOptionsSatisfyingClientOptions);
// @ts-expect-error withOptions must reject ClientOptions workload variables.
client.withOptions(workloadOptionsSatisfyingClientOptions);
// @ts-expect-error withOptions must reject ClientOptions browser variables.
client.withOptions(browserOptionsSatisfyingClientOptions);

// @ts-expect-error Visible spreads must not bypass provider routing.
new CometAPI({ ...inferredProviderOptions });
// @ts-expect-error Visible spreads must not bypass workload authentication.
new CometAPI({ ...inferredWorkloadIdentityOptions });
// @ts-expect-error Visible spreads must not bypass the browser boundary.
new CometAPI({ ...inferredBrowserOptions });
// @ts-expect-error withOptions spreads must not bypass provider routing.
client.withOptions({ ...inferredProviderOptions });
// @ts-expect-error withOptions spreads must not bypass workload authentication.
client.withOptions({ ...inferredWorkloadIdentityOptions });
// @ts-expect-error withOptions spreads must not bypass the browser boundary.
client.withOptions({ ...inferredBrowserOptions });

function rejectProviderFromConstrainedGeneric<
  T extends {
    provider: NonNullable<ClientOptions["provider"]>;
    timeout: number;
  },
>(options: T): T {
  // @ts-expect-error Constrained generics must not bypass provider routing.
  new CometAPI(options);
  // @ts-expect-error withOptions must reject provider-constrained generics.
  client.withOptions(options);
  return options;
}

function rejectWorkloadFromConstrainedGeneric<
  T extends {
    timeout: number;
    workloadIdentity: NonNullable<ClientOptions["workloadIdentity"]>;
  },
>(options: T): T {
  // @ts-expect-error Constrained generics must not bypass workload authentication.
  new CometAPI(options);
  // @ts-expect-error withOptions must reject workload-constrained generics.
  client.withOptions(options);
  return options;
}

function rejectBrowserFromConstrainedGeneric<
  T extends { dangerouslyAllowBrowser: boolean; timeout: number },
>(options: T): T {
  // @ts-expect-error Constrained generics must not bypass the browser boundary.
  new CometAPI(options);
  // @ts-expect-error withOptions must reject browser-constrained generics.
  client.withOptions(options);
  return options;
}

rejectProviderFromConstrainedGeneric(inferredProviderOptions);
rejectWorkloadFromConstrainedGeneric(inferredWorkloadIdentityOptions);
rejectBrowserFromConstrainedGeneric(inferredBrowserOptions);

void [browserOptions, providerOptions, workloadIdentityOptions];
