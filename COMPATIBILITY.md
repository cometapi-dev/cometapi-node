# Compatibility

Compatibility document version: 0.1  
Package line: `0.1.x`

Stable candidate: `0.1.0`; publication and registry verification remain
separate evidence until the immutable release workflow completes.

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

These are offline or mocked checks. Stable candidate verification also runs the
minimum, locked, and latest-compatible OpenAI 6.x lanes. Live compatibility requires the separately
gated trusted workflow described in [RELEASING.md](./RELEASING.md). A successful
HTTP status alone is transport evidence, not proof that streaming, types,
errors, and cancellation behave correctly. Each authorized live run remains
bounded to exactly three sequential requests, 16 output tokens, a 60-second
per-request timeout, concurrency one, and stop on the first failure.
