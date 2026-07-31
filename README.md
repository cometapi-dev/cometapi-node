# CometAPI TypeScript and Node.js SDK

The official CometAPI entry point for the OpenAI-compatible API. The SDK keeps
the official OpenAI JavaScript request, response, stream, and error types while
defaulting the client to CometAPI.

> **Stable 0.1.x maintenance:** Stable packages install from npm's default
> `latest` dist-tag, while prerelease artifacts use `next`. Exact package,
> dist-tag, and GitHub Release state is intentionally not pinned in this README;
> query the registries when that state matters. The supported API remains
> limited to the contract-tested 0.1 surface documented here and in
> [COMPATIBILITY.md](./COMPATIBILITY.md).

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

Install the stable package from npm's default `latest` dist-tag:

```bash
npm install cometapi
```

The unversioned registry page is
<https://www.npmjs.com/package/cometapi>. Query npm and GitHub instead of using
an exact version copied from repository prose:

```bash
npm view cometapi version
npm view cometapi dist-tags --json
gh release view --repo cometapi-dev/cometapi-node \
  --json tagName,isDraft,isPrerelease,publishedAt,url
```

The release workflow is the sole source of the npm dist-tag: prerelease
versions publish to `next`, while stable versions publish to `latest`. The
package manifest does not declare a static dist-tag.

For source-checkout testing, retain and verify one exact tarball:

```bash
mkdir -p .artifacts
npm pack --pack-destination .artifacts
npm run test:package -- --tarball .artifacts/cometapi-$(node -p 'require("./package.json").version').tgz
npm run test:examples -- --tarball .artifacts/cometapi-$(node -p 'require("./package.json").version').tgz
npm run test:fixtures -- --tarball .artifacts/cometapi-$(node -p 'require("./package.json").version').tgz
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
  model: "gpt-5.6-sol",
  input: "Explain why the sky is blue in one sentence.",
});

console.log(response.output_text);

const stream = await client.chat.completions.create({
  model: "gpt-5.6-sol",
  messages: [{ role: "user", content: "Write one sentence about comets." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
process.stdout.write("\n");
```

## CommonJS quick start

```js
const { CometAPI } = require("cometapi");

const client = new CometAPI();

async function main() {
  const completion = await client.chat.completions.create({
    model: "gpt-5.6-sol",
    messages: [{ role: "user", content: "Reply with one short greeting." }],
  });
  console.log(completion.choices[0]?.message?.content ?? "");

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

Runnable ESM and CommonJS examples are in [`examples/`](./examples/). The
offline example gate executes these exact files against the packed artifact with
a fail-closed mocked transport. Executing them against the live API remains a
separately authorized operation.

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
    model: "gpt-5.6-sol",
    messages: [{ role: "user", content: "Reply with OK." }],
  },
  { timeout: 5_000 },
);
```

The 0.1.x public type matches the enforced runtime boundary. The SDK owns
CometAPI routing, authentication, and the Node-only secret boundary.
`CometAPIOptions` therefore declares `provider?: never`,
`workloadIdentity?: never`, and `dangerouslyAllowBrowser?: never`. Non-`undefined`
values are rejected by TypeScript, including through inferred variables,
spreads, and constrained generics, and runtime validation protects plain
JavaScript and type-cast bypasses. The same restriction applies to inherited
`withOptions` calls. A rejection is an official OpenAI `OpenAIError` and names
only the forbidden field; it never includes the supplied value.

Supported options remain available, including `timeout`, `maxRetries`, `fetch`,
`fetchOptions`, `defaultHeaders`, `defaultQuery`, `logger`, `organization`,
`project`, `webhookSecret`, `adminAPIKey`, and per-request options. The client
continues to derive its CometAPI API key and base URL from the documented
constructor and environment settings.

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
npm run test:examples
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

The repository is in stable 0.1.x maintenance, and no 0.2 provider-adapter
milestone is active. Repository foundation, Public Preview, and Registry Alpha
are complete. Stable packages use `latest`; Registry Alpha artifacts use
`next`. Use the npm and GitHub queries in [Installation](#installation) for
exact current state. Release-specific CI, live-smoke, registry, integrity,
signature, provenance, and public-install evidence is retained in
[RELEASING.md](./RELEASING.md), not restated as mutable version status here.

Mocked responses, packed artifacts, GitHub Actions, trusted live tests, and npm
publication remain separate evidence layers and must not be represented as one
another. Exact failed-release, immutable-artifact, and one-time recovery history
is retained in [RELEASING.md](./RELEASING.md) rather than reproduced in this
consumer README. The permanent release workflow is immutable-tag-bound and
publishes through npm OIDC.

See:

- [Canonical repository](https://github.com/cometapi-dev/cometapi-node)
- Support and conduct: `support@cometapi.com`
- [Private vulnerability reporting](https://github.com/cometapi-dev/cometapi-node/security/advisories/new), enabled for Public Preview
- [COMPATIBILITY.md](./COMPATIBILITY.md) for the supported protocol matrix
- [ARCHITECTURE.md](./ARCHITECTURE.md) for design constraints
- [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor checks
- [SECURITY.md](./SECURITY.md) for vulnerability reporting
- [SUPPORT.md](./SUPPORT.md) for support boundaries
- [RELEASING.md](./RELEASING.md) for the release evidence model
- [ROADMAP.md](./ROADMAP.md) for milestone status

## License

MIT. See [LICENSE](./LICENSE).
