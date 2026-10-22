import assert from "node:assert/strict";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from "openai";

import { CometAPI } from "../dist/index.js";

const LIVE_BASE_URL = "https://api.cometapi.com/v1";
const ALLOWED_URLS = new Set([
  `${LIVE_BASE_URL}/chat/completions`,
  `${LIVE_BASE_URL}/models`,
  `${LIVE_BASE_URL}/responses`,
]);

function readBudget(name, maximum, minimum = 1) {
  const value = Number(process.env[name] ?? maximum);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${String(minimum)} and ${String(maximum)}.`,
    );
  }
  return value;
}

const LOGICAL_REQUEST_COUNT = 3;
const RETRY_BUDGET = readBudget("COMETAPI_LIVE_RETRY_BUDGET", 1, 0);
const REQUEST_LIMIT = readBudget("COMETAPI_LIVE_REQUEST_LIMIT", 4);
const OUTPUT_TOKEN_LIMIT = readBudget("COMETAPI_LIVE_MAX_OUTPUT_TOKENS", 16);
const REQUEST_TIMEOUT_MS = readBudget(
  "COMETAPI_LIVE_REQUEST_TIMEOUT_MS",
  60_000,
);
const concurrency = readBudget("COMETAPI_LIVE_CONCURRENCY", 1);
const model = process.env.COMETAPI_SMOKE_MODEL ?? "gpt-5.6-sol";

if (
  process.env.COMETAPI_BASE_URL !== undefined &&
  process.env.COMETAPI_BASE_URL.trim() !== LIVE_BASE_URL
) {
  throw new Error(`The live smoke endpoint is pinned to ${LIVE_BASE_URL}.`);
}

if (
  REQUEST_LIMIT !== LOGICAL_REQUEST_COUNT + RETRY_BUDGET ||
  concurrency !== 1
) {
  throw new Error(
    "The 0.1 live smoke requires 3 sequential requests and a request limit equal to the logical count plus the global retry budget.",
  );
}

if (process.env.COMETAPI_LIVE_SMOKE !== "1") {
  throw new Error(
    "Live smoke is disabled. An authorized trusted workflow must set COMETAPI_LIVE_SMOKE=1.",
  );
}

if (!process.env.COMETAPI_KEY) {
  throw new Error(
    "COMETAPI_KEY is required for the authorized live smoke run.",
  );
}

let requestCount = 0;
let retryBudget = RETRY_BUDGET;

function classifyError(error) {
  let category = "unknown";
  let status = null;
  if (error instanceof APIConnectionTimeoutError) {
    category = "timeout";
  } else if (error instanceof APIConnectionError) {
    category = "connection";
  }
  if (
    category === "unknown" &&
    error instanceof APIError &&
    Number.isInteger(error.status)
  ) {
    status = error.status;
    category = "http";
  }
  if (error instanceof globalThis.DOMException && error.name === "AbortError") {
    category = "abort";
  }
  if (error instanceof Error) {
    const code = error.code ?? error.cause?.code;
    if (
      typeof code === "string" &&
      [
        "ECONNABORTED",
        "ECONNREFUSED",
        "ECONNRESET",
        "EAI_AGAIN",
        "ENETUNREACH",
        "ENOTFOUND",
        "ETIMEDOUT",
      ].includes(code)
    ) {
      category = "transport";
    }
  }
  const transient =
    category === "timeout" ||
    category === "connection" ||
    category === "abort" ||
    category === "transport" ||
    (category === "http" &&
      (status === 408 || status === 429 || (status !== null && status >= 500)));
  return { category, status, transient };
}

async function runLogicalRequest(label, operation) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      const result = await operation();
      console.error(
        JSON.stringify({
          attempt,
          category: "success",
          elapsed_ms: Date.now() - startedAt,
          request: label,
          status: null,
        }),
      );
      return result;
    } catch (error) {
      const classification = classifyError(error);
      console.error(
        JSON.stringify({
          attempt,
          category: classification.category,
          elapsed_ms: Date.now() - startedAt,
          request: label,
          status: classification.status,
        }),
      );
      if (retryBudget === 0 || !classification.transient) {
        throw error;
      }
      retryBudget -= 1;
    }
  }
  throw new Error("The live smoke retry loop exhausted unexpectedly.");
}

const guardedFetch = async (input, init) => {
  requestCount += 1;
  if (requestCount > REQUEST_LIMIT) {
    throw new Error(
      `Live smoke request limit (${String(REQUEST_LIMIT)}) exceeded.`,
    );
  }

  const request = new Request(input, init);
  if (!ALLOWED_URLS.has(request.url)) {
    throw new Error(
      `Live smoke blocked an unexpected request URL: ${request.url}`,
    );
  }
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(
    new Request(request, {
      redirect: "error",
      signal: AbortSignal.any([request.signal, timeoutSignal]),
    }),
  );
};

const client = new CometAPI({
  baseURL: LIVE_BASE_URL,
  fetch: guardedFetch,
  maxRetries: 0,
  timeout: REQUEST_TIMEOUT_MS,
});

const models = await runLogicalRequest("Models", () => client.models.list());
assert.ok(models.data.length > 0, "models.list returned no models");

const chat = await runLogicalRequest("Chat Completions", () =>
  client.chat.completions.create({
    max_completion_tokens: OUTPUT_TOKEN_LIMIT,
    messages: [{ content: "Reply with OK.", role: "user" }],
    model,
    reasoning_effort: "none",
  }),
);
assert.ok(chat.id, "Chat Completions returned no response ID");
const chatChoice = chat.choices[0];
assert.ok(chatChoice, "Chat Completions returned no choices");
assert.equal(
  chatChoice.finish_reason,
  "stop",
  "Chat Completions did not finish successfully",
);
assert.ok(
  chatChoice.message.content?.trim(),
  "Chat Completions returned no assistant text",
);

const response = await runLogicalRequest("Responses", async () => {
  const stream = await client.responses.create({
    input: "Reply with OK.",
    max_output_tokens: OUTPUT_TOKEN_LIMIT,
    model,
    reasoning: { effort: "none" },
    stream: true,
  });
  let eventCount = 0;
  let responseCompleted = false;
  let responseText = "";
  for await (const event of stream) {
    eventCount += 1;
    if (
      event.type === "error" ||
      event.type === "response.failed" ||
      event.type === "response.incomplete"
    ) {
      throw new Error(`Responses stream ended with ${event.type}.`);
    }
    if (event.type === "response.output_text.delta") {
      responseText += event.delta;
    }
    if (event.type === "response.completed") {
      assert.equal(
        event.response.status,
        "completed",
        "Responses terminal event was not completed",
      );
      responseCompleted = true;
    }
  }
  return { eventCount, responseCompleted, responseText };
});
const { eventCount, responseCompleted, responseText } = response;
assert.ok(eventCount > 0, "Responses stream returned no events");
assert.ok(responseCompleted, "Responses stream returned no completed event");
assert.ok(responseText.trim(), "Responses stream returned no output text");
assert.ok(
  requestCount >= LOGICAL_REQUEST_COUNT && requestCount <= REQUEST_LIMIT,
  `Live smoke used ${String(requestCount)} HTTP attempts for ${String(LOGICAL_REQUEST_COUNT)} logical requests.`,
);
console.log(
  `Live smoke passed ${String(LOGICAL_REQUEST_COUNT)} sequential requests in ${String(requestCount)} HTTP attempts with a ${String(OUTPUT_TOKEN_LIMIT)}-token output cap.`,
);
