import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const script = new globalThis.URL("./live-smoke.mjs", import.meta.url);
const LIVE_BASE_URL = "https://api.cometapi.com/v1";
const FULL_REQUEST_SEQUENCE = [
  `${LIVE_BASE_URL}/models`,
  `${LIVE_BASE_URL}/chat/completions`,
  `${LIVE_BASE_URL}/responses`,
];
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

function createMockFetch(scenario, requestURLs = []) {
  return async (input, init) => {
    const request = new Request(input, init);
    requestURLs.push(request.url);
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
    if (scenario === "incomplete-response") {
      return sse([
        {
          data: {
            response: {
              ...completedResponse(),
              incomplete_details: { reason: "max_output_tokens" },
              status: "incomplete",
            },
            sequence_number: 0,
            type: "response.incomplete",
          },
          event: "response.incomplete",
        },
      ]);
    }
    if (scenario === "error-response") {
      return sse([
        {
          data: {
            code: "server_error",
            message: "mock response error",
            param: null,
            sequence_number: 0,
            type: "error",
          },
          event: "error",
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

async function runSuccessfulScenario() {
  const requestURLs = [];
  globalThis.fetch = createMockFetch("success", requestURLs);
  await import(`${script.href}?scenario=success`);
  assert.deepEqual(requestURLs, FULL_REQUEST_SEQUENCE);
}

function runFailingScenario(scenario, environment = {}) {
  const childProgram = [
    'import assert from "node:assert/strict";',
    `const requestURLs = [];`,
    json.toString(),
    sse.toString(),
    completedResponse.toString(),
    createMockFetch.toString(),
    `globalThis.fetch = createMockFetch(${JSON.stringify(scenario)}, requestURLs);`,
    "try {",
    `  await import(${JSON.stringify(script.href)});`,
    "} finally {",
    "  process.stdout.write(JSON.stringify(requestURLs));",
    "}",
  ].join("\n");
  const childEnvironment = {
    ...process.env,
    COMETAPI_KEY: "mock-live-key",
    COMETAPI_LIVE_CONCURRENCY: "1",
    COMETAPI_LIVE_MAX_OUTPUT_TOKENS: "16",
    COMETAPI_LIVE_REQUEST_LIMIT: "3",
    COMETAPI_LIVE_REQUEST_TIMEOUT_MS: "60000",
    COMETAPI_LIVE_SMOKE: "1",
    ...environment,
  };
  if (!("COMETAPI_BASE_URL" in environment)) {
    Reflect.deleteProperty(childEnvironment, "COMETAPI_BASE_URL");
  }

  return spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", childProgram],
    { encoding: "utf8", env: childEnvironment },
  );
}

function assertFailingScenario({
  environment,
  expectedError,
  expectedRequests,
  scenario,
}) {
  const result = runFailingScenario(scenario, environment);
  assert.notEqual(result.status, 0, `${scenario} must fail the live runner`);
  assert.match(result.stderr, expectedError);
  assert.deepEqual(JSON.parse(result.stdout), expectedRequests);
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

  await runSuccessfulScenario();
  assertFailingScenario({
    environment: { COMETAPI_BASE_URL: "https://attacker.invalid/v1" },
    expectedError: /endpoint is pinned/,
    expectedRequests: [],
    scenario: "redirected-endpoint",
  });
  assertFailingScenario({
    expectedError: /returned no choices/,
    expectedRequests: FULL_REQUEST_SEQUENCE.slice(0, 2),
    scenario: "empty-chat",
  });
  assertFailingScenario({
    expectedError: /ended with response\.failed/,
    expectedRequests: FULL_REQUEST_SEQUENCE,
    scenario: "failed-response",
  });
  assertFailingScenario({
    expectedError: /ended with response\.incomplete/,
    expectedRequests: FULL_REQUEST_SEQUENCE,
    scenario: "incomplete-response",
  });
  assertFailingScenario({
    expectedError: /ended with error/,
    expectedRequests: FULL_REQUEST_SEQUENCE,
    scenario: "error-response",
  });
  assertFailingScenario({
    expectedError: /returned no completed event/,
    expectedRequests: FULL_REQUEST_SEQUENCE,
    scenario: "missing-completed",
  });
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
