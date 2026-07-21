import assert from "node:assert/strict";

import { CometAPI } from "cometapi";
import {
  APIConnectionTimeoutError,
  APIError,
  OpenAI,
  OpenAIError,
} from "openai";

const BASE_URL = "https://fixture.invalid/v1";
let scenario = "normal";
let retryAttempts = 0;
let cancellationSeen = false;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
    status,
  });
}

function sse(messages, keepOpen = false) {
  const encoder = new globalThis.TextEncoder();
  return new Response(
    new globalThis.ReadableStream({
      cancel() {
        cancellationSeen = true;
      },
      start(controller) {
        for (const message of messages) {
          const event = message.event ? `event: ${message.event}\n` : "";
          const data =
            message.data === "[DONE]" ? "[DONE]" : JSON.stringify(message.data);
          controller.enqueue(encoder.encode(`${event}data: ${data}\n\n`));
        }
        if (!keepOpen) controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}

const fixtureFetch = async (input, init) => {
  const request = new Request(input, init);
  assert.match(request.headers.get("authorization") ?? "", /^Bearer /);

  if (scenario === "timeout") {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal ?? request.signal;
      const rejectForAbort = () =>
        reject(
          new globalThis.DOMException(
            "The operation was aborted",
            "AbortError",
          ),
        );
      if (signal.aborted) rejectForAbort();
      else signal.addEventListener("abort", rejectForAbort, { once: true });
    });
  }

  if (scenario === "error") {
    return json(
      {
        error: {
          code: "invalid_api_key",
          message: "fixture denial",
          param: null,
          type: "invalid_request_error",
        },
      },
      401,
    );
  }

  if (scenario === "retry") {
    retryAttempts += 1;
    if (retryAttempts === 1) {
      return json(
        { error: { message: "retry fixture", type: "server_error" } },
        500,
        { "retry-after-ms": "0" },
      );
    }
  }

  if (request.url === `${BASE_URL}/models`) {
    assert.equal(request.method, "GET");
    return json({
      data: [
        { created: 1, id: "gpt-5.4", object: "model", owned_by: "cometapi" },
      ],
      object: "list",
    });
  }

  const body = await request.json();
  assert.equal(body.model, "gpt-5.4");

  if (request.url === `${BASE_URL}/chat/completions`) {
    assert.equal(request.method, "POST");
    assert.ok(Array.isArray(body.messages));
    if (body.stream) {
      return sse(
        [
          {
            data: {
              choices: [
                {
                  delta: { content: "OK" },
                  finish_reason: scenario === "cancel" ? null : "stop",
                  index: 0,
                },
              ],
              created: 1,
              id: "chatcmpl_fixture_stream",
              model: "gpt-5.4",
              object: "chat.completion.chunk",
            },
          },
          ...(scenario === "cancel" ? [] : [{ data: "[DONE]" }]),
        ],
        scenario === "cancel",
      );
    }
    return json({
      choices: [
        {
          finish_reason: "stop",
          index: 0,
          message: { content: "OK", role: "assistant" },
        },
      ],
      created: 1,
      id: "chatcmpl_fixture",
      model: "gpt-5.4",
      object: "chat.completion",
    });
  }

  assert.equal(request.url, `${BASE_URL}/responses`);
  assert.equal(request.method, "POST");
  assert.equal(body.input, "Reply with OK.");
  if (body.stream) {
    return sse([
      {
        data: {
          content_index: 0,
          delta: "OK",
          item_id: "msg_fixture",
          logprobs: [],
          output_index: 0,
          sequence_number: 0,
          type: "response.output_text.delta",
        },
        event: "response.output_text.delta",
      },
    ]);
  }
  return json({
    created_at: 1,
    id: "resp_fixture",
    model: "gpt-5.4",
    object: "response",
    output: [],
    parallel_tool_calls: true,
    status: "completed",
    tool_choice: "auto",
    tools: [],
  });
};

const client = new CometAPI({
  apiKey: "fixture-key",
  baseURL: BASE_URL,
  fetch: fixtureFetch,
  maxRetries: 0,
});

assert.ok(client instanceof CometAPI);
assert.ok(client instanceof OpenAI);

const configurationError = (() => {
  try {
    new CometAPI({ apiKey: "   " });
  } catch (error) {
    return error;
  }
  return undefined;
})();
assert.ok(configurationError instanceof OpenAIError);
assert.equal(configurationError.constructor, OpenAIError);

const models = await client.models.list({
  headers: { "x-compatibility-fixture": "models" },
});
assert.equal(models.data[0]?.id, "gpt-5.4");

const chat = await client.chat.completions.create({
  messages: [{ content: "Reply with OK.", role: "user" }],
  model: "gpt-5.4",
});
assert.equal(chat.id, "chatcmpl_fixture");

const response = await client.responses.create({
  input: "Reply with OK.",
  model: "gpt-5.4",
});
assert.equal(response.id, "resp_fixture");

const chatStream = await client.chat.completions.create({
  messages: [{ content: "Reply with OK.", role: "user" }],
  model: "gpt-5.4",
  stream: true,
});
let chatText = "";
for await (const chunk of chatStream) {
  chatText += chunk.choices[0]?.delta.content ?? "";
}
assert.equal(chatText, "OK");

const responseStream = await client.responses.create({
  input: "Reply with OK.",
  model: "gpt-5.4",
  stream: true,
});
let responseText = "";
for await (const event of responseStream) {
  if (event.type === "response.output_text.delta") responseText += event.delta;
}
assert.equal(responseText, "OK");

scenario = "cancel";
const cancelStream = await client.chat.completions.create({
  messages: [{ content: "Reply with OK.", role: "user" }],
  model: "gpt-5.4",
  stream: true,
});
for await (const chunk of cancelStream) {
  void chunk;
  break;
}
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(cancellationSeen, true);

scenario = "retry";
const retryClient = new CometAPI({
  apiKey: "fixture-key",
  baseURL: BASE_URL,
  fetch: fixtureFetch,
  maxRetries: 1,
});
await retryClient.models.list();
assert.equal(retryAttempts, 2);

scenario = "timeout";
const timeoutClient = new CometAPI({
  apiKey: "fixture-key",
  baseURL: BASE_URL,
  fetch: fixtureFetch,
  maxRetries: 0,
  timeout: 10,
});
const timeoutError = await timeoutClient.models
  .list()
  .catch((caught) => caught);
assert.ok(timeoutError instanceof APIConnectionTimeoutError);

scenario = "error";
const apiError = await client.models.list().catch((caught) => caught);
assert.ok(apiError instanceof APIError);
assert.equal(apiError.status, 401);
