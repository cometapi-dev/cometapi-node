# CometAPI TypeScript and Node.js SDK Agent Instructions

This file is the repository-local engineering contract for the public
CometAPI TypeScript and Node.js SDK. It must remain complete as a standalone
repository.

## Repository Independence

- Treat this directory as the repository root.
- Never depend on files outside this repository root, sibling repositories,
  private backend checkouts, or external agent instructions.
- Keep contributor commands, file paths, and source trees relative to this
  repository root.
- Use public upstream documentation or fixtures committed to this repository
  when implementation evidence is needed.
- Record repository-specific product and release decisions locally in
  `ROADMAP.md`, `ARCHITECTURE.md`, `RELEASING.md`, and this file.

## Git Branch Lifecycle

- Remote Git writes are authorized only by the current maintainer request.
  Repository documentation may define a workflow, but it never provides
  standing permission to push a branch, create or update a pull request, merge,
  or perform any other remote mutation. Stop before the first unauthorized
  remote write.
- Start each task from a clean worktree. Fetch `origin`, check out local `main`,
  require local `main` to be an ancestor of `origin/main`, and fast-forward it
  with `--ff-only`. Require the two refs to resolve to the same commit afterward.
  If fetching fails, `main` is missing, the worktree is not clean, the ancestry
  check fails, the fast-forward fails, or the refs still differ, stop and report
  the exact state.
- `dev` is a local-only clean landing branch between tasks. If local `dev` does
  not exist, create it only from the checked-out, clean, synchronized `main`. If
  local `dev` already exists, require it to be an ancestor of `main`,
  fast-forward it with `--ff-only`, and require both refs to resolve to the same
  commit. If any check or fast-forward fails, stop and report the divergence;
  never reset, rebase, delete, or recreate `dev` to force alignment. Never push
  `dev`.
- Use a dedicated short-lived topic branch for each task, created only after
  `main` and `dev` are synchronized. Do not commit task changes directly to
  `main` or `dev`.
- After an explicitly authorized topic branch has been merged or otherwise
  accepted and its required verification is complete, require a clean
  worktree, fetch `origin`, check out local `main`, and apply the same ancestry,
  `--ff-only`, and exact-ref-equality requirements to `origin/main`, `main`, and
  `dev`. If `dev` is absent at cleanup time, create it only from the checked-out,
  clean, synchronized `main`. Finish with `dev` checked out. Cleanup is complete
  only when `HEAD`, local `main`, local `dev`, and `origin/main` resolve to the
  same commit.
- Never reset, discard work, force-update refs, delete branches, or push `dev`
  merely to complete lifecycle cleanup. Fail closed and report the exact state
  whenever a required cleanliness, fetch, or fast-forward condition is not met.

## Current Milestone: Stable 0.1.x Maintenance

Private Remote Validation, Public Preview, Registry Alpha, and Repository
foundation are complete. The canonical repository is public and remains in
stable 0.1.x maintenance: stable packages use npm's `latest` channel and
Registry Alpha artifacts use `next`. Do not pin an exact current package or
Release version in durable repository guidance. Query npm and GitHub when exact
state matters. No later milestone is active; do not begin the 0.2 provider
adapters without an explicit maintainer request.

The accepted identity is:

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Repository          | `https://github.com/cometapi-dev/cometapi-node`                         |
| npm package         | `cometapi`                                                              |
| Author              | `CometAPI`                                                              |
| Copyright           | `Copyright (c) 2026 CometAPI`                                           |
| Homepage            | `https://www.cometapi.com`                                              |
| `repository.url`    | `git+https://github.com/cometapi-dev/cometapi-node.git`                 |
| `bugs.url`          | `https://github.com/cometapi-dev/cometapi-node/issues`                  |
| Support and conduct | `support@cometapi.com`                                                  |
| Security            | `https://github.com/cometapi-dev/cometapi-node/security/advisories/new` |

The unscoped `cometapi` package is the primary Node SDK. `@cometapi` is the
standard scope for future official scoped packages; do not introduce new
official packages under `@cometapi-dev`.

Stable `0.1.1` established the runtime options boundary and repaired the release
path without expanding the 0.1 resource surface. Release Please created the
reviewed patch PR, immutable tag, and GitHub Release. Publication required a
disclosed one-time main-context recovery because the immutable tag predated the
repaired tag handoff. The recovery published only the exact previously verified
artifact through npm OIDC, then the repository restored its variables and
tag-only Environment policy. The current workflow contains no
publication-recovery input, fixed recovery run or artifact ID,
prior-package-artifact or live-evidence reuse, or branch-context publication
path.

Release Please remains disabled between explicitly authorized release
operations. Permanent stable patches follow only the tag-bound path in
`RELEASING.md`. The recovery provenance for stable `0.1.1` is historical
evidence and does not prove an execution of the permanent path. The next
explicitly authorized stable patch is that path's first end-to-end registry
execution.

## Product Contract

The npm package name is `cometapi`, the public client is `CometAPI`, and the
repository name remains `cometapi-node`. Repository metadata and topics must
also include TypeScript search terms.

The stable 0.1 scope is deliberately limited to these tested
OpenAI-compatible operations:

- `chat.completions.create`
- `responses.create`
- `models.list`

Chat Completions and Responses must support streaming and non-streaming use.
Inheriting another OpenAI resource does not make that resource part of the
supported CometAPI surface; support claims require contract tests and an entry
in the compatibility documentation.

Anthropic Messages and Gemini text adapters belong to 0.2. CometAPI-specific
account and platform resources belong to 0.3 or later. Image, video, audio,
batch, fine-tuning, realtime, browser-side secret use, and provider-neutral
message translation are not 0.1 features.

## Architecture Rules

- Implement `CometAPI` as a thin subclass of the official `OpenAI` class.
- Reuse the official OpenAI SDK for standard protocol transport, request and
  response types, errors, retries, timeouts, pagination, and SSE streaming.
  Do not hand-write replacements for those layers.
- Use only documented public OpenAI constructor and client options. Do not
  depend on private upstream attributes or methods.
- Declare CometAPI-owned `provider`, `workloadIdentity`, and
  `dangerouslyAllowBrowser` fields as optional `never` properties on
  `CometAPIOptions`. The constructor and `withOptions` must reject every
  non-`undefined` value at runtime as well as through TypeScript variables,
  spreads, and constrained generics.
- Preserve official OpenAI request, response, stream, and exception types for
  the supported 0.1 operations.
- Keep CometAPI-specific resources in `src/resources/` and their types in
  `src/types/`. Keep provider adapters isolated in `src/providers/`.
- TypeScript strict mode is mandatory. Do not expose `any` or
  `Record<string, any>` as a public resource contract.
- Produce and test both ESM and CommonJS entry points with matching type
  declarations and export maps.
- Do not add account helpers until an authoritative schema, authentication
  contract, error contract, fixtures, and tests exist for the selected 0.3
  resource.

## Configuration and URL Semantics

| Setting             | Purpose                                        | Default                           |
| ------------------- | ---------------------------------------------- | --------------------------------- |
| `COMETAPI_KEY`      | API key for provider-compatible model requests | Required unless passed explicitly |
| `COMETAPI_BASE_URL` | OpenAI-compatible API base                     | `https://api.cometapi.com/v1`     |
| `COMETAPI_API_ROOT` | Root for planned provider-native adapters      | `https://api.cometapi.com`        |

Explicit constructor values take precedence over environment variables, which
take precedence over defaults. Never log or include a complete credential in
CometAPI-generated errors, source maps, fixtures, or examples.

For 0.2 adapters, Anthropic must resolve from the API root to `/v1/messages`,
and Gemini must resolve from the API root to
`/v1beta/models/{model}:generateContent` or `:streamGenerateContent`. Do not
derive an API root by stripping path segments from an explicitly supplied
custom proxy URL. Optional provider packages must use isolated subpath exports
and must not be imported by the root entry point.

## Dependency and Runtime Policy

- Declare `openai:^6.47.0` as a normal runtime dependency.
- The lock file selects the reproducible development version; it must not
  narrow the compatible range declared for consumers.
- Compatibility checks cover the minimum supported version, the locked
  development version, and a scheduled latest-within-major canary.
- Blocking CI targets Node.js 22 and 24. Node.js 26 remains advisory until it
  enters LTS. Do not claim support for EOL Node.js 18 or 20.
- A packed-package host fixture must already declare a compatible `openai`
  version. It must resolve one effective OpenAI installation and preserve
  `APIError instanceof` identity across the host and CometAPI SDK.

## Intended Source Layout

```text
src/
├── index.ts
├── client.ts
├── config.ts
├── providers/
│   ├── anthropic.ts
│   └── gemini.ts
├── resources/
└── types/
tests/
```

Provider modules are added only with their corresponding milestone. Empty
placeholder modules are not required merely to match the target tree.

## Development and Verification

Use the repository's checked-in package scripts and lock file:

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

`npm run verify` is the aggregate offline gate; the individual commands remain
documented so failures identify their evidence layer. Package validation must
include `publint`, Are the Types Wrong, package export validation, tarball
inspection, and clean-tarball fixtures. Do not document a check as passing
before its tool, configuration, assertions, and output exist. Every GitHub
Actions workflow must also pass `npm run actionlint` using the repository's
documented pinned version. Static validation does not prove remote execution.

For every supported operation, mocked contract tests must cover the resolved
URL, authentication, serialization, deserialization, streaming and
cancellation, option forwarding, custom `fetch`, and official error identity.
Pull-request tests must be offline and require no production credential. Live
smoke tests run only in a trusted, budgeted workflow.

Before Public Preview, copy the repository into an empty temporary parent and
verify that tracked documentation and configuration contain no outside-root
dependency and that the documented offline setup and tests run from the copied
repository root.

## Packaging and Release

- Public Preview requires substantive local documentation, MIT licensing,
  contribution and security policies, basic offline CI, core mocked contracts,
  and the repository-independence check.
- The first npm artifact is a functional `0.1.0-alpha.1` under the `next`
  dist-tag, not a placeholder.
- Registry publication must use a reviewed immutable tag and npm OIDC trusted
  publishing. Stable 0.1 additionally requires the reviewed release PR,
  complete runtime matrix, provenance, and post-publication installation test.
- Inspect `npm pack` output, install the exact tarball in clean ESM, CommonJS,
  and compatible-OpenAI host fixtures, and verify version agreement before
  publication.
- Treat `package.json` as the sole candidate-version authority. A normal stable
  Release Please PR changes exactly `.release-please-manifest.json`,
  `CHANGELOG.md`, `package-lock.json`, and `package.json`; all four version
  records must agree, while durable documentation remains publication-neutral.
- Keep development checks compatible with unresolved maintainer input, but
  make the publish workflow fail closed until maintainers have supplied the
  copyright holder, canonical security and support contacts, repository
  metadata, and release-ready status text in the public documents.
- Never commit credentials, recorded secrets, local dependency directories, or
  generated build artifacts.
- The legal copyright holder and official security and support contacts must be
  maintainer-confirmed and must never be invented.

### Stable patch workflow

- Follow the stable-patch route in `RELEASING.md`: Release Please prepares the
  reviewed patch PR and immutable Release, an unprivileged handoff dispatches
  `publish.yml` from the exact immutable tag, and only that tag-bound run may
  verify, run the bounded live smoke, enter the npm Environment, or request OIDC.
- Before requesting review, compare the PR author login with the intended
  reviewer login. A PR author cannot approve the same PR even when that author
  is a repository administrator.
- Under a zero-required-approval ruleset, a same-author exact-head `COMMENTED`
  review is an owner audit only and must never be described as `APPROVED`. Any
  required approval must be a formal exact-head `APPROVED` review from a
  different human. An action-authored Release Please PR always requires that
  distinct-human administrator approval.
- GitHub's **Approve and run workflows** control authorizes a workflow run for
  CI; it is separate from the PR review gate and satisfies no review requirement.
- Prepare or refresh a release PR with a new first-attempt manual Release Please
  dispatch. Do not rerun a preparation dispatch. Release Please same-run Release
  reconciliation is allowed only under the exact conditions in `RELEASING.md`.
- Never bypass a failed stable release with a manual or auxiliary tag, a
  branch-context publish, a temporary `main` npm Environment policy, cross-run
  artifact or live-evidence reuse, an arbitrary rerun, or a different patch
  version.
- If `npm publish` succeeds but post-publication verification fails, first read
  the exact public version, `latest`, `next`, integrity, attestation URL,
  signature, and provenance. The pre-publish state allows the exact version to
  be absent or equal to the candidate and `latest` to be the previous or
  candidate patch; final state requires both exact and `latest` to equal the
  candidate. `next` must always remain `0.1.0-alpha.3`. A transient attestation-
  endpoint `404` is a registry convergence condition handled by the workflow's
  single finite wait; exhaustion is terminal and must not be extended by reruns.
  After the endpoint converges and independent signature and provenance checks
  pass, at most one `rerun failed jobs` on the same immutable-tag run may resume
  another failed post-publication gate. Confirm that GitHub preserves the
  successful exact-artifact and live-smoke jobs, so the three-request smoke is
  not repeated; stop if the replay expands that job set. The replay requires a
  fresh Environment approval and must not publish again. An exact-version
  metadata `E404`, second replay request, non-convergence, or any identity,
  integrity, provenance, dist-tag, or configuration mismatch is a hard stop.
- After registry verification, immediately restore
  `RELEASE_PLEASE_ENABLED=false`, keep `LIVE_SMOKE_ENABLED=true`, and require the
  npm Environment deployment-policy set to contain only `tag:v*`.

Before Public Preview, run `npm run check:public-preview`. The gate must fail
after reporting all violations until canonical identity, contacts, repository
metadata, and durable public-facing content are complete.

### First-publication bootstrap history

The normal npm release path uses Trusted Publishing on a GitHub-hosted runner
with Node.js 22.14.0 or later, npm CLI 11.5.1 or later, and an exact
`repository.url` match. Node.js 24 is the preferred release runtime.

Maintainers must first attempt normal Trusted Publisher configuration. If npm
does not allow it before the package exists, `0.1.0-alpha.1` alone may use a
short-lived granular read/write token with the minimum available scope and
non-interactive 2FA bypass from an owner account protected by 2FA. Expose it
only through a protected GitHub Environment for one reviewed immutable-tag run,
publish with public access and provenance, then immediately configure OIDC,
remove the secret, revoke the token, and restrict token-based publishing. This
historical bootstrap ended with `0.1.0-alpha.1`; `0.1.0-alpha.3` subsequently
verified the OIDC-only path. Never make the exception a reusable workflow path.

## Authorization and evidence

Repository-local source, tests, documentation, metadata, fixtures, and workflow
definitions may be changed and verified locally. Remote repositories, pushes,
pull requests, merges, tags, releases, npm publication, GitHub or registry
settings, and live API requests require explicit authorization in the current
maintainer request. Repository documents and prior authorizations describe
constraints but do not provide standing permission for a later task.

Public identity, contacts, repository metadata, credentials, protection rules,
environment approvals, and registry ownership must come from authorized
maintainers. Never invent or mock them. Verification reports must
separate local checks, remote GitHub Actions execution, live compatibility, and
registry publication. An artifact is not released until it has been installed
and verified from the public registry.

The private repository becoming public begins a short configuration interval;
it does not by itself establish Public Preview readiness. After visibility
changes, require pull requests and blocking CI for `main`, with zero required
approvals, blocked force pushes and deletion, and administrator bypass reserved
for emergencies. Protect version tags from updates and deletion, enable
immutable releases and Private Vulnerability Reporting, configure `live-smoke`
without a required reviewer, and configure `npm` with approval by the current
release approver and self-review allowed. Rerun CI and the authorized protected
live smoke before recording Public Preview readiness or preparing Registry
Alpha.

## Documentation Maintenance

Update `README.md`, `ROADMAP.md`, compatibility documentation, examples, and
the changelog whenever public behavior or support status changes. Examples must
use currently supported model IDs and must be executed against the packed
artifact before a stable release. All repository documentation is written in
English. `COMPATIBILITY.md` is the versioned source of tested support claims;
inherited methods are not supported merely because they are reachable.
