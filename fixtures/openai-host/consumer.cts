import { CometAPI, type CometAPIOptions } from "cometapi";
import { APIPromise, OpenAI, PagePromise } from "openai";
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

void [chat, chatStream, models, response, responseStream, upstream];
