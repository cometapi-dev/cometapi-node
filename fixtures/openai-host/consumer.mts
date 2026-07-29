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
