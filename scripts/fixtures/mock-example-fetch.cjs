const assert = require("node:assert/strict");
const dgram = require("node:dgram");
const http = require("node:http");
const http2 = require("node:http2");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const { URL } = require("node:url");

const mode = process.env.COMETAPI_EXAMPLE_MODE;
if (mode !== "esm" && mode !== "commonjs") {
  throw new Error("COMETAPI_EXAMPLE_MODE must be esm or commonjs.");
}

const forbidden = () => {
  throw new Error("Real network access is forbidden while testing examples.");
};
for (const [target, methods] of [
  [http, ["get", "request"]],
  [https, ["get", "request"]],
  [http2, ["connect"]],
  [net, ["connect", "createConnection"]],
  [tls, ["connect"]],
  [dgram.Socket.prototype, ["connect", "send"]],
]) {
  for (const method of methods) target[method] = forbidden;
}
globalThis.WebSocket = function ForbiddenWebSocket() {
  forbidden();
};

const jsonHeaders = { "content-type": "application/json" };
const expectations =
  mode === "esm"
    ? [
        {
          method: "POST",
          path: "/v1/responses",
          body: {
            model: "gpt-5.6-sol",
            input: "Explain why the sky is blue in one sentence.",
          },
          response: () =>
            new Response(
              JSON.stringify({
                id: "resp_example",
                object: "response",
                created_at: 1,
                status: "completed",
                model: "gpt-5.6-sol",
                output: [
                  {
                    id: "msg_example",
                    type: "message",
                    status: "completed",
                    role: "assistant",
                    content: [
                      {
                        type: "output_text",
                        text: "Sunlight scatters in the atmosphere, making blue wavelengths dominate the daytime sky.",
                        annotations: [],
                        logprobs: [],
                      },
                    ],
                  },
                ],
                parallel_tool_calls: true,
                tool_choice: "auto",
                tools: [],
              }),
              { headers: jsonHeaders },
            ),
        },
        {
          method: "POST",
          path: "/v1/chat/completions",
          body: {
            model: "gpt-5.6-sol",
            messages: [
              { role: "user", content: "Write one sentence about comets." },
            ],
            stream: true,
          },
          response: () =>
            new Response(
              [
                'data: {"id":"chat_example","object":"chat.completion.chunk","created":1,"model":"gpt-5.6-sol","choices":[{"index":0,"delta":{"content":"Comets "},"finish_reason":null}]}',
                "",
                'data: {"id":"chat_example","object":"chat.completion.chunk","created":1,"model":"gpt-5.6-sol","choices":[{"index":0,"delta":{"content":"shine."},"finish_reason":null}]}',
                "",
                "data: [DONE]",
                "",
              ].join("\n"),
              { headers: { "content-type": "text/event-stream" } },
            ),
        },
      ]
    : [
        {
          method: "POST",
          path: "/v1/chat/completions",
          body: {
            model: "gpt-5.6-sol",
            messages: [
              { role: "user", content: "Reply with one short greeting." },
            ],
          },
          response: () =>
            new Response(
              JSON.stringify({
                id: "chat_example",
                object: "chat.completion",
                created: 1,
                model: "gpt-5.6-sol",
                choices: [
                  {
                    index: 0,
                    message: {
                      role: "assistant",
                      content: "Hello from CometAPI!",
                      refusal: null,
                    },
                    finish_reason: "stop",
                    logprobs: null,
                  },
                ],
              }),
              { headers: jsonHeaders },
            ),
        },
        {
          method: "GET",
          path: "/v1/models",
          response: () =>
            new Response(
              JSON.stringify({
                object: "list",
                data: [
                  {
                    id: "gpt-5.6-sol",
                    object: "model",
                    created: 1,
                    owned_by: "cometapi",
                  },
                  {
                    id: "claude-sonnet-4-6",
                    object: "model",
                    created: 1,
                    owned_by: "cometapi",
                  },
                ],
              }),
              { headers: jsonHeaders },
            ),
        },
      ];

globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const expected = expectations[0];
  assert.ok(expected, `Unexpected request: ${request.method} ${request.url}`);
  assert.equal(request.method, expected.method);
  const url = new URL(request.url);
  assert.equal(url.origin, "https://example.invalid");
  assert.equal(url.pathname, expected.path);
  assert.equal(url.search, "");
  assert.equal(request.headers.get("authorization"), "Bearer mock-example-key");
  if (expected.body === undefined) {
    assert.equal(await request.text(), "");
  } else {
    assert.match(
      request.headers.get("content-type") ?? "",
      /^application\/json/,
    );
    assert.deepEqual(JSON.parse(await request.text()), expected.body);
  }
  expectations.shift();
  return expected.response();
};

process.on("beforeExit", () => {
  assert.equal(
    expectations.length,
    0,
    "The example did not make every expected request.",
  );
});
