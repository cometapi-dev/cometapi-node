import { describe, expect, it } from "vitest";

import { CometAPI } from "../src/index.js";
import {
  createMockFetch,
  getCapturedRequest,
  jsonResponse,
  parseJSONBody,
} from "./helpers/http.js";

const BASE_URL = "https://mock.cometapi.example/v1";
const API_KEY = "test-contract-key";

describe("supported CometAPI 0.1 HTTP contracts", () => {
  it("serializes and deserializes chat.completions.create", async () => {
    const mock = createMockFetch(() =>
      jsonResponse({
        id: "chatcmpl_contract",
        object: "chat.completion",
        created: 1_784_160_000,
        model: "gpt-5.4",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello from CometAPI." },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 5,
          total_tokens: 13,
        },
      }),
    );
    const client = new CometAPI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
      fetch: mock.fetch,
    });

    const completion = await client.chat.completions.create(
      {
        model: "gpt-5.4",
        messages: [{ role: "user", content: "Say hello." }],
        temperature: 0.25,
      },
      { headers: { "x-contract-option": "chat-create" } },
    );

    expect(mock.requests).toHaveLength(1);
    const request = getCapturedRequest(mock.requests);
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`${BASE_URL}/chat/completions`);
    expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(request.headers.get("x-contract-option")).toBe("chat-create");
    expect(request.headers.get("content-type")).toMatch(/^application\/json/);
    expect(parseJSONBody(request)).toMatchObject({
      model: "gpt-5.4",
      messages: [{ role: "user", content: "Say hello." }],
      temperature: 0.25,
    });
    expect(completion.id).toBe("chatcmpl_contract");
    expect(completion.choices[0]?.message.content).toBe("Hello from CometAPI.");
    expect(completion.usage?.total_tokens).toBe(13);
  });

  it("serializes and deserializes responses.create", async () => {
    const mock = createMockFetch(() =>
      jsonResponse({
        id: "resp_contract",
        object: "response",
        created_at: 1_784_160_000,
        status: "completed",
        model: "gpt-5.4",
        output: [
          {
            id: "msg_contract",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: "A concise response.",
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
    );
    const client = new CometAPI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
      fetch: mock.fetch,
    });

    const response = await client.responses.create(
      {
        model: "gpt-5.4",
        input: "Give a concise response.",
        max_output_tokens: 32,
      },
      { headers: { "x-contract-option": "responses-create" } },
    );

    const request = getCapturedRequest(mock.requests);
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`${BASE_URL}/responses`);
    expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(request.headers.get("x-contract-option")).toBe("responses-create");
    expect(parseJSONBody(request)).toMatchObject({
      model: "gpt-5.4",
      input: "Give a concise response.",
      max_output_tokens: 32,
    });
    expect(response.id).toBe("resp_contract");
    expect(response.status).toBe("completed");
    expect(response.output[0]?.type).toBe("message");
  });

  it("forwards request options and deserializes models.list", async () => {
    const mock = createMockFetch(() =>
      jsonResponse({
        object: "list",
        data: [
          {
            id: "gpt-5.4",
            object: "model",
            created: 1_784_160_000,
            owned_by: "openai",
          },
        ],
      }),
    );
    const client = new CometAPI({
      apiKey: API_KEY,
      baseURL: `${BASE_URL}/`,
      fetch: mock.fetch,
    });

    const models = await client.models.list({
      headers: { "x-contract-option": "models-list" },
    });

    const request = getCapturedRequest(mock.requests);
    const url = new URL(request.url);
    expect(request.method).toBe("GET");
    expect(`${url.origin}${url.pathname}`).toBe(`${BASE_URL}/models`);
    expect(url.search).toBe("");
    expect(request.body).toBe("");
    expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(request.headers.get("x-contract-option")).toBe("models-list");
    expect(models.data).toHaveLength(1);
    expect(models.data[0]?.id).toBe("gpt-5.4");
  });

  it("forwards a caller-supplied fetch implementation and fetch options", async () => {
    const mock = createMockFetch(() =>
      jsonResponse({ object: "list", data: [] }),
    );
    const client = new CometAPI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
      fetch: mock.fetch,
      fetchOptions: { cache: "no-store" },
    });

    await client.models.list();

    expect(mock.fetch).toHaveBeenCalledOnce();
    expect(mock.requests[0]?.init?.cache).toBe("no-store");
  });
});
