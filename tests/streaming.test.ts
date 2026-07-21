import { describe, expect, it, vi } from "vitest";

import { CometAPI } from "../src/index.js";
import {
  createMockFetch,
  getCapturedRequest,
  parseJSONBody,
  sseResponse,
} from "./helpers/http.js";

const BASE_URL = "https://stream.cometapi.example/v1";

describe("supported streaming contracts", () => {
  it("iterates Chat Completions SSE events", async () => {
    const mock = createMockFetch(() =>
      sseResponse([
        {
          data: {
            id: "chatcmpl_stream",
            object: "chat.completion.chunk",
            created: 1_784_160_000,
            model: "gpt-5.4",
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "Hel" },
                finish_reason: null,
              },
            ],
          },
        },
        {
          data: {
            id: "chatcmpl_stream",
            object: "chat.completion.chunk",
            created: 1_784_160_000,
            model: "gpt-5.4",
            choices: [
              { index: 0, delta: { content: "lo" }, finish_reason: "stop" },
            ],
          },
        },
        { data: "[DONE]" },
      ]),
    );
    const client = new CometAPI({
      apiKey: "test-stream-key",
      baseURL: BASE_URL,
      fetch: mock.fetch,
    });

    const stream = await client.chat.completions.create({
      model: "gpt-5.4",
      messages: [{ role: "user", content: "Say hello." }],
      stream: true,
    });
    const text: string[] = [];
    for await (const chunk of stream) {
      text.push(chunk.choices[0]?.delta.content ?? "");
    }

    expect(text.join("")).toBe("Hello");
    expect(mock.requests[0]?.url).toBe(`${BASE_URL}/chat/completions`);
    expect(parseJSONBody(getCapturedRequest(mock.requests))).toMatchObject({
      model: "gpt-5.4",
      stream: true,
    });
  });

  it("cancels the Chat Completions response body when iteration stops", async () => {
    const cancelled = vi.fn();
    const mock = createMockFetch(() =>
      sseResponse(
        [
          {
            data: {
              id: "chatcmpl_cancel",
              object: "chat.completion.chunk",
              created: 1_784_160_000,
              model: "gpt-5.4",
              choices: [
                { index: 0, delta: { content: "first" }, finish_reason: null },
              ],
            },
          },
        ],
        { keepOpen: true, onCancel: cancelled },
      ),
    );
    const client = new CometAPI({
      apiKey: "test-stream-key",
      baseURL: BASE_URL,
      fetch: mock.fetch,
    });

    const stream = await client.chat.completions.create({
      model: "gpt-5.4",
      messages: [{ role: "user", content: "Start a response." }],
      stream: true,
    });
    for await (const chunk of stream) {
      expect(chunk.choices[0]?.delta.content).toBe("first");
      break;
    }

    await vi.waitFor(() => expect(cancelled).toHaveBeenCalledOnce());
  });

  it("iterates Responses SSE events", async () => {
    const createdResponse = {
      id: "resp_stream",
      object: "response",
      created_at: 1_784_160_000,
      status: "in_progress",
      model: "gpt-5.4",
      output: [],
    };
    const completedResponse = {
      ...createdResponse,
      status: "completed",
      output: [
        {
          id: "msg_stream",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: "Hello",
              annotations: [],
              logprobs: [],
            },
          ],
        },
      ],
    };
    const mock = createMockFetch(() =>
      sseResponse([
        {
          event: "response.created",
          data: {
            type: "response.created",
            sequence_number: 0,
            response: createdResponse,
          },
        },
        {
          event: "response.output_text.delta",
          data: {
            type: "response.output_text.delta",
            sequence_number: 1,
            item_id: "msg_stream",
            output_index: 0,
            content_index: 0,
            delta: "Hello",
            logprobs: [],
          },
        },
        {
          event: "response.completed",
          data: {
            type: "response.completed",
            sequence_number: 2,
            response: completedResponse,
          },
        },
      ]),
    );
    const client = new CometAPI({
      apiKey: "test-stream-key",
      baseURL: BASE_URL,
      fetch: mock.fetch,
    });

    const stream = await client.responses.create({
      model: "gpt-5.4",
      input: "Say hello.",
      stream: true,
    });
    const eventTypes: string[] = [];
    let delta = "";
    for await (const event of stream) {
      eventTypes.push(event.type);
      if (event.type === "response.output_text.delta") {
        delta += event.delta;
      }
    }

    expect(eventTypes).toEqual([
      "response.created",
      "response.output_text.delta",
      "response.completed",
    ]);
    expect(delta).toBe("Hello");
    expect(mock.requests[0]?.url).toBe(`${BASE_URL}/responses`);
    expect(parseJSONBody(getCapturedRequest(mock.requests))).toMatchObject({
      model: "gpt-5.4",
      input: "Say hello.",
      stream: true,
    });
  });

  it("cancels the Responses response body when iteration stops", async () => {
    const cancelled = vi.fn();
    const mock = createMockFetch(() =>
      sseResponse(
        [
          {
            event: "response.output_text.delta",
            data: {
              type: "response.output_text.delta",
              sequence_number: 1,
              item_id: "msg_cancel",
              output_index: 0,
              content_index: 0,
              delta: "first",
              logprobs: [],
            },
          },
        ],
        { keepOpen: true, onCancel: cancelled },
      ),
    );
    const client = new CometAPI({
      apiKey: "test-stream-key",
      baseURL: BASE_URL,
      fetch: mock.fetch,
    });

    const stream = await client.responses.create({
      model: "gpt-5.4",
      input: "Start a response.",
      stream: true,
    });
    for await (const event of stream) {
      expect(event.type).toBe("response.output_text.delta");
      break;
    }

    await vi.waitFor(() => expect(cancelled).toHaveBeenCalledOnce());
  });
});
