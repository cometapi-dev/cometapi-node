# Architecture

## Purpose

The `cometapi` package provides a branded, typed CometAPI client while reusing
the official OpenAI JavaScript SDK for the OpenAI-compatible protocol. The 0.1
design minimizes owned protocol code and keeps package behavior auditable.

## 0.1 boundary

The supported public surface is limited to:

- `chat.completions.create`, streaming and non-streaming
- `responses.create`, streaming and non-streaming
- `models.list`

Inherited methods are not automatically supported. A method becomes supported
only after its contract tests and compatibility entry are committed. Provider-
native adapters, CometAPI-specific resources, account operations, media APIs,
and provider-neutral request translation are future work.

## Client design

`CometAPI` is a thin subclass of the official `OpenAI` class. It is responsible
only for CometAPI defaults and public branding:

1. An explicit constructor `apiKey` wins over `COMETAPI_KEY`.
2. An explicit constructor `baseURL` wins over `COMETAPI_BASE_URL`.
3. The default base URL is `https://api.cometapi.com/v1`.
4. Other documented and supported OpenAI client options pass through unchanged.

The public `CometAPIOptions` type excludes the upstream `provider`,
`workloadIdentity`, and `dangerouslyAllowBrowser` fields in addition to the
CometAPI-owned `apiKey` and `baseURL` fields. Provider and workload-identity
routing conflict with the API key and base URL that this client injects.
Browser-side long-lived key use is outside the 0.1 security boundary. These
fields never represented valid CometAPI behavior, so their removal from the
public type is a 0.1.1 contract correction rather than a supported feature
removal.

The inherited `withOptions` path is constrained to the same
`CometAPIOptions` contract. Both the constructor and `withOptions` validate
runtime objects before delegating upstream so plain JavaScript and type casts
cannot restore a forbidden routing, authentication, or browser bypass. A
forbidden field is rejected when its value is not `undefined`; the error names
the field but never serializes its value.

Missing or blank CometAPI credentials and blank explicit base URLs are rejected
before transport through the official `OpenAIError` family. Configuration
validation must not introduce an unrelated SDK-specific error hierarchy.

Options such as `timeout`, `maxRetries`, `fetch`, `fetchOptions`,
`defaultHeaders`, `defaultQuery`, `logger`, `organization`, `project`,
`webhookSecret`, and `adminAPIKey` remain pass-through configuration. This
restriction does not expand the 0.1 resource surface.

The official dependency owns HTTP transport, request and response models,
errors, retries, timeouts, pagination, streaming parsing, stream lifecycle, and
custom `fetch` integration. This repository must not reimplement those layers
or depend on private upstream methods or properties.

## Type and error identity

The package preserves official OpenAI request, response, stream, and exception
types. Local configuration failures are `OpenAIError` instances; HTTP failures
preserve the more specific official `APIError` subclasses. `openai` is a normal
compatible runtime dependency so an application that already installs a
compatible version can deduplicate it. The packed host fixture must prove both
a single effective OpenAI installation and `error instanceof APIError` identity
across the host application and CometAPI.

Public APIs use strict TypeScript. New public contracts may not use `any` or
`Record<string, any>` as an escape hatch.

## Source boundaries

The 0.1 source root contains the client, configuration, and public exports:

```text
src/
├── index.ts
├── client.ts
└── config.ts
```

Future CometAPI-specific resources belong in `src/resources/`, with their
models in `src/types/`. Future provider adapters belong in `src/providers/` and
must be isolated behind their own subpath exports. Empty placeholder modules do
not establish support.

## Module formats and packaging

The published root export supports both ESM `import` and CommonJS `require` with
matching declarations. Export-map and package-shape checks must verify both
conditions. Release validation installs the exact tarball into clean ESM,
CommonJS, and compatible-OpenAI host fixtures before any publication step.

The package manifest declares only intended runtime files. Generated build
artifacts and dependency directories are not committed. A successful source-tree
import is not package evidence; verification must use the packed artifact.

`package.json` is the source of the candidate version. Local and release checks
derive the version from it and require agreement with the package-lock root,
the Release Please manifest or the documented one-time bootstrap, the single
candidate changelog heading, and packed metadata. Remote publication adds exact
tag and GitHub release agreement.

The publish workflow is the sole source of npm dist-tag selection: prereleases
use `next`, stable versions use `latest`. The package manifest must not carry a
static dist-tag because that would make stable and prerelease policy diverge.
Trusted Publishing remains the default authentication path. The only token
path is an explicitly enabled protected-environment fallback that rejects every
version except `0.1.0-alpha.1` and every dist-tag except `next`.

For normal stable patches, Release Please owns the reviewed version/changelog
PR and the immutable tag and GitHub Release. The configuration uses an explicit
`cometapi` component and `always-bump-patch` versioning so the authorized 0.1
maintenance window cannot enter 0.2 implicitly and a root package does not fall
into the single-package tag-discovery ambiguity encountered during 0.1.0.
Because a
GitHub Release created with the default `GITHUB_TOKEN` does not start a separate
`release.published` workflow, publication is chained from the successful
Release Please workflow. The handoff accepts only the canonical repository's
successful first-attempt `push` run for `main` at the still-current exact `main`
SHA. The release workflow records `release_created`, SHA, tag, version, URL,
repository, workflow identity, run ID, and attempt in an exact-run artifact.
Publication downloads and validates that artifact before checking the tag and
immutable Release. A first-attempt manual run is explicitly release-inert and
must succeed only after validating one action-created patch PR; its event cannot
enter publication. Any successful `push` run without the exact Release
Please-created result, tag, and immutable Release fails before live or registry
access. The release outcome and package artifact are verified independently.

Release Please and publication remain separate trust domains. Release Please
does not receive npm OIDC permission; `id-token: write` remains limited to the
protected publish job. Repository variables gate both flows, and reruns remain
fail-closed on exact tag, artifact, dist-tag, integrity, and provenance state.
Release Please itself rejects attempt 2 or later before repository mutation;
the explicitly enabled preparation path uses a new manual dispatch with Release
creation disabled, while only a new `push` run can create the Release and enter
publication. The authorized Actions setting lets the default token create the
PR, but bot review cannot satisfy the gate. A merged release PR is accepted for
tagging only after a distinct repository administrator approved its final head.
The workflow checks the triggering SHA against the fetched `main` tip both at
checkout and immediately before Release Please mutation, so an older queued run
cannot release a newer default-branch commit.
It also rejects any pending merged release PR whose merge commit is not the
current push SHA, and scans the complete pending merged set so a legacy, fork,
alternate, older, or additional PR cannot be tagged. Manual dispatch is
therefore release-inert: it may prepare one canonical action-created PR only
when no merged release PR is awaiting a tag.

## Testing layers

Evidence is separated by layer:

1. Unit and mocked contract tests verify URL resolution, authentication,
   serialization, deserialization, option forwarding, custom `fetch`, errors,
   streaming, cancellation, and client lifecycle without a production key.
2. Package tests inspect the tarball, validate its exports and types, and run
   mocked calls from clean fixtures.
3. Compatibility tests cover the minimum OpenAI dependency, the locked
   development version, and a latest-within-major canary.
4. Trusted live smoke tests make exactly three sequential requests with a
   16-token output cap, a 60-second per-request timeout, concurrency of one, and
   stop-on-first-failure behavior.
5. Post-publication verification installs from npm and runs an independent
   import and mocked-call smoke test.

Passing an earlier layer does not prove a later one. In particular, mocked
responses do not establish live compatibility, and local workflow validation
does not establish GitHub Actions execution.

## Runtime policy

The package `engines` contract supports Node.js 22 and 24 only. Node.js 26 is an
advisory compatibility target and remains outside `engines` until it enters LTS
and the policy is deliberately updated. Node.js 18 and 20 are unsupported. The
normal publication runtime is Node.js 24 and must satisfy npm Trusted
Publishing's minimum Node.js and npm CLI versions recorded in
[RELEASING.md](./RELEASING.md).

## Security boundary

The SDK reads credentials from explicit options or the environment and does not
provide persistent credential storage. Full keys must never enter logs,
CometAPI-generated errors, fixtures, examples, source maps, or package
artifacts. Browser-side long-lived key use is unsupported.

## Repository independence

This directory is the repository root. Public documents, commands,
configuration, fixtures, and workflows must not depend on files outside this
root, a sibling repository, or a private checkout. The self-containment gate
copies the source into an empty temporary parent and runs the documented
offline checks there.

## Decision changes

Changes to the public client name, supported surface, dependency strategy,
module formats, runtime matrix, or release security model require an explicit
roadmap and compatibility update. Public behavior changes also require tests,
examples, and a changelog entry.
