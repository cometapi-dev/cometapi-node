# CometAPI TypeScript and Node.js SDK Roadmap

Status: Public Preview pre-visibility complete; visibility change awaiting explicit authorization
Last updated: 2026-07-23
Repository contract: This roadmap is self-contained and is the public source
of truth for this repository's release sequence.

## Product Target

The TypeScript and Node.js SDK will provide a typed CometAPI entry point that
preserves the official OpenAI JavaScript client experience while shipping a
small, auditable package for supported Node.js LTS runtimes.

Private Remote Validation and Public Preview pre-visibility preparation are
complete for the sanitized private repository. The repository remains private
at the visibility authorization gate. Public Preview is not ready until the
visibility transition and all public-only controls and live evidence pass under
separate explicit authorization. The functional `0.1.0-alpha.1` prerelease
remains a separate evidence gate after Public Preview. Registry publication
proceeds only through Private Remote Validation, Public Preview, Registry Alpha,
and stable 0.1.0 stages.

## Milestones

| Milestone                    | Status                 | User outcome                                                                                                                             |
| ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Repository foundation        | In progress            | The repository has reproducible development, contribution, security, and release processes.                                              |
| Private Remote Validation    | Complete               | The sanitized private repository passes real credential-free default-branch CI; public-only controls and live tests remain disabled.     |
| Public Preview               | Awaiting authorization | The public repository has blocking CI, repository rules, security reporting, protected environments, and authorized live-smoke evidence. |
| 0.1.0-alpha.1 Registry Alpha | Planned                | Early adopters can install a functional prerelease from npm's `next` channel and call the three required OpenAI-compatible resources.    |
| 0.1.0 Stable                 | Planned                | Users can install a fully verified package from npm's default channel.                                                                   |
| 0.2.0 provider-native text   | Planned                | Users can opt into Anthropic Messages and Gemini text adapters through isolated subpath exports.                                         |
| 0.3.0 CometAPI resources     | Planned                | Users receive typed access to the first stable CometAPI-specific account or platform resources.                                          |
| Media and task APIs          | Later                  | Users receive typed image, video, audio, upload, polling, and task lifecycle helpers after their contracts are stable.                   |

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

Changing the repository to public begins a short configuration interval; it
does not establish Public Preview readiness by itself. The preview is ready
only when:

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

Explicit non-goals:

- Reimplementing HTTP, SSE, retry, timeout, or OpenAI protocol models.
- Claiming support for every method inherited from the OpenAI client.
- Browser-side use with a long-lived CometAPI key.
- Provider-neutral message translation.
- Image, video, audio, batch, fine-tuning, and realtime APIs.

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
- `release-please.yml` for the reviewed version and changelog PR.
- `publish.yml` for immutable-release and `main`-ancestry enforcement, exact
  tarball verification, a protected release-tag live smoke, npm OIDC
  publication, and dist-tag, integrity, provenance, signature, and registry
  verification.

All workflow files must pass local `actionlint`. Until each workflow executes
successfully in the actual GitHub repository, release reports must state that
remote Actions behavior remains unverified.

The initial manual alpha preparation starts with an empty version manifest and
a temporary `release-as: 0.1.0-alpha.1` setting. Its reviewed pull request must
record that version in the manifest and remove `release-as` before merge so
later Release Please prereleases advance normally.

`package.json` is the local version source. Package validation derives the
version from it and checks the lock root, Release Please manifest-or-bootstrap,
single changelog heading, and packed metadata. Publication additionally checks
the immutable tag and GitHub release and fails closed while the license,
README release status, security or support contacts, or repository identity
still contain unresolved or candidate-only values. The publish workflow alone
selects the npm dist-tag: `next` for prereleases and `latest` for stable
versions. A static `publishConfig.tag` is forbidden.

Scheduled live smoke requires `LIVE_SMOKE_ENABLED=true`; an unset or other
value prevents live execution. Release Please requires
`RELEASE_PLEASE_ENABLED=true` and remains disabled through the initial manual
alpha. These controls are in place before the first remote push.

Stable publication requires a human-reviewed release PR and protected npm
environment approval while the SDK remains pre-1.0. Manual workflows may build
or dry-run packages but may not publish an arbitrary commit.

Public Preview needs no registry workflow. Registry Alpha publishes from a
human-reviewed immutable prerelease tag under the `next` dist-tag through OIDC
or, only when npm cannot preconfigure Trusted Publishing, through the one-time
bootstrap below. Stable 0.1.0 requires the release-please flow, full
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
5. The project immediately publishes `0.1.0-alpha.2` through OIDC, verifies its
   provenance and installation, and confirms that `next` resolves to
   `0.1.0-alpha.2`.

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
