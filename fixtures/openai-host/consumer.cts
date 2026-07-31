import { CometAPI, type CometAPIOptions } from "cometapi";
import { APIPromise, type ClientOptions, OpenAI, PagePromise } from "openai";
import type {
  ChatCompletion,
  ChatCompletionChunk,
} from "openai/resources/chat/completions/completions";
import type { Model, ModelsPage } from "openai/resources/models";
import type {
  Response as OpenAIResponse,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import { Stream } from "openai/streaming";

const options: CometAPIOptions = {
  apiKey: "fixture-key",
  baseURL: "https://fixture.invalid/v1",
};
const client = new CometAPI(options);
const upstream: OpenAI = client;
const supportedOverrides: Partial<CometAPIOptions> = {
  defaultHeaders: { "x-fixture": "supported" },
  maxRetries: 0,
  timeout: 1_000,
};
client.withOptions(supportedOverrides);
new CometAPI({ ...options });
client.withOptions({ ...supportedOverrides });

const unsupportedProviderOptions: CometAPIOptions = {
  // @ts-expect-error CometAPI does not expose OpenAI provider routing.
  provider: {} as NonNullable<ClientOptions["provider"]>,
};
const unsupportedWorkloadIdentityOptions: CometAPIOptions = {
  // @ts-expect-error CometAPI owns API-key authentication.
  workloadIdentity: {} as NonNullable<ClientOptions["workloadIdentity"]>,
};
const unsupportedBrowserOptions: CometAPIOptions = {
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

// @ts-expect-error Inferred variables must not bypass provider routing.
new CometAPI(inferredProviderOptions);
// @ts-expect-error Inferred variables must not bypass workload authentication.
new CometAPI(inferredWorkloadIdentityOptions);
// @ts-expect-error Inferred variables must not bypass the browser boundary.
new CometAPI(inferredBrowserOptions);
// @ts-expect-error withOptions must reject inferred provider variables.
client.withOptions(inferredProviderOptions);
// @ts-expect-error withOptions must reject inferred workload variables.
client.withOptions(inferredWorkloadIdentityOptions);
// @ts-expect-error withOptions must reject inferred browser variables.
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
// @ts-expect-error withOptions must reject visible provider spreads.
client.withOptions({ ...inferredProviderOptions });
// @ts-expect-error withOptions must reject visible workload spreads.
client.withOptions({ ...inferredWorkloadIdentityOptions });
// @ts-expect-error withOptions must reject visible browser spreads.
client.withOptions({ ...inferredBrowserOptions });

function rejectProviderFromConstrainedGeneric<
  T extends {
    provider: NonNullable<ClientOptions["provider"]>;
    timeout: number;
  },
>(genericOptions: T): T {
  // @ts-expect-error Constrained generics must not bypass provider routing.
  new CometAPI(genericOptions);
  // @ts-expect-error withOptions must reject provider-constrained generics.
  client.withOptions(genericOptions);
  return genericOptions;
}

function rejectWorkloadFromConstrainedGeneric<
  T extends {
    timeout: number;
    workloadIdentity: NonNullable<ClientOptions["workloadIdentity"]>;
  },
>(genericOptions: T): T {
  // @ts-expect-error Constrained generics must not bypass workload authentication.
  new CometAPI(genericOptions);
  // @ts-expect-error withOptions must reject workload-constrained generics.
  client.withOptions(genericOptions);
  return genericOptions;
}

function rejectBrowserFromConstrainedGeneric<
  T extends { dangerouslyAllowBrowser: boolean; timeout: number },
>(genericOptions: T): T {
  // @ts-expect-error Constrained generics must not bypass the browser boundary.
  new CometAPI(genericOptions);
  // @ts-expect-error withOptions must reject browser-constrained generics.
  client.withOptions(genericOptions);
  return genericOptions;
}

rejectProviderFromConstrainedGeneric(inferredProviderOptions);
rejectWorkloadFromConstrainedGeneric(inferredWorkloadIdentityOptions);
rejectBrowserFromConstrainedGeneric(inferredBrowserOptions);

const chat: APIPromise<ChatCompletion> = client.chat.completions.create({
  messages: [{ content: "Reply with OK.", role: "user" }],
  model: "gpt-5.4",
});
const chatStream: APIPromise<Stream<ChatCompletionChunk>> =
  client.chat.completions.create({
    messages: [{ content: "Reply with OK.", role: "user" }],
    model: "gpt-5.4",
    stream: true,
  });
const response: APIPromise<OpenAIResponse> = client.responses.create({
  input: "Reply with OK.",
  model: "gpt-5.4",
});
const responseStream: APIPromise<Stream<ResponseStreamEvent>> =
  client.responses.create({
    input: "Reply with OK.",
    model: "gpt-5.4",
    stream: true,
  });
const models: PagePromise<ModelsPage, Model> = client.models.list();

void [
  chat,
  chatStream,
  models,
  response,
  responseStream,
  unsupportedBrowserOptions,
  unsupportedProviderOptions,
  unsupportedWorkloadIdentityOptions,
  upstream,
];
