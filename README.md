# CometAPI TypeScript and Node.js SDK

The official CometAPI entry point for the OpenAI-compatible API. The SDK keeps
the official OpenAI JavaScript request, response, stream, and error types while
defaulting the client to CometAPI.

> **Pre-release:** the SDK is under active 0.1 development. The package is not
> yet available from npm, and its API may change before `0.1.0`.

## Supported 0.1 surface

The 0.1 contract is intentionally small:

- `chat.completions.create`, streaming and non-streaming
- `responses.create`, streaming and non-streaming
- `models.list`

Other methods inherited from the official OpenAI client are not supported by
CometAPI unless they are listed in [COMPATIBILITY.md](./COMPATIBILITY.md) with
contract evidence. Anthropic, Gemini, CometAPI account resources, images,
video, audio, batch, fine-tuning, realtime, and browser-side use of long-lived
keys are outside the 0.1 scope.

## Requirements

- Node.js 22 or 24
- A CometAPI API key

Node.js 26 is an advisory test target until it enters LTS. Node.js 18 and 20 are
not supported. The package `engines` range includes Node.js 22 and 24 only;
passing the Node.js 26 advisory lane does not create a support claim.

Create an API key at <https://www.cometapi.com/console/token>. Keep it secret:
do not embed it in source code, browser bundles, logs, or committed environment
files. You are responsible for all usage and charges incurred with your key.

## Installation

When a prerelease is available, install it from npm's `next` dist-tag:

```bash
npm install cometapi@next
```

The release workflow is the sole source of the npm dist-tag: prerelease
versions publish to `next`, while stable versions publish to `latest`. The
package manifest does not declare a static dist-tag.

For source-checkout testing, retain and verify one exact tarball:

```bash
mkdir -p .artifacts
npm pack --pack-destination .artifacts
npm run test:package -- --tarball .artifacts/cometapi-0.1.0-alpha.1.tgz
npm run test:fixtures -- --tarball .artifacts/cometapi-0.1.0-alpha.1.tgz
```

Install that path in a separate consumer when needed. Do not treat a locally
packed artifact as proof that npm publication succeeded.

## Configuration

Set the key in the environment:

```bash
export COMETAPI_KEY="your-api-key"
```

`CometAPI` uses these settings:

| Setting               | Purpose                             | Default                                                 |
| --------------------- | ----------------------------------- | ------------------------------------------------------- |
| Constructor `apiKey`  | Explicit API key                    | `COMETAPI_KEY`                                          |
| Constructor `baseURL` | Explicit OpenAI-compatible base URL | `COMETAPI_BASE_URL`, then `https://api.cometapi.com/v1` |

Explicit constructor values take precedence over environment variables. The SDK
does not add an account-management access-token contract in 0.1.
Missing or blank API keys and explicitly blank base URLs throw the official
OpenAI `OpenAIError` family. HTTP failures preserve the official `APIError`
family and identity.

## ESM quick start

```js
import { CometAPI } from "cometapi";

const client = new CometAPI();

const response = await client.responses.create({
  model: "gpt-5.4",
  input: "Explain why the sky is blue in one sentence.",
});

console.log(response.output_text);
```

## CommonJS quick start

```js
const { CometAPI } = require("cometapi");

const client = new CometAPI();

async function main() {
  const models = await client.models.list();
  for (const model of models.data) {
    console.log(model.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

## Streaming Chat Completions

```js
import { CometAPI } from "cometapi";

const client = new CometAPI();
const stream = await client.chat.completions.create({
  model: "gpt-5.4",
  messages: [{ role: "user", content: "Write one sentence about comets." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
```

Runnable ESM and CommonJS examples are in [`examples/`](./examples/). The
packed fixtures execute equivalent mocked public calls; executing live examples
against a packed artifact remains a separately authorized release gate.

## Custom options

Because `CometAPI` is a thin subclass of the official `OpenAI` client, supported
OpenAI constructor and per-request options remain available:

```js
import { CometAPI } from "cometapi";

const client = new CometAPI({
  timeout: 20_000,
  maxRetries: 2,
  fetch: globalThis.fetch,
});

const response = await client.chat.completions.create(
  {
    model: "gpt-5.4",
    messages: [{ role: "user", content: "Reply with OK." }],
  },
  { timeout: 5_000 },
);
```

## Direct OpenAI client interoperability

Applications may also configure the official client directly. This is an
interoperability option, not the primary CometAPI SDK experience:

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.COMETAPI_KEY,
  baseURL: process.env.COMETAPI_BASE_URL ?? "https://api.cometapi.com/v1",
});
```

## Local development and verification

Run commands from this repository root:

```bash
npm ci
npm run build
npm test
npm run typecheck
npm run lint
npm run format:check
npm run test:secrets
npm run test:package
npm run test:live-contract
npm run test:fixtures
npm run test:compat
npm run check:standalone-content
npm run check:self-contained
npm run check:public-preview
npm run actionlint
npm run verify
```

`npm run verify` is the aggregate offline verification gate. Contract tests
use mocked transport and require no production credential. `npm run actionlint`
downloads and checksum-verifies the repository-pinned version when needed, then
performs static workflow validation. It does not prove that a workflow ran
successfully on GitHub Actions. The secret gate scans the current tracked tree
plus reachable Git blobs, commit and tag messages, and historical paths without
printing matched values. The self-containment gate requires a clean tracked
worktree and verifies an exact materialized copy of `HEAD` in an empty temporary
parent.

## Project status

The repository is preparing for Public Preview and the first Registry Alpha.
Mocked responses, packed artifacts, GitHub Actions, trusted live tests, and npm
publication are separate evidence layers; one must not be represented as
another.

See:

- [Canonical repository](https://github.com/cometapi-dev/cometapi-node)
- Support and conduct: `support@cometapi.com`
- [Private vulnerability reporting](https://github.com/cometapi-dev/cometapi-node/security/advisories/new), activated during Public Preview
- [COMPATIBILITY.md](./COMPATIBILITY.md) for the supported protocol matrix
- [ARCHITECTURE.md](./ARCHITECTURE.md) for design constraints
- [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor checks
- [SECURITY.md](./SECURITY.md) for vulnerability reporting
- [SUPPORT.md](./SUPPORT.md) for support boundaries
- [RELEASING.md](./RELEASING.md) for the release evidence model
- [ROADMAP.md](./ROADMAP.md) for milestone status

## License

MIT. See [LICENSE](./LICENSE).
