const assert = require("node:assert/strict");

const { CometAPI } = require("cometapi");

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
    assert.equal(request.url, "https://fixture.invalid/v1/chat/completions");
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: { content: "OK", role: "assistant" },
          },
        ],
        created: 1,
        id: "chatcmpl_fixture",
        model: "gpt-5.4",
        object: "chat.completion",
      }),
      { headers: { "content-type": "application/json" } },
    );
  },
});

assert.ok(client instanceof CometAPI);
client.models
  .list()
  .then(async (models) => {
    assert.equal(models.data[0]?.id, "gpt-5.4");
    const completion = await client.chat.completions.create({
      messages: [{ content: "Reply with OK.", role: "user" }],
      model: "gpt-5.4",
    });
    assert.equal(completion.id, "chatcmpl_fixture");
  })
  .catch((error) => {
    throw error;
  });
