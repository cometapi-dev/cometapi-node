import assert from "node:assert/strict";

const script = new globalThis.URL("./live-smoke.mjs", import.meta.url);
const originalFetch = globalThis.fetch;
const originalLog = console.log;
const environmentNames = [
  "COMETAPI_BASE_URL",
  "COMETAPI_KEY",
  "COMETAPI_LIVE_CONCURRENCY",
  "COMETAPI_LIVE_MAX_OUTPUT_TOKENS",
  "COMETAPI_LIVE_REQUEST_LIMIT",
  "COMETAPI_LIVE_REQUEST_TIMEOUT_MS",
  "COMETAPI_LIVE_SMOKE",
];
const originalEnvironment = new Map(
  environmentNames.map((name) => [name, process.env[name]]),
);

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function sse(messages) {
  const contents = messages
    .map(
      ({ data, event }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
    )
    .join("");
  return new Response(contents, {
    headers: { "content-type": "text/event-stream" },
  });
}

function completedResponse() {
  return {
    created_at: 1,
    id: "resp_live_contract",
    model: "gpt-5.4",
    object: "response",
    output: [],
    parallel_tool_calls: true,
    status: "completed",
    tool_choice: "auto",
    tools: [],
  };
}

function createMockFetch(scenario) {
  return async (input, init) => {
    const request = new Request(input, init);
    assert.equal(request.headers.get("authorization"), "Bearer mock-live-key");

    if (request.url.endsWith("/models")) {
      return json({
        data: [
          {
            created: 1,
            id: "gpt-5.4",
            object: "model",
            owned_by: "cometapi",
          },
        ],
        object: "list",
      });
    }

    if (request.url.endsWith("/chat/completions")) {
      return json({
        choices:
          scenario === "empty-chat"
            ? []
            : [
                {
                  finish_reason: "stop",
                  index: 0,
                  message: { content: "OK", role: "assistant" },
                },
              ],
        created: 1,
        id: "chatcmpl_live_contract",
        model: "gpt-5.4",
        object: "chat.completion",
      });
    }

    assert.ok(request.url.endsWith("/responses"));
    if (scenario === "failed-response") {
      return sse([
        {
          data: {
            response: {
              ...completedResponse(),
              error: { code: "server_error", message: "mock failure" },
              status: "failed",
            },
            sequence_number: 0,
            type: "response.failed",
          },
          event: "response.failed",
        },
      ]);
    }

    const messages = [
      {
        data: {
          content_index: 0,
          delta: "OK",
          item_id: "msg_live_contract",
          logprobs: [],
          output_index: 0,
          sequence_number: 0,
          type: "response.output_text.delta",
        },
        event: "response.output_text.delta",
      },
    ];
    if (scenario !== "missing-completed") {
      messages.push({
        data: {
          response: completedResponse(),
          sequence_number: 1,
          type: "response.completed",
        },
        event: "response.completed",
      });
    }
    return sse(messages);
  };
}

async function runScenario(scenario) {
  globalThis.fetch = createMockFetch(scenario);
  await import(`${script.href}?scenario=${scenario}`);
}

try {
  console.log = () => undefined;
  process.env.COMETAPI_KEY = "mock-live-key";
  process.env.COMETAPI_LIVE_SMOKE = "1";
  process.env.COMETAPI_LIVE_REQUEST_LIMIT = "3";
  process.env.COMETAPI_LIVE_MAX_OUTPUT_TOKENS = "16";
  process.env.COMETAPI_LIVE_REQUEST_TIMEOUT_MS = "60000";
  process.env.COMETAPI_LIVE_CONCURRENCY = "1";
  delete process.env.COMETAPI_BASE_URL;

  await runScenario("success");
  process.env.COMETAPI_BASE_URL = "https://attacker.invalid/v1";
  await assert.rejects(
    () => runScenario("redirected-endpoint"),
    /endpoint is pinned/,
  );
  delete process.env.COMETAPI_BASE_URL;
  await assert.rejects(() => runScenario("empty-chat"), /returned no choices/);
  await assert.rejects(
    () => runScenario("failed-response"),
    /ended with response\.failed/,
  );
  await assert.rejects(
    () => runScenario("missing-completed"),
    /returned no completed event/,
  );
  originalLog(
    "Live-smoke semantic contract checks passed with mocked transport.",
  );
} finally {
  console.log = originalLog;
  globalThis.fetch = originalFetch;
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
}
