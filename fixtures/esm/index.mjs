import assert from "node:assert/strict";

import { CometAPI } from "cometapi";

const client = new CometAPI({
  apiKey: "fixture-key",
  baseURL: "https://fixture.invalid/v1",
  fetch: async (input, init) => {
    const request = new Request(input, init);
    if (request.url.endsWith("/models")) {
      assert.equal(request.method, "GET");
      return new Response(
        JSON.stringify({
          data: [
            {
              created: 1,
              id: "gpt-5.4",
              object: "model",
              owned_by: "cometapi",
            },
          ],
          object: "list",
        }),
        { headers: { "content-type": "application/json" } },
      );
    }

    assert.equal(request.method, "POST");
    assert.equal(request.url, "https://fixture.invalid/v1/responses");
    return new Response(
      JSON.stringify({
        created_at: 1,
        id: "resp_fixture",
        model: "gpt-5.4",
        object: "response",
        output: [
          {
            content: [
              {
                annotations: [],
                logprobs: [],
                text: "OK",
                type: "output_text",
              },
            ],
            id: "msg_fixture",
            role: "assistant",
            status: "completed",
            type: "message",
          },
        ],
        parallel_tool_calls: true,
        status: "completed",
        tool_choice: "auto",
        tools: [],
      }),
      { headers: { "content-type": "application/json" } },
    );
  },
});

assert.ok(client instanceof CometAPI);
const models = await client.models.list();
assert.equal(models.data[0]?.id, "gpt-5.4");
const response = await client.responses.create({
  input: "Reply with OK.",
  model: "gpt-5.4",
});
assert.equal(response.id, "resp_fixture");
