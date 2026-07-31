# Compatibility

Compatibility document version: 0.1  
Package line: `0.1.x`

Maintenance status: stable `0.1.x`. Stable packages use npm's `latest` channel,
and Registry Alpha artifacts use `next`. Exact package, dist-tag, and GitHub
Release state is intentionally not pinned here; query
<https://www.npmjs.com/package/cometapi> and
<https://github.com/cometapi-dev/cometapi-node/releases>. Dated evidence for
each completed release remains below.

This matrix defines the contract-tested 0.1 compatibility surface. Inheritance
from the official OpenAI client does not by itself establish CometAPI support.
Release and live-compatibility claims require their corresponding CI, registry,
and release evidence.

## Supported protocol surface

| Operation                 | Non-streaming   | Streaming       |
| ------------------------- | --------------- | --------------- |
| `chat.completions.create` | Contract-tested | Contract-tested |
| `responses.create`        | Contract-tested | Contract-tested |
| `models.list`             | Contract-tested | Not applicable  |

“Contract-tested” means the repository requires mocked and packed-artifact
checks for the operation. It is not a claim that a live request or npm artifact
has been independently verified.

For every supported operation, mocked contracts verify the HTTP method and
resolved URL, authentication, serialization, deserialization, documented
option forwarding, custom `fetch`, official error identity, and absence of full
credentials from CometAPI-generated output. Configuration derivation through
`withOptions` and per-request cancellation cover the relevant Node.js client
lifecycle. The official Fetch-based client owns no closeable session, so a
`close()` operation is not applicable. Streaming operations additionally
verify event iteration and cancellation.

Missing or blank credentials and blank explicit base URLs fail before transport
as official `OpenAIError` instances. HTTP responses continue to use the more
specific official `APIError` subclasses. This distinction is part of the tested
error contract.

## Client options contract

The 0.1 client keeps supported OpenAI transport and observability options, while
reserving CometAPI routing, authentication, and the browser security boundary.
Earlier stable declarations omitted the three reserved fields, which rejected
fresh object literals but still admitted structurally typed variables. Those
fields never produced valid, supported CometAPI behavior. Stable maintenance
therefore makes the prohibition structural:

| Option group                                                                                 | Contract                                     |
| -------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `timeout`, `maxRetries`, `fetch`, `fetchOptions`, `defaultHeaders`, `defaultQuery`, `logger` | Supported constructor pass-through           |
| `organization`, `project`, `webhookSecret`, `adminAPIKey`                                    | Supported constructor pass-through           |
| Per-request options                                                                          | Supported for the contract-tested operations |
| `provider?: never`, `workloadIdentity?: never`, `dangerouslyAllowBrowser?: never`            | Rejected by declarations and at runtime      |

`provider` and `workloadIdentity` would conflict with the CometAPI API key and
base URL injected by the SDK. `dangerouslyAllowBrowser` would cross the 0.1
long-lived-key boundary. Redeclaring all three fields as optional `never` makes
non-`undefined` values incompatible through object literals, inferred
variables, spreads, and constrained generics. The constructor and `withOptions`
enforce the same rule at runtime. Runtime rejections use the official OpenAI
`OpenAIError`, identify only the forbidden field, and do not include its value.
Compile-time negative tests run against source and packed ESM/CommonJS
declarations; runtime tests cover plain JavaScript and type-cast bypasses.

## Inherited but unsupported in 0.1

The following categories may be reachable through the upstream `OpenAI` class,
but CometAPI 0.1 does not claim or test them:

- Images, audio, video, embeddings, batch, fine-tuning, and realtime APIs
- Upload and task-lifecycle helpers
- Browser-side use with a long-lived CometAPI key
- Any OpenAI resource not listed in the supported table

Anthropic Messages and Gemini text adapters are planned for a later milestone.
CometAPI-specific balance, profile, usage, and account resources are also
deferred. No compatibility aliases are provided for legacy client names.

## Runtime matrix

| Runtime          | Package support / workflow policy                |
| ---------------- | ------------------------------------------------ |
| Node.js 22       | Supported by `engines`; blocking CI              |
| Node.js 24       | Supported by `engines`; blocking CI              |
| Node.js 26       | Outside `engines`; advisory until LTS            |
| Node.js 18 or 20 | Outside `engines`; unsupported, no support claim |

## OpenAI dependency matrix

The consumer manifest range is `openai:^6.47.0`. Release documentation may list a
version as verified only after the corresponding lane passes.

| Lane        | Version selection                | Runtime           | Required evidence                        |
| ----------- | -------------------------------- | ----------------- | ---------------------------------------- |
| Minimum     | `6.47.0`                         | Node.js 22        | Runtime and ESM/CommonJS consumer types  |
| Development | Version from `package-lock.json` | Node.js 22 and 24 | Every blocking runtime                   |
| Canary      | Latest compatible 6.x            | Node.js 24        | Scheduled and dependency-update workflow |

The compatible manifest range can resolve an upstream minor before it appears
in this verified table. If the canary finds an incompatibility, maintainers
must remove the compatibility claim, add a narrow temporary exclusion when
necessary, and prepare a tested fix.

The packed host fixture must already declare a compatible `openai` dependency.
It must prove that `npm ls openai --all` resolves one effective installation and
that an SDK error remains an instance of the host application's `APIError`. It
also type-checks ESM and CommonJS consumers against inherited non-streaming,
streaming, and model-list return types.

## Evidence commands

```bash
npm run test
npm run test:package
npm run test:examples
npm run test:live-contract
npm run test:fixtures
npm run test:compat
npm run verify
```

These are offline or mocked checks. Stable verification also ran the minimum,
locked, and latest-compatible OpenAI 6.x lanes. Live compatibility requires the
separately gated trusted workflow described in [RELEASING.md](./RELEASING.md).
A successful HTTP status alone is transport evidence, not proof that streaming,
types, errors, and cancellation behave correctly. Each authorized live run
remains bounded to exactly three sequential requests, 16 output tokens, a
60-second per-request timeout, concurrency one, and stop on the first failure.

For stable `0.1.0`, the latest-compatible lane passed in
[CI run 30344290818](https://github.com/cometapi-dev/cometapi-node/actions/runs/30344290818).
The immutable release, bounded live smoke, OIDC publication, registry
signatures and provenance, and public artifact checks passed in
[publish run 30345735681](https://github.com/cometapi-dev/cometapi-node/actions/runs/30345735681).
A separate post-publication registry-tarball check also passed the ESM,
CommonJS, and compatible-OpenAI host fixtures with one effective
`openai@6.47.0` installation and preserved official error identities.

For stable `0.1.1`, the final release-PR head passed the blocking, minimum,
locked, latest-compatible, Node.js 26 advisory, package, workflow, and
standalone lanes in
[CI run 30468358086](https://github.com/cometapi-dev/cometapi-node/actions/runs/30468358086).
Release Please created the immutable
[`v0.1.1` Release](https://github.com/cometapi-dev/cometapi-node/releases/tag/v0.1.1),
and the bounded live smoke plus OIDC publication completed in the evidence
chain recorded in [RELEASING.md](./RELEASING.md#stable-011-release-evidence).
Separate public-registry verification passed ESM, CommonJS, declarations,
supported mocked calls, one effective OpenAI installation, official error
identity, integrity, signature, and provenance.

For stable `0.1.2`, the strict structural option declarations and packed
ESM/CommonJS fixtures passed
[source PR CI 30600555979](https://github.com/cometapi-dev/cometapi-node/actions/runs/30600555979)
and the action-authored release candidate passed
[CI run 30600746212 attempt 2](https://github.com/cometapi-dev/cometapi-node/actions/runs/30600746212/attempts/2).
Release Please created the immutable
[`v0.1.2` Release](https://github.com/cometapi-dev/cometapi-node/releases/tag/v0.1.2),
and
[Publish run 30601661643](https://github.com/cometapi-dev/cometapi-node/actions/runs/30601661643)
completed the first permanent tag-bound release sequence. Its bounded live
smoke, OIDC publication, public-registry ESM/CommonJS and declaration checks,
single effective OpenAI installation, official error identity, integrity,
signature, and provenance evidence is recorded in
[RELEASING.md](./RELEASING.md#stable-012-release-evidence).
