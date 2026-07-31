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

The public `CometAPIOptions` type omits the upstream definitions of `provider`,
`workloadIdentity`, and `dangerouslyAllowBrowser`, then redeclares those names as
`provider?: never`, `workloadIdentity?: never`, and
`dangerouslyAllowBrowser?: never`. Provider and workload-identity routing
conflict with the API key and base URL that this client injects. Browser-side
long-lived key use is outside the 0.1 security boundary. The optional-`never`
contract makes variables, spreads, and constrained generics structurally
incompatible when they carry a non-`undefined` reserved value. These fields
never represented valid CometAPI behavior, so tightening the declaration within
stable 0.1.x is not a supported feature removal.

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

`package.json` is the sole source of the candidate version. Local and release
checks derive the version from it and require agreement with the package-lock
root, the Release Please manifest or the documented one-time bootstrap, the
single candidate changelog heading, and packed metadata. A normal stable
Release Please PR changes exactly `.release-please-manifest.json`,
`CHANGELOG.md`, `package-lock.json`, and `package.json`; version-specific status
does not belong in its durable documentation. Remote publication adds exact tag
and GitHub Release agreement.

The publish workflow is the sole source of npm dist-tag selection: prereleases
use `next`, stable versions use `latest`. The package manifest must not carry a
static dist-tag because that would make stable and prerelease policy diverge.
Exact registry and Release state must be queried from npm and GitHub rather than
inferred from repository prose. The unversioned package page is
<https://www.npmjs.com/package/cometapi>, and GitHub release state is available
from <https://github.com/cometapi-dev/cometapi-node/releases>.
Trusted Publishing is the only executable authentication path. The protected-
environment token bootstrap used for `0.1.0-alpha.1` is historical evidence;
current workflows contain no token publication path and reject registry-token
credentials.

For normal stable patches, Release Please owns the reviewed version/changelog
PR and the immutable tag and GitHub Release. The configuration uses an explicit
`cometapi` component and `always-bump-patch` versioning so the authorized 0.1
maintenance window cannot enter 0.2 implicitly and a root package does not fall
into the single-package tag-discovery ambiguity encountered during 0.1.0. The
workflow also rejects commit-level `Release-As:` notes before mutation because
Release Please applies those overrides before its patch versioning strategy.
Because a GitHub Release created with the default `GITHUB_TOKEN` does not start
a separate `release.published` workflow, publication is chained from the
successful Release Please workflow. The handoff accepts only the canonical
repository's successful attempt-qualified `push` run for `main` at the
still-current exact `main` SHA. The release workflow records normalized action
outcome, same-run Release reconciliation state, pre-action Release presence,
the exact Release-producing attempt, SHA, tag, version, URL, repository,
workflow identity, run ID, and attempt in a schema-v2 exact-run artifact. An
unprivileged `workflow_run` handoff validates only that attempt's artifact,
exact tag, immutable Release, and current `main`, then dispatches `publish.yml`
with `ref=v<version>`. Only that tag-bound `workflow_dispatch` can reach fresh
artifact verification, bounded live smoke, the npm Environment, or OIDC. A
first-attempt manual run is explicitly release-inert and must succeed only after
independently validating one canonical action-created patch PR; its event cannot
enter publication. A successful `push` preparation run whose result-upload step
was skipped is also release-inert. Any purported release handoff with missing or
mismatched result, tag, or immutable Release evidence fails before live or
registry access. The release outcome and package artifact are verified
independently.

Release Please and publication remain separate trust domains. Release Please
does not receive npm OIDC permission; `id-token: write` remains limited to the
protected publish job. Repository variables gate both flows, and reruns remain
fail-closed on exact tag, artifact, dist-tag, integrity, and provenance state.
Registry package metadata and its attestation endpoint can converge at
different times. Post-publication verification therefore retries attestation
HTTP failures within a fixed time bound before failing, while preserving exact
integrity and provenance validation. If publication succeeded before a later
gate failed, only an idempotent replay of that same immutable-tag run may
continue. The protected-state step records whether the exact version already
exists; `publish-artifact.sh` then skips registry mutation only after its
integrity matches the verified tarball and refuses a later `E404` instead of
republishing. A failed-job replay preserves the same run's successful artifact
and bounded live-smoke jobs rather than borrowing evidence from another run.
Manual preparation rejects attempt 2 or later; restart uses a new dispatch with
Release creation disabled. A `push` rerun is bounded to the same run ID, SHA,
candidate, and final-head review. It may retry while the tag and Release remain
absent. If an earlier attempt already created the Release, same-run
reconciliation accepts only the exact bot-authored immutable Release at that
SHA whose publication time falls inside exactly one earlier Release Please step
from that run.
Release-mode action failure is tolerated only long enough to
prove that postcondition, reconcile the release PR to `autorelease: tagged`, and
write the attempt-qualified artifact. The authorized Actions setting lets the
default token create the PR; the resulting approval-required CI still needs a
human with write access to authorize execution, and bot review cannot satisfy
the release gate. A head change invalidates both a prior `COMMENTED` owner audit
and a formal approval. A merged release PR is accepted for tagging only after a
distinct human repository administrator formally approved its exact final
head. The workflow checks the triggering SHA,
release-branch snapshot, all open and closed PR identities, current review, and
tag/Release state immediately before Release Please mutation, then rechecks
`main`, the release branch, the complete PR snapshot, exact final-head approval,
and the Release body against `CHANGELOG` before accepting the result. It rejects any
pending merged release PR whose merge commit is not the current push SHA and
scans the complete pending merged set so a legacy, fork, alternate, older, or
additional PR cannot be tagged. Manual dispatch is therefore release-inert: it
may prepare one canonical action-created PR only when no merged release PR is
awaiting a tag.

Stable `0.1.1` used a one-time main-context publication recovery after its
immutable tag predated the permanent tag-bound workflow. It reused only the
previously verified exact artifact and bounded live evidence, so npm provenance
names the reviewed recovery control commit on `refs/heads/main` rather than the
tag. [PR #41](https://github.com/cometapi-dev/cometapi-node/pull/41) removed
every fixed recovery identifier, prior-evidence reuse branch, and temporary
`main` deployment-policy path. The permanent npm Environment policy set is
exactly `tag:v*`; branch-context publication is not part of the architecture.
The exception is historical evidence and must never be reconstructed. See
[Stable 0.1.1 release evidence](./RELEASING.md#stable-011-release-evidence).

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
