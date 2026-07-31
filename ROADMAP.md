# CometAPI TypeScript and Node.js SDK Roadmap

Status: Stable 0.1.x maintenance and Repository foundation complete
Last updated: 2026-07-31
Repository contract: This roadmap is self-contained and is the public source
of truth for this repository's release sequence.

Stable `0.1.2` completed the public options type contract, release-neutral
consumer documentation, the first permanent immutable-tag publication, bounded
live smoke, OIDC provenance, public-install verification, and replay hardening
on 2026-07-31.

## Product Target

The TypeScript and Node.js SDK will provide a typed CometAPI entry point that
preserves the official OpenAI JavaScript client experience while shipping a
small, auditable package for supported Node.js LTS runtimes.

Private Remote Validation and Public Preview are complete for the sanitized
repository. The repository is public with blocking CI, protected repository and
tag rules, Private Vulnerability Reporting, protected environments, and
authorized live-smoke evidence. Registry Alpha began when the functional
`0.1.0-alpha.1` prerelease was published. The immutable `0.1.0-alpha.2` GitHub
Release then failed before invoking npm because its publication guard rejected
the fixed `actions/setup-node` authentication placeholder.
`0.1.0-alpha.3` subsequently completed the OIDC, provenance, ownership, and
public-install verification sequence. Stable `0.1.1` completed its separately
recorded recovery sequence on 2026-07-30, and stable `0.1.2` completed the
permanent tag-bound sequence on 2026-07-31. Stable 0.1.x packages use `latest`,
and Registry Alpha artifacts use `next`; query npm and GitHub rather than
treating this roadmap as current registry state.

## Milestones

| Milestone                  | Status   | User outcome                                                                                                                                   |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository foundation      | Complete | The repository has reproducible development, contribution, security, and release processes.                                                    |
| Private Remote Validation  | Complete | The sanitized private repository passes real credential-free default-branch CI; public-only controls and live tests remain disabled.           |
| Public Preview             | Complete | The public repository has blocking CI, repository rules, security reporting, protected environments, and authorized live-smoke evidence.       |
| 0.1.x Registry Alpha       | Complete | Early adopters can install a functional, provenance-verified prerelease from npm's `next` channel through the OIDC-only publication path.      |
| 0.1.0 Stable               | Complete | Users can install a fully verified package from npm's default channel.                                                                         |
| 0.1.1 maintenance patch    | Complete | Users receive the corrected options contract; the permanent tag-bound release architecture is installed and the one-time recovery is recorded. |
| 0.1.2 maintenance patch    | Complete | Users receive strict public option types and release-neutral package documentation through the verified permanent tag-bound publication path.  |
| 0.2.0 provider-native text | Planned  | Users can opt into Anthropic Messages and Gemini text adapters through isolated subpath exports.                                               |
| 0.3.0 CometAPI resources   | Planned  | Users receive typed access to the first stable CometAPI-specific account or platform resources.                                                |
| Media and task APIs        | Later    | Users receive typed image, video, audio, upload, polling, and task lifecycle helpers after their contracts are stable.                         |

## Repository Foundation

Deliverables:

- Use the unscoped npm package name `cometapi`, the public client name
  `CometAPI`, and the repository name `cometapi-node`; repository metadata and
  topics must also include TypeScript search terms.
- Set the implementation-candidate version to `0.1.0-alpha.1` and remove the
  legacy client export without a compatibility alias.
- Maintain a standalone repository-root `AGENTS.md`; no public documentation,
  commands, or configuration may depend on files outside the repository root,
  a sibling repository, or a private checkout.
- Add MIT license, contribution guide, code of conduct, security policy,
  support policy, architecture document, releasing guide, changelog, issue
  templates, and pull request template.
- Replace incomplete package metadata with explicit `exports`, `files`,
  `engines`, repository, bugs, homepage, keywords, side-effects, and license
  declarations. The `engines` range supports Node.js 22 and 24 only; Node.js 26
  remains advisory and outside the published support range until it enters LTS.
- Produce and test both ESM and CommonJS entry points.
- Add strict TypeScript, formatting, linting, Vitest, package-shape, and
  clean-install checks.
- Validate every GitHub Actions workflow locally with a documented
  `actionlint` version. Treat real GitHub Actions execution as separate remote
  evidence.
- Add dependency and GitHub Actions updates through Dependabot or Renovate.
- Protect the public default branch with pull requests and required CI after
  the visibility transition.

Exit criteria:

- A new contributor can clone the repository and run all offline checks from
  documented commands.
- The repository can be copied into an empty temporary parent, scanned for
  outside-root references, and built and tested there using only its local
  documentation and tracked files.
- Every workflow passes `actionlint`; the delivery report states whether any
  workflow has executed successfully in the real GitHub repository.
- No test on an untrusted pull request requires a CometAPI credential.
- `npm pack` contains only intended runtime files, declarations, license,
  README, and package metadata.
- ESM and CommonJS fixture applications can install the packed tarball and run
  a mocked public call.
- The public package name and trusted-publisher ownership are confirmed.

Foundation work may remain in progress during Public Preview. Package
ownership and trusted-publisher confirmation become blocking at Registry Alpha.
The canonical identity is `CometAPI`, `Copyright (c) 2026 CometAPI`,
`support@cometapi.com`, and the repository's Private Vulnerability Reporting
URL. The canonical repository is
`https://github.com/cometapi-dev/cometapi-node`; package metadata uses
`git+https://github.com/cometapi-dev/cometapi-node.git` for `repository.url`
and `https://github.com/cometapi-dev/cometapi-node/issues` for `bugs.url`.
`CODEOWNERS` remains absent until a real multi-maintainer model exists.

The failed post-`0.1.0` Release Please
[run 30345116433](https://github.com/cometapi-dev/cometapi-node/actions/runs/30345116433)
had no published tag boundary to discover, generated an unrequested `0.2.0`
temporary-branch commit, and then encountered a separate Actions pull-request
authorization failure. The `0.1.1` repair made the `cometapi` component and
patch-only versioning explicit, anchored only its initial preparation to the
immutable `0.1.0` commit, and restored Release Please ownership of the reviewed
version/changelog PR, tag, and immutable GitHub Release. The stale branch was
verified as failure-only evidence before replacement; it is not a 0.2 base.

Release Please created the action-authored, exact-head-approved `0.1.1` release
PR and immutable `v0.1.1` Release. Two publication runs then stopped before npm
mutation: one because a downloaded result file entered the formatting scan, and
one because a main-context deployment could not enter the tag-only npm
Environment. The explicitly authorized one-time recovery reused only the exact
already verified artifact and bounded live evidence, then published through npm
OIDC. [PR #41](https://github.com/cometapi-dev/cometapi-node/pull/41) removed
every fixed recovery input, prior-evidence reuse branch, and temporary `main`
policy path.

The permanent state is `RELEASE_PLEASE_ENABLED=false`,
`LIVE_SMOKE_ENABLED=true`, and exactly one npm Environment deployment policy,
`tag:v*`. Current stable publication uses an unprivileged Release Please
handoff followed by an immutable-tag dispatch, fresh verification and live
smoke, and tag-bound npm OIDC. Stable `0.1.2` completed the first end-to-end
registry execution of that permanent path. Full immutable evidence is recorded
in [RELEASING.md](./RELEASING.md#stable-012-release-evidence); the earlier
one-time recovery remains separately recorded as historical evidence.

## Private Remote Validation

Before Public Preview, maintainers create a private repository from a
sanitized first commit and verify real GitHub behavior. The complete history
must already be suitable for future public visibility and contain only durable
product, contribution, maintenance, compatibility, and release material.

Exit criteria:

- Canonical repository metadata, copyright, author, support, conduct, and
  security values are complete.
- Default-branch CI passes in GitHub Actions on Node.js 22 and 24.
- The self-containment and public-content gates pass against tracked files and
  history.
- `LIVE_SMOKE_ENABLED` and `RELEASE_PLEASE_ENABLED` keep live and release-PR
  workflows disabled.
- No branch or tag rules, Private Vulnerability Reporting, protected
  environments, registry publisher, live credential, tag, release, or package
  publication is configured or exercised during this private stage.

The private repository is created empty, without generated starter files, so
the sanitized local content becomes its first history. This stage ends after
real credential-free default-branch CI is recorded. It does not change
visibility or publish to a private or public registry.

## Public Preview

Public Preview is complete. The repository visibility transition and public-only
configuration were followed by successful default-branch verification and an
authorized protected live smoke. Evidence for the final pre-documentation
commit is recorded in the corresponding GitHub Actions runs:

- [Main CI run 30246345118](https://github.com/cometapi-dev/cometapi-node/actions/runs/30246345118)
- [Live smoke run 30246431866](https://github.com/cometapi-dev/cometapi-node/actions/runs/30246431866)

The readiness criteria remain:

- The README describes real 0.1 scope and clearly labels the repository as a
  pre-release project.
- MIT license, contribution guidance, security policy, and support path exist.
- `AGENTS.md` and all contributor-facing instructions remain valid in a
  standalone checkout with no outside-root links.
- Basic offline CI and mocked contract tests for Chat Completions, Responses,
  and Models pass without production credentials.
- `main` requires pull requests and blocking CI with zero required approvals;
  force pushes and deletion are blocked, and administrator bypass is reserved
  for emergencies.
- Version tags cannot be updated or deleted, immutable releases and Private
  Vulnerability Reporting are enabled, and the documented security URL works.
- The `live-smoke` environment has no required reviewer. The `npm` environment
  requires approval by the current release approver and permits self-review.
- Default-branch CI is rerun successfully, the fail-closed content gate reports
  all violations together and then passes, and an explicitly authorized
  protected live smoke passes within the three-request, 16-output-token,
  60-second-per-request, concurrency-one, stop-on-first-failure budget.

## 0.1.0-alpha.1: Registry Alpha

The first npm artifact must be a functional `0.1.0-alpha.1` published under the
`next` dist-tag, never an empty package. It requires core streaming and
non-streaming behavior; tarball build and clean-install checks; a trusted live
smoke run; secret isolation; confirmed package ownership; a reviewed immutable
prerelease tag; and npm Trusted Publishing unless the one-time bootstrap below
is required.

A missing credential, package ownership, remote workflow, or publication
prerequisite blocks the corresponding release gate. A mocked request never
satisfies the live-smoke gate.

## 0.1.0: OpenAI Protocol Foundation

Public scope:

- A `CometAPI` client class.
- `chat.completions.create` in streaming and non-streaming modes.
- `responses.create` in streaming and non-streaming modes.
- `models.list`.
- `COMETAPI_KEY` and `COMETAPI_BASE_URL` configuration.
- Official OpenAI request, response, stream, and exception types.

Implementation deliverables:

- Keep the subclass adapter thin and use only documented OpenAI constructor and
  client behavior.
- Declare `openai:^6.47.0` as a normal runtime dependency while documenting
  only versions present in the verified compatibility matrix.
- Prevent the full API key from appearing in CometAPI-generated errors, logs,
  fixtures, source maps, or examples.
- Reject missing or blank credentials and blank explicit base URLs through the
  official `OpenAIError` family rather than a separate configuration-error type.
- Publish a versioned compatibility matrix that distinguishes inherited,
  tested, and unsupported operations.
- Document direct official OpenAI client configuration as an interoperability
  option without making it the primary CometAPI experience.

Test and package exit criteria:

- Blocking CI on Node.js 22 and 24.
- Advisory CI on current Node.js 26 until it enters LTS, after which it becomes
  a blocking runtime.
- No support claim for EOL Node.js 18 or 20.
- Strict type checking and mocked contract coverage for URLs, auth,
  serialization, deserialization, errors, retries, timeouts, custom fetch, and
  stream cancellation.
- Minimum-version, locked-development-version, and latest-within-major OpenAI
  dependency checks. The latest lane is a scheduled and dependency-PR canary.
- `publint`, Are the Types Wrong, and package export validation pass.
- Clean installation from the packed tarball into ESM and CommonJS fixtures.
- Installation into a host fixture that already declares a compatible OpenAI
  version; `npm ls openai` reports one effective version and an SDK error
  preserves `instanceof APIError` identity.
- Executed README examples against the packed tarball.
- Low-cost live Chat Completions and Responses smoke tests pass from a trusted
  scheduled workflow.
- Release checks derive the candidate version from `package.json` and require
  exact agreement with the package-lock root, the Release Please manifest or
  documented one-time bootstrap, one changelog heading, the immutable tag,
  GitHub release, and packed package metadata.
- npm publication uses OIDC trusted publishing with provenance, and the public
  artifact passes a post-publication install and mocked-call smoke test.

Completion evidence is recorded in
[RELEASING.md](./RELEASING.md#stable-010-release-evidence). It includes the
reviewed candidate and default-branch CI, the exact immutable release commit,
the bounded release-tag live smoke, OIDC publication, registry signatures and
provenance, byte-identical workflow and registry artifacts, and separate
post-publication ESM, CommonJS, and compatible-OpenAI host fixtures.

Explicit non-goals:

- Reimplementing HTTP, SSE, retry, timeout, or OpenAI protocol models.
- Claiming support for every method inherited from the OpenAI client.
- Browser-side use with a long-lived CometAPI key.
- Provider-neutral message translation.
- Image, video, audio, batch, fine-tuning, and realtime APIs.

## 0.1.1: Options Contract and Release Repair (Complete)

Stable `0.1.1` omitted `provider`, `workloadIdentity`, and
`dangerouslyAllowBrowser` from `CometAPIOptions`, constrained `withOptions`, and
rejected runtime bypasses with a secret-free official `OpenAIError`. That
declaration rejected fresh object literals but still admitted structurally
typed variables; runtime enforcement remained intact. Existing transport,
observability, organization, project, webhook, and admin-key options remained
available, and the supported resource list did not change.

The patch also installs the permanent stable Release Please path with explicit
component identity, patch versioning, pull-request configuration, normal
`v0.1.1` tag and immutable GitHub Release creation, and a trusted `workflow_run`
handoff to immutable-tag-only exact-artifact, bounded-live, and npm OIDC gates.
Its initial preparation used and then removed a one-cycle `0.1.0` history
anchor; that anchor is not part of the permanent configuration. Regression
tests reject stale manifest state, a 0.2 bump, missing PR configuration, an
unrelated stale branch, hostile workflow events, unsafe or mismatched same-run
Release reconciliation attempts, mismatched action outputs, missing final-head
approval, and declaration or runtime option bypasses.

Completion evidence:

- Source and packed ESM/CommonJS declarations passed the then-required fresh
  object-literal TypeScript negative tests, while runtime bypass tests preserved
  official error identity and did not expose option values.
- The repair PR and generated `0.1.1` release PR passed required CI on their
  exact final heads, and a distinct human administrator formally approved the
  action-authored release PR's final head.
- Release Please created the exact immutable `v0.1.1` Release. The bounded
  three-request live smoke and npm OIDC publication completed through the
  disclosed one-time recovery without changing the Registry Alpha `next`
  dist-tag.
- A public-registry install verifies ESM, CommonJS, declarations, supported
  mocked calls, one effective OpenAI installation, API error identity,
  integrity, signatures, and provenance.
- After publication, maintainers restored `RELEASE_PLEASE_ENABLED=false`, kept
  `LIVE_SMOKE_ENABLED=true`, restored the sole `tag:v*` policy, and merged the
  recovery-path cleanup. The evidence is recorded in
  [RELEASING.md](./RELEASING.md#stable-011-release-evidence).

## 0.1.2: Public Contract and Tag-Bound Release Verification (Complete)

Stable `0.1.2` redeclared `provider`, `workloadIdentity`, and
`dangerouslyAllowBrowser` as optional `never` fields on `CometAPIOptions`.
TypeScript negative tests now exercise variables, spreads,
`satisfies ClientOptions`, and constrained generics through both the constructor
and `withOptions`; the secret-free runtime guard remains authoritative for plain
JavaScript and casts. The patch also made the README release-neutral and kept
`package.json` as the sole candidate-version authority without changing the
supported resource surface.

The action-authored, exact-head-approved Release Please PR produced the
immutable tag and GitHub Release. The unprivileged handoff then dispatched the
exact tag, rebuilt and verified the artifact, ran the bounded three-request live
smoke, and published through the tag-only npm Environment with OIDC provenance.
When npm's attestation endpoint briefly returned `404` after successful
publication, the single failed-job replay detected the byte-identical existing
version and completed verification without invoking `npm publish` again.

Post-publication hardening made that observed recovery finite and executable:
handoff, exact-artifact verification, and live smoke are attempt-1-only;
publication permits only an attempt-2 existing-version convergence check; and
attempt 3 or later fails before entering the npm Environment. Release-specific
PR, review, run, artifact, registry, provenance, and final-state evidence is
recorded in [RELEASING.md](./RELEASING.md#stable-012-release-evidence).

## Stable 0.1.x Maintenance

Maintenance patches close contract and release-process gaps without expanding
the supported resource surface. Future maintenance must preserve the strict
reserved-option type and runtime boundary, the release-neutral consumer
documentation, and the immutable-tag publication contract established above.

Durable README, agent, compatibility, roadmap, and release guidance uses 0.1.x
capability and channel language instead of copying a mutable exact version from
the registry. `package.json` is the sole candidate-version authority, the packed
README must match the reviewed source byte-for-byte, and the release gates
reject exact-version current, approval, unpublished, or in-progress claims.

Each maintenance patch is complete only after the normal four-file Release
Please PR, immutable tag and GitHub Release, fresh bounded live smoke, tag-bound
npm OIDC publication, and independent public-registry installation all pass.
Release-specific evidence is recorded after publication rather than predicted
in advance.

## 0.2.0: Provider-Native Text Adapters

Planned scope:

- Anthropic Messages and streaming through an optional peer dependency and an
  isolated `cometapi/anthropic` export.
- Gemini text generation and streaming through an optional peer dependency and
  an isolated `cometapi/gemini` export.
- No static import of optional provider packages from the root entry point.
- Provider-native request, response, and error types.
- Keep `COMETAPI_BASE_URL` specific to the OpenAI-compatible base, defaulting
  to `https://api.cometapi.com/v1`.
- Add `COMETAPI_API_ROOT`, defaulting to `https://api.cometapi.com`, for
  provider-native adapters.
- Resolve provider URLs using explicit constructor value, then
  `COMETAPI_API_ROOT`, then the default. Never strip version suffixes from an
  explicit custom proxy URL.
- Configure Anthropic to reach `/v1/messages` with `x-api-key` and Gemini to
  reach `/v1beta/models/{model}:generateContent` or `:streamGenerateContent`
  with `x-goog-api-key`.

Exit criteria:

- Missing optional dependencies produce actionable installation messages.
- Root bundle size and import behavior remain stable.
- Node.js ESM and CommonJS fixtures cover both provider subpaths.
- Mocked and live contract coverage exists for both provider adapters.
- Contract tests assert the complete resolved provider URL and authentication
  header for default, environment, and explicit constructor configuration.
- The compatibility matrix documents provider SDK versions and tested modes.

## 0.3.0: CometAPI-Specific Resources

Candidate scope:

- Typed balance, usage, profile, or model metadata resources selected from
  stable backend contracts.
- Separate `resources/` and `types/` modules with no public `any` escape hatch.
- Reuse of the configured transport where documented public OpenAI client
  request methods are sufficient.

No resource enters this milestone without an authoritative schema, fixture,
error contract, authentication contract, and live test endpoint.

## Later: Media and Task APIs

Images, video, audio, uploads, polling, cancellation, webhooks, and task status
will be designed together. CometAPI will add a task-oriented surface only with
typed lifecycle states and consistent cancellation, timeout, retry, and error
semantics.

## CI/CD and Release Contract

The repository will maintain:

- `ci.yml` for offline pull-request and default-branch checks.
- `live-smoke.yml` for budgeted trusted compatibility tests from the default
  branch to the pinned CometAPI HTTPS endpoint. Each run is fixed at exactly
  three sequential requests, a 16-token output cap, a 60-second per-request
  timeout, concurrency one, and stop on the first failure.
- `release-please.yml` for the reviewed version and changelog PR and the
  corresponding immutable tag and GitHub Release.
- `publish.yml` for trusted Release Please completion, immutable-release and
  `main`-ancestry enforcement, an unprivileged handoff to the exact immutable
  tag, exact tarball verification, a fresh protected release-tag live smoke,
  npm OIDC publication, and dist-tag, integrity, provenance, signature, and
  registry verification. Only the tag-bound dispatch can reach verification,
  live, or publication authority.

All workflow files must pass local `actionlint`. Stable `0.1.2` completed the
permanent tag-bound publication contract through registry verification. Its
post-publication replay hardening then passed static and mutation checks,
pull-request CI, exact-head owner audit, and default-branch CI.

The initial manual alpha preparation starts with an empty version manifest and
a temporary `release-as: 0.1.0-alpha.1` setting. Its reviewed pull request must
record that version in the manifest and remove `release-as` before merge so
later Release Please prereleases advance normally.

`package.json` is the sole candidate-version authority. Package validation
derives the version from it and checks the lock root, Release Please
manifest-or-bootstrap, single changelog heading, and packed metadata. A normal
stable Release Please PR changes exactly `.release-please-manifest.json`,
`CHANGELOG.md`, `package-lock.json`, and `package.json`; durable documentation
uses 0.1.x capability and channel language instead of candidate-specific
status. Publication additionally checks the immutable tag and GitHub Release
and fails closed while identity or public documentation contains unresolved or
candidate-only values. The publish workflow alone selects the npm dist-tag:
`next` for prereleases and `latest` for stable versions. A static
`publishConfig.tag` is forbidden. Exact public state must be queried from npm
and GitHub.

Scheduled live smoke requires `LIVE_SMOKE_ENABLED=true`; an unset or other
value prevents live execution. Release Please requires
`RELEASE_PLEASE_ENABLED=true` and remains disabled through the initial manual
alpha. These controls are in place before the first remote push.

Stable publication requires a human-reviewed release PR and protected npm
environment approval while the SDK remains pre-1.0. Manual workflows may build
or dry-run packages but may not publish an arbitrary commit.

The manual tag/Release combination used for 0.1.0 is historical evidence, not
the normal patch process. Stable 0.1.x patches require explicit stable
versioning and the `cometapi` component, an action-created and human-reviewed
Release Please PR, and automated immutable tag and GitHub Release creation after
merge. Because the default `GITHUB_TOKEN` cannot cause a second workflow through
a `release.published` event, `publish.yml` starts from successful Release Please
workflow completion and re-establishes trust from exact repository state. The
main-context `workflow_run` can enter only an unprivileged handoff, which
validates the attempt-bound result, immutable Release, tag, and current `main`,
then dispatches the same workflow with `ref=v<version>`. Verification, live
smoke, the npm Environment, and OIDC are reachable only from that tag-bound
`workflow_dispatch`.
Failed pull-request preparation runs are filtered out, while a successful
preparation run whose result-upload step was skipped remains release-inert. Any
purported release handoff without a schema-v2 attempt-bound result, the exact
tag, and immutable Release fails before live or registry access. Only a
successful canonical
attempt-qualified `push` run for the still-current exact `main` SHA can create
the tag handoff. A push retry may reconcile only the same run ID, SHA,
candidate, and exact bot-authored immutable Release published inside one
earlier Release Please step; manual preparation
reruns remain forbidden.

Public Preview needs no registry workflow. Registry Alpha publishes from a
human-reviewed immutable prerelease tag under the `next` dist-tag through OIDC
or, only when npm cannot preconfigure Trusted Publishing, through the one-time
bootstrap below. Stable 0.1.x requires the Release Please flow, full
supported-runtime matrix, version and changelog agreement, package-shape
checks, provenance, executed README examples, and post-publication install
verification.

## First npm Publication Bootstrap

The normal publication path is npm Trusted Publishing from a GitHub-hosted
runner using Node.js 22.14.0 or later, npm CLI 11.5.1 or later, and a
`repository.url` that exactly matches the GitHub repository. Node.js 24 is the
preferred release runtime.

Maintainers must first attempt to configure the Trusted Publisher normally. If
npm does not allow configuration before the first package publication, only
`0.1.0-alpha.1` may use a one-time bootstrap:

1. A maintainer creates a short-lived granular read/write publish token with
   the minimum available scope and non-interactive 2FA bypass from an account
   protected by 2FA.
2. In the protected `npm` environment, set
   `NPM_ALPHA1_BOOTSTRAP_ENABLED=true` and expose the token only as
   `NPM_ALPHA1_BOOTSTRAP_TOKEN` to one reviewed immutable-tag run. The workflow
   rejects that mode unless the version is exactly `0.1.0-alpha.1` and the
   dist-tag is `next`.
3. That run builds and verifies the tag artifact, publishes it with public
   access and provenance, and verifies registry installation.
4. A maintainer immediately configures Trusted Publishing, removes the variable
   and secret, revokes the token, and restricts token-based publishing.
5. The project attempted to publish `0.1.0-alpha.2` through OIDC. Its immutable
   GitHub release passed exact-artifact and live-smoke verification, but the
   local publication guard rejected the fixed `actions/setup-node`
   authentication placeholder before npm was invoked; no alpha.2 registry
   artifact exists.
6. The project preserved that immutable failure record and published
   `0.1.0-alpha.3` through OIDC with regression coverage for the placeholder.
   Provenance, registry signatures, independent installation, ownership, and
   the `next` dist-tag were verified.

This exception must be recorded in the release evidence and must never become
a reusable publication path.

## Maintenance Cadence

- Review upstream OpenAI dependency releases weekly through automated PRs.
- Run live compatibility checks nightly and again for each release candidate.
- Review open security and compatibility issues before every release.
- Review this roadmap at every minor release and at least monthly while a
  milestone is in progress.
- Mark a milestone released only after the npm artifact is independently
  installed and verified.
