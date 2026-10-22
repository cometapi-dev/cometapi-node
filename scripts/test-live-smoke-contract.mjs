import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { TextEncoder } from "node:util";
import { ReadableStream } from "node:stream/web";

const script = new globalThis.URL("./live-smoke.mjs", import.meta.url);
const LIVE_BASE_URL = "https://api.cometapi.com/v1";
const DEFAULT_MODEL = "gpt-5.6-sol";
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
  "COMETAPI_LIVE_RETRY_BUDGET",
  "COMETAPI_LIVE_MAX_OUTPUT_TOKENS",
  "COMETAPI_LIVE_REQUEST_LIMIT",
  "COMETAPI_LIVE_REQUEST_TIMEOUT_MS",
  "COMETAPI_LIVE_SMOKE",
  "COMETAPI_SMOKE_MODEL",
];
const originalEnvironment = new Map(
  environmentNames.map((name) => [name, process.env[name]]),
);

function json(body, { headers = {}, status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
    status,
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

function interruptedSse() {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: response.output_text.delta\ndata: ${JSON.stringify({
              content_index: 0,
              delta: "partial",
              item_id: "msg_live_contract",
              output_index: 0,
              sequence_number: 0,
              type: "response.output_text.delta",
            })}\n\n`,
          ),
        );
        const error = Object.assign(new Error("stream interrupted"), {
          code: "ECONNRESET",
        });
        controller.error(error);
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}

function completedResponse() {
  return {
    created_at: 1,
    id: "resp_live_contract",
    model: DEFAULT_MODEL,
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
    if (scenario !== "redaction") {
      assert.equal(
        request.headers.get("authorization"),
        "Bearer mock-live-key",
      );
    }

    if (request.url.endsWith("/models")) {
      return json({
        data: [
          {
            created: 1,
            id: DEFAULT_MODEL,
            object: "model",
            owned_by: "cometapi",
          },
        ],
        object: "list",
      });
    }

    if (request.url.endsWith("/chat/completions")) {
      const body = await request.clone().json();
      assert.equal(body.model, DEFAULT_MODEL);
      assert.equal(body.reasoning_effort, "none");
      return json({
        choices:
          scenario === "empty-chat" || scenario === "redaction"
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
        model: DEFAULT_MODEL,
        object: "chat.completion",
      });
    }

    assert.ok(request.url.endsWith("/responses"));
    if (
      scenario === "unauthorized-response" &&
      requestURLs.filter((url) => url.endsWith("/responses")).length === 1
    ) {
      return json(
        {
          error: {
            code: "invalid_api_key",
            message: "unauthorized",
            type: "authentication_error",
          },
        },
        { status: 401 },
      );
    }
    if (
      (scenario === "timeout-response" || scenario === "retry-exhausted") &&
      (scenario === "retry-exhausted" ||
        requestURLs.filter((url) => url.endsWith("/responses")).length === 1)
    ) {
      throw new globalThis.DOMException(
        "The operation was aborted",
        "AbortError",
      );
    }
    if (
      scenario === "connection-response" &&
      requestURLs.filter((url) => url.endsWith("/responses")).length === 1
    ) {
      throw new TypeError("fetch failed");
    }
    if (
      scenario === "stream-interruption" &&
      requestURLs.filter((url) => url.endsWith("/responses")).length === 1
    ) {
      return interruptedSse();
    }
    if (
      scenario === "retry-response" &&
      requestURLs.filter((url) => url.endsWith("/responses")).length === 1
    ) {
      return json(
        {
          error: {
            code: "server_error",
            message: "temporary response failure",
            type: "server_error",
          },
        },
        { headers: { "retry-after-ms": "0" }, status: 500 },
      );
    }
    if (scenario === "auth-error") {
      return json(
        {
          error: {
            code: "invalid_api_key",
            message: "mock authentication failure",
            type: "authentication_error",
          },
        },
        { status: 401 },
      );
    }
    const body = await request.clone().json();
    assert.equal(body.model, DEFAULT_MODEL);
    assert.deepEqual(body.reasoning, { effort: "none" });
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

async function runRetryScenario() {
  const requestURLs = [];
  globalThis.fetch = createMockFetch("retry-response", requestURLs);
  await import(`${script.href}?scenario=retry-response`);
  assert.deepEqual(requestURLs, [
    ...FULL_REQUEST_SEQUENCE,
    `${LIVE_BASE_URL}/responses`,
  ]);
}

function runScenario(scenario, environment = {}) {
  const childProgram = [
    'import assert from "node:assert/strict";',
    `const DEFAULT_MODEL = ${JSON.stringify(DEFAULT_MODEL)};`,
    `const requestURLs = [];`,
    "console.log = () => undefined;",
    json.toString(),
    sse.toString(),
    interruptedSse.toString(),
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
    COMETAPI_LIVE_RETRY_BUDGET: "1",
    COMETAPI_LIVE_MAX_OUTPUT_TOKENS: "16",
    COMETAPI_LIVE_REQUEST_LIMIT: "4",
    COMETAPI_LIVE_REQUEST_TIMEOUT_MS: "60000",
    COMETAPI_LIVE_SMOKE: "1",
    ...environment,
  };
  if (!("COMETAPI_BASE_URL" in environment)) {
    Reflect.deleteProperty(childEnvironment, "COMETAPI_BASE_URL");
  }
  if (!("COMETAPI_SMOKE_MODEL" in environment)) {
    Reflect.deleteProperty(childEnvironment, "COMETAPI_SMOKE_MODEL");
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
  const result = runScenario(scenario, environment);
  assert.notEqual(result.status, 0, `${scenario} must fail the live runner`);
  assert.match(result.stderr, expectedError);
  assert.deepEqual(JSON.parse(result.stdout), expectedRequests);
}

function assertSuccessfulScenario({ environment, expectedRequests, scenario }) {
  const result = runScenario(scenario, environment);
  assert.equal(result.status, 0, `${scenario} must pass the live runner`);
  assert.deepEqual(JSON.parse(result.stdout), expectedRequests);
}

try {
  console.log = () => undefined;
  process.env.COMETAPI_KEY = "mock-live-key";
  process.env.COMETAPI_LIVE_SMOKE = "1";
  process.env.COMETAPI_LIVE_RETRY_BUDGET = "1";
  process.env.COMETAPI_LIVE_REQUEST_LIMIT = "4";
  process.env.COMETAPI_LIVE_MAX_OUTPUT_TOKENS = "16";
  process.env.COMETAPI_LIVE_REQUEST_TIMEOUT_MS = "60000";
  process.env.COMETAPI_LIVE_CONCURRENCY = "1";
  delete process.env.COMETAPI_BASE_URL;
  delete process.env.COMETAPI_SMOKE_MODEL;

  await runSuccessfulScenario();
  await runRetryScenario();
  assertSuccessfulScenario({
    expectedRequests: [...FULL_REQUEST_SEQUENCE, `${LIVE_BASE_URL}/responses`],
    scenario: "retry-response",
  });
  for (const scenario of [
    "connection-response",
    "timeout-response",
    "stream-interruption",
  ]) {
    assertSuccessfulScenario({
      expectedRequests: [
        ...FULL_REQUEST_SEQUENCE,
        `${LIVE_BASE_URL}/responses`,
      ],
      scenario,
    });
  }
  assertFailingScenario({
    environment: { COMETAPI_LIVE_RETRY_BUDGET: "2" },
    expectedError: /between 0 and 1/,
    expectedRequests: [],
    scenario: "invalid-retry-budget",
  });
  assertFailingScenario({
    environment: {
      COMETAPI_LIVE_RETRY_BUDGET: "1",
      COMETAPI_LIVE_REQUEST_LIMIT: "3",
    },
    expectedError: /logical count plus the global retry budget/,
    expectedRequests: [],
    scenario: "invalid-request-budget",
  });
  assertFailingScenario({
    environment: {
      COMETAPI_LIVE_RETRY_BUDGET: "0",
      COMETAPI_LIVE_REQUEST_LIMIT: "3",
    },
    expectedError: /operation was aborted|Request timed out/,
    expectedRequests: FULL_REQUEST_SEQUENCE,
    scenario: "timeout-response",
  });
  assertFailingScenario({
    expectedError: /operation was aborted|Request timed out/,
    expectedRequests: [...FULL_REQUEST_SEQUENCE, `${LIVE_BASE_URL}/responses`],
    scenario: "retry-exhausted",
  });
  assertFailingScenario({
    expectedError: /401/,
    expectedRequests: FULL_REQUEST_SEQUENCE,
    scenario: "auth-error",
  });
  assertFailingScenario({
    expectedError: /401|unauthorized|authentication/i,
    expectedRequests: FULL_REQUEST_SEQUENCE,
    scenario: "unauthorized-response",
  });
  const redactionSecret = "mock-live-secret-must-not-leak";
  const redaction = runScenario("redaction", {
    COMETAPI_KEY: redactionSecret,
  });
  assert.notEqual(redaction.status, 0);
  assert.doesNotMatch(
    `${redaction.stdout}\n${redaction.stderr}`,
    new RegExp(redactionSecret),
  );
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
