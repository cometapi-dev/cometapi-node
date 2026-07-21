const assert = require("node:assert/strict");

const { CometAPI } = require("cometapi");
const { APIError, OpenAI, OpenAIError } = require("openai");

const client = new CometAPI({
  apiKey: "fixture-key",
  baseURL: "https://fixture.invalid/v1",
  fetch: async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "invalid_api_key",
          message: "fixture denial",
          type: "invalid_request_error",
        },
      }),
      { headers: { "content-type": "application/json" }, status: 401 },
    ),
  maxRetries: 0,
});

assert.ok(client instanceof CometAPI);
assert.ok(client instanceof OpenAI);

let configurationError;
try {
  new CometAPI({ apiKey: "   " });
} catch (error) {
  configurationError = error;
}
assert.ok(configurationError instanceof OpenAIError);
assert.equal(configurationError.constructor, OpenAIError);

client.models
  .list()
  .then(() => assert.fail("models.list should reject the fixture response"))
  .catch((error) => {
    assert.ok(error instanceof APIError);
    assert.equal(error.status, 401);
  });
