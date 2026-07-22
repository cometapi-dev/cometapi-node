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

## Current Milestone: Public Preview

Private Remote Validation is complete, and the current execution target is
Public Preview. Repository-local source, tests, documentation, metadata,
fixtures, workflows, private pull requests, and credential-free CI may be
changed and verified. Stop before changing repository visibility: making the
canonical repository public and configuring or exercising public-only settings,
protected environments, secrets, or live smoke require explicit maintainer
authorization.

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

Before requesting visibility-change authorization:

1. Confirm the current `main` includes every approved private closeout and that
   its blocking Node.js 22 and 24 CI checks pass.
2. Run the complete local offline, package, fixture, compatibility,
   self-containment, public-content, secret, workflow-static-validation, and
   Public Preview gates from the final private `main`.
3. Review open failing dependency-update pull requests before visibility
   changes and repair, close, or explicitly defer them with a recorded reason;
   do not treat their branch failures as evidence that the current `main`
   failed validation.
4. Confirm the repository remains private and that public-only repository or
   tag rules, Private Vulnerability Reporting, secrets, protected environments,
   Trusted Publishing, live smoke, tags, releases, and registry publication
   have not been configured or exercised.
5. Record the final private evidence and stop for explicit maintainer
   authorization before changing repository visibility.

Private repository creation, the sanitized first history, and the initial push
are complete historical steps and must not be repeated. Their procedure and
evidence belong in `RELEASING.md`. Keep Release Please disabled through the
initial manual alpha.

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
- Keep development checks compatible with unresolved maintainer input, but
  make the publish workflow fail closed until maintainers have supplied the
  copyright holder, canonical security and support contacts, repository
  metadata, and release-ready status text in the public documents.
- Never commit credentials, recorded secrets, local dependency directories, or
  generated build artifacts.
- The legal copyright holder and official security and support contacts must be
  maintainer-confirmed and must never be invented.

Before Public Preview, run `npm run check:public-preview`. The gate must fail
after reporting all violations until canonical identity, contacts, repository
metadata, and durable public-facing content are complete.

### First-publication bootstrap

The normal npm release path uses Trusted Publishing on a GitHub-hosted runner
with Node.js 22.14.0 or later, npm CLI 11.5.1 or later, and an exact
`repository.url` match. Node.js 24 is the preferred release runtime.

Maintainers must first attempt normal Trusted Publisher configuration. If npm
does not allow it before the package exists, `0.1.0-alpha.1` alone may use a
short-lived granular read/write token with the minimum available scope and
non-interactive 2FA bypass from an owner account protected by 2FA. Expose it
only through a protected GitHub Environment for one reviewed immutable-tag run,
publish with public access and provenance, then immediately configure OIDC,
remove the secret, revoke the token, restrict token-based publishing, and
publish `0.1.0-alpha.2` through OIDC. Verify its provenance and confirm the
`next` dist-tag resolves to `0.1.0-alpha.2`. Never make this exception a
reusable workflow path.

## Authorization and evidence

Repository-local source, tests, documentation, metadata, fixtures, and workflow
definitions may be changed and verified locally. Remote repositories, pushes,
tags, releases, npm publication, GitHub or registry settings, and live API
requests require explicit maintainer authorization.

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
