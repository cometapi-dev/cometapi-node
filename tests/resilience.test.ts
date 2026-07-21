import {
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
} from "openai";
import { describe, expect, it, vi } from "vitest";

import { CometAPI } from "../src/index.js";
import { createMockFetch, jsonResponse } from "./helpers/http.js";

const BASE_URL = "https://resilience.cometapi.example/v1";

interface SupportedOperation {
  readonly name: string;
  readonly invoke: (client: CometAPI, signal?: AbortSignal) => Promise<unknown>;
  readonly successBody: unknown;
}

const OPERATIONS: readonly SupportedOperation[] = [
  {
    name: "chat.completions.create",
    invoke: (client, signal) =>
      client.chat.completions.create(
        {
          messages: [{ content: "Hello", role: "user" }],
          model: "gpt-5.4",
        },
        signal ? { signal } : undefined,
      ),
    successBody: {
      choices: [
        {
          finish_reason: "stop",
          index: 0,
          message: { content: "Hello", role: "assistant" },
        },
      ],
      created: 1,
      id: "chatcmpl_resilience",
      model: "gpt-5.4",
      object: "chat.completion",
    },
  },
  {
    name: "responses.create",
    invoke: (client, signal) =>
      client.responses.create(
        { input: "Hello", model: "gpt-5.4" },
        signal ? { signal } : undefined,
      ),
    successBody: {
      created_at: 1,
      id: "resp_resilience",
      model: "gpt-5.4",
      object: "response",
      output: [],
      parallel_tool_calls: true,
      status: "completed",
      tool_choice: "auto",
      tools: [],
    },
  },
  {
    name: "models.list",
    invoke: (client, signal) => client.models.list(signal ? { signal } : {}),
    successBody: { data: [], object: "list" },
  },
];

describe("official OpenAI resilience and error behavior", () => {
  for (const operation of OPERATIONS) {
    it(`retries ${operation.name} through the official retry path`, async () => {
      const mock = createMockFetch((_request, index) => {
        if (index === 0) {
          return jsonResponse(
            {
              error: {
                code: "server_error",
                message: "temporary failure",
                type: "server_error",
              },
            },
            { headers: { "retry-after-ms": "0" }, status: 500 },
          );
        }
        return jsonResponse(operation.successBody);
      });
      const client = new CometAPI({
        apiKey: "test-retry-key",
        baseURL: BASE_URL,
        fetch: mock.fetch,
        maxRetries: 1,
      });

      await operation.invoke(client);

      expect(mock.requests).toHaveLength(2);
      expect(mock.requests[0]?.headers.get("x-stainless-retry-count")).toBe(
        "0",
      );
      expect(mock.requests[1]?.headers.get("x-stainless-retry-count")).toBe(
        "1",
      );
    });

    it(`times out ${operation.name} through the official timeout path`, async () => {
      let observedSignal: AbortSignal | undefined;
      const mock = createMockFetch(
        (request) =>
          new Promise<Response>((_resolve, reject) => {
            observedSignal = request.signal;
            const rejectForAbort = () => {
              reject(
                new DOMException("The operation was aborted", "AbortError"),
              );
            };
            if (request.signal.aborted) {
              rejectForAbort();
            } else {
              request.signal.addEventListener("abort", rejectForAbort, {
                once: true,
              });
            }
          }),
      );
      const client = new CometAPI({
        apiKey: "test-timeout-key",
        baseURL: BASE_URL,
        fetch: mock.fetch,
        maxRetries: 0,
        timeout: 25,
      });

      await expect(operation.invoke(client)).rejects.toBeInstanceOf(
        APIConnectionTimeoutError,
      );
      expect(observedSignal?.aborted).toBe(true);
      expect(mock.requests).toHaveLength(1);
    });

    it(`aborts ${operation.name} through public request options`, async () => {
      const controller = new AbortController();
      let markFetchStarted: (() => void) | undefined;
      const fetchStarted = new Promise<void>((resolve) => {
        markFetchStarted = resolve;
      });
      const mock = createMockFetch(
        (request) =>
          new Promise<Response>((_resolve, reject) => {
            markFetchStarted?.();
            const rejectForAbort = () => {
              reject(
                new DOMException("The operation was aborted", "AbortError"),
              );
            };
            if (request.signal.aborted) {
              rejectForAbort();
            } else {
              request.signal.addEventListener("abort", rejectForAbort, {
                once: true,
              });
            }
          }),
      );
      const client = new CometAPI({
        apiKey: "test-abort-key",
        baseURL: BASE_URL,
        fetch: mock.fetch,
        maxRetries: 0,
      });

      const request = operation.invoke(client, controller.signal);
      const rejection =
        expect(request).rejects.toBeInstanceOf(APIUserAbortError);
      await fetchStarted;
      controller.abort();

      await rejection;
      expect(controller.signal.aborted).toBe(true);
      expect(mock.requests).toHaveLength(1);
    });

    it(`preserves ${operation.name} errors without leaking credentials`, async () => {
      const apiKey = `test-secret-${operation.name}-must-not-leak`;
      const logger = {
        debug: vi.fn((...values: unknown[]) => values),
        error: vi.fn((...values: unknown[]) => values),
        info: vi.fn((...values: unknown[]) => values),
        warn: vi.fn((...values: unknown[]) => values),
      };
      const mock = createMockFetch(() =>
        jsonResponse(
          {
            error: {
              code: "invalid_api_key",
              message: "The supplied credential is invalid.",
              type: "invalid_request_error",
            },
          },
          { status: 401 },
        ),
      );
      const client = new CometAPI({
        apiKey,
        baseURL: BASE_URL,
        fetch: mock.fetch,
        logger,
        logLevel: "debug",
        maxRetries: 0,
      });
      const error = await operation
        .invoke(client)
        .catch((caught: unknown) => caught);
      const errorEvidence = [
        String(error),
        error instanceof Error ? (error.stack ?? "") : "",
        serializeForLeakCheck(error),
      ].join("\n");
      const logEvidence = Object.values(logger)
        .flatMap((method) => method.mock.calls)
        .flatMap((call) => call)
        .map(serializeForLeakCheck)
        .join("\n");

      expect(error).toBeInstanceOf(APIError);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error).toMatchObject({ code: "invalid_api_key", status: 401 });
      expect(logger.debug).toHaveBeenCalled();
      expect(errorEvidence).not.toContain(apiKey);
      expect(logEvidence).not.toContain(apiKey);
    });
  }
});

function serializeForLeakCheck(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}
