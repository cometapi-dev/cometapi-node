import { vi } from "vitest";

export interface CapturedRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string;
  readonly signal: AbortSignal;
  readonly init: RequestInit | undefined;
}

export type MockResponder = (
  request: CapturedRequest,
  requestIndex: number,
) => Response | Promise<Response>;

/**
 * Creates an entirely in-memory fetch implementation and records the public
 * request shape that the upstream OpenAI client sends to it.
 */
export function createMockFetch(responder: MockResponder): {
  readonly fetch: typeof globalThis.fetch;
  readonly requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];

  const fetch = vi.fn(
    async (...args: Parameters<typeof globalThis.fetch>): Promise<Response> => {
      const [input, init] = args;
      const normalized = new Request(input, init);
      const body =
        normalized.method === "GET" || normalized.method === "HEAD"
          ? ""
          : await normalized.clone().text();
      const request: CapturedRequest = {
        url: normalized.url,
        method: normalized.method,
        headers: new Headers(normalized.headers),
        body,
        signal: init?.signal ?? normalized.signal,
        init,
      };

      requests.push(request);
      return responder(request, requests.length - 1);
    },
  ) as unknown as typeof globalThis.fetch;

  return { fetch, requests };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", "req_test_contract");
  }

  return new Response(JSON.stringify(body), { ...init, headers });
}

export interface SSEMessage {
  readonly event?: string;
  readonly data: unknown;
}

export function sseResponse(
  messages: readonly SSEMessage[],
  options: {
    readonly keepOpen?: boolean;
    readonly onCancel?: () => void;
  } = {},
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const message of messages) {
        const eventLine = message.event ? `event: ${message.event}\n` : "";
        const data =
          message.data === "[DONE]" ? "[DONE]" : JSON.stringify(message.data);
        controller.enqueue(encoder.encode(`${eventLine}data: ${data}\n\n`));
      }
      if (!options.keepOpen) {
        controller.close();
      }
    },
    cancel() {
      options.onCancel?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "x-request-id": "req_test_stream",
    },
  });
}

export function parseJSONBody(
  request: CapturedRequest,
): Record<string, unknown> {
  return JSON.parse(request.body) as Record<string, unknown>;
}

export function getCapturedRequest(
  requests: readonly CapturedRequest[],
  index = 0,
): CapturedRequest {
  const request = requests[index];
  if (!request) {
    throw new Error(`Expected captured request at index ${String(index)}.`);
  }
  return request;
}
