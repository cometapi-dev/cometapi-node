# Releasing

## Release states

Release status is evidence-based:

| State                           | Required evidence                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local code-complete             | Required source, tests, documentation, metadata, fixtures, and workflows exist, and every applicable offline check passes.                                                   |
| Private Remote Validation ready | Local gates pass, the sanitized history and maintainer-confirmed identity are complete, and real credential-free private default-branch CI passes.                           |
| Public Preview ready            | After visibility changes, public-only repository rules, security reporting, environments, default-branch CI, the content gate, and authorized protected live smoke all pass. |
| Registry Alpha candidate        | The exact `0.1.0-alpha.1` artifact passes package and clean-install gates.                                                                                                   |
| Registry Alpha released         | The public npm artifact installs from the `next` channel, passes post-publication verification, and has verified provenance plus any documented one-time bootstrap evidence. |
| Stable released                 | Every stable 0.1.0 local, remote, live, review, provenance, and registry gate has recorded evidence.                                                                         |

A build, mock, valid workflow file, successful upload, or HTTP 200 proves only
its own layer. Never use it to claim a later state.

## Private Remote Validation

Before Public Preview, initialize an empty private repository from a sanitized
first commit. Do not ask GitHub to generate a README, license, or ignore file.
The complete history must already be suitable for public visibility.

Apply these canonical values before the first push:

| Field               | Required value                                                          |
| ------------------- | ----------------------------------------------------------------------- |
| Repository          | `https://github.com/cometapi-dev/cometapi-node`                         |
| Package author      | `CometAPI`                                                              |
| Copyright           | `Copyright (c) 2026 CometAPI`                                           |
| Homepage            | `https://www.cometapi.com`                                              |
| `repository.url`    | `git+https://github.com/cometapi-dev/cometapi-node.git`                 |
| `bugs.url`          | `https://github.com/cometapi-dev/cometapi-node/issues`                  |
| Support and conduct | `support@cometapi.com`                                                  |
| Security            | `https://github.com/cometapi-dev/cometapi-node/security/advisories/new` |

The Public Preview gate and publish validation require the same normalized
`repository.url`. Remove `.github/CODEOWNERS` and its validation dependencies;
it is not required while the project has one active maintainer.

Before the first push, require `LIVE_SMOKE_ENABLED=true` for live execution and
`RELEASE_PLEASE_ENABLED=true` for Release Please. An unset or non-true value
prevents the corresponding workflow from running. Leave both disabled during
Private Remote Validation and leave Release Please disabled through the initial
manual alpha.

The private stage validates sanitized history, the complete local gate, and
real credential-free default-branch CI only. Do not configure or exercise
branch or tag rules, Private Vulnerability Reporting, secrets, protected
environments, Trusted Publishing, live API calls, tags, releases, or registry
publication. Record the CI result and stop before changing visibility.

Run the fail-closed content and identity gate before the first remote push and
again before changing repository visibility:

```bash
npm run check:public-preview
```

## Authorization boundary

Maintainers may prepare source, tests, documentation, metadata, fixtures,
workflow definitions, changelog entries, release PR content, and dry-run
artifacts. Authorized maintainers must supply or approve:

- Changes to the canonical identity and contact values listed above
- Repository creation and visibility, branch/tag protections, environments,
  secrets, and environment approval policies
- npm package ownership for the maintainer-confirmed `cometapi-team` account
  and Trusted Publisher configuration
- A `COMETAPI_KEY`, request budget, and explicit authorization for live smoke
  tests
- Immutable public tags, GitHub releases, environment approvals, and npm
  publication

Missing identity, credentials, ownership, or authorization blocks the
corresponding release gate. Do not invent it or replace it with a mock.

The `cometapi` package does not exist in the public registry yet, so npm cannot
verify its owner before the first publication. Registry Alpha owner evidence is
complete only when `npm owner ls cometapi` lists the maintainer-confirmed
`cometapi-team` account after bootstrap; until then this remains a Registry
Alpha prerequisite, not a Public Preview blocker.

For the current milestone, authorized external actions stop at creating the
empty private repository, pushing its sanitized first history, and observing
credential-free CI. Visibility changes and every subsequent external action
require separate authorization.

## Candidate verification gate

Run from the repository root on a clean checkout:

```bash
npm ci
npm run build
npm test
npm run typecheck
npm run lint
npm run format:check
npm run test:package
npm run test:live-contract
npm run test:fixtures
npm run test:compat
npm run check:standalone-content
npm run check:self-contained
npm run actionlint
npm run verify
```

The individual commands remain documented even if `npm run verify` aggregates
them. The verification record includes exact commands and outcomes, including
failures, skipped checks, and unavailable runtime/tool checks.

`npm run test:package` builds and inspects a candidate tarball and runs package
metadata, export, declaration, `publint`, Are the Types Wrong, and dry-run pack
checks. `npm run test:fixtures` installs a candidate tarball into clean ESM,
CommonJS, and compatible-OpenAI host applications. Both commands accept
`--tarball <path>` so the publication workflow can pack once, inspect and
install the exact artifact, then upload that same file. `npm run test:compat`
covers the minimum, locked, and applicable canary dependency lanes with ESM and
CommonJS runtime checks plus `.mts` and `.cts` consumer type checks.

`npm run check:self-contained` copies repository files into an empty temporary
parent, scans documentation and configuration for outside-root dependencies, and
runs the documented offline setup and tests from the copied root.

`npm run test:live-contract` uses mocked transport to prove the bounded live
runner rejects empty Chat results and failed, incomplete, or unterminated
Responses streams. It never contacts the production API.

`npm run actionlint` uses the repository-pinned actionlint version to statically
validate every workflow. It is not a GitHub Actions emulator and does not prove
that any workflow executed remotely.

## Version and dist-tag agreement

`package.json` is the source of the candidate version; validation must not
hard-code a second version as an independent authority. Before release, local
package checks derive that value and require:

1. The package-lock root name and version to match `package.json`.
2. Either the Release Please manifest to match, or, for the first release only,
   an empty manifest plus `release-as` matching the candidate version.
3. Exactly one changelog heading for the candidate. It may remain `Unreleased`
   during prerelease preparation.
4. The packed package metadata name, version, dependency range, and runtime
   contract to match the source manifest.

The release workflow then requires the Release Please manifest to equal the
candidate, the one-time `release-as` bootstrap to be absent, the changelog
heading to be uniquely dated, the immutable tag to be `v<version>`, the GitHub
release to refer to that tag and have the correct prerelease state, and the
uploaded tarball metadata to contain the same version. Maintainer-supplied identity
metadata changes the artifact and therefore requires all exact-artifact checks
to run again.

The workflow is the sole source of npm dist-tag selection: a version containing
a prerelease component publishes to `next`, and a stable version publishes to
`latest`. `package.json` must not define a static `publishConfig.tag`.

## Releasable documentation and identity gate

Development checks may run before public identity is complete, but the
publication path is fail-closed: `publish.yml` invokes
`scripts/validate-release.mjs --require-releasable-docs` and fails before build,
live smoke, or registry access unless all of these conditions hold:

1. `LICENSE` contains a maintainer-supplied copyright year and holder with no
   placeholder.
2. `README.md` removes every local, unpublished, and pending-owner status and
   explicitly states `<version> is approved for npm publication`.
3. `SECURITY.md` and `SUPPORT.md` remove stale candidate status and each contain
   a maintainer-supplied canonical email address or GitHub repository contact URL.
4. The candidate's dated `CHANGELOG.md` section contains no candidate-only
   release evidence such as unperformed publication or pending ownership.
5. The separate immutable-release trust check confirms that `package.json`
   `repository.url` and `bugs.url` exactly match the publishing GitHub
   repository.

The Public Preview variant collects and reports every violation in one run and
then returns non-zero if any violation exists. It must require
`git+https://github.com/cometapi-dev/cometapi-node.git` as `repository.url`, the
same value required by publish validation.

Maintainers perform this transition in the reviewed release PR before creating
or publishing the immutable release. Validate the exact committed state with:

```bash
node scripts/validate-release.mjs \
  --tag v0.1.0-alpha.1 \
  --release-prerelease true \
  --require-final \
  --require-releasable-docs
```

Changing identity or public status text after artifact verification invalidates
that evidence; rebuild and rerun every exact-artifact check.

## Workflow contract

The repository maintains four independently auditable workflows:

- `ci.yml`: credential-free pull-request and default-branch checks on Node.js 22
  and 24, with Node.js 26 advisory.
- `live-smoke.yml`: trusted scheduled and manual default-branch-only low-cost
  compatibility tests against the pinned CometAPI HTTPS endpoint. Each run makes
  exactly three sequential requests, caps generated output at 16 tokens, applies
  a 60-second timeout to each request, fixes concurrency at one, and stops on the
  first failure. Standalone and release smoke jobs share one repository-wide
  concurrency group. Scheduled and manual live execution requires
  `LIVE_SMOKE_ENABLED=true`.
- `release-please.yml`: a human-reviewed version and changelog PR from
  Conventional Commits and requires `RELEASE_PLEASE_ENABLED=true`. It remains
  disabled through the initial manual alpha. Merging a later release PR prepares
  a draft GitHub release; a maintainer must review and publish the draft so its
  `release.published` event can trigger publication.
- `publish.yml`: rejects mutable releases and tag commits outside `main`, packs
  and tests one exact artifact, requires a protected live smoke for that release
  tag, publishes the same file through npm OIDC, and verifies the dist-tag,
  integrity, provenance attestation, signatures, deduplication, and public
  installation. A rerun resumes after an already accepted version only when its
  registry integrity matches the downloaded artifact, then repeats all bounded
  registry-state and signature checks.

Third-party actions are pinned to full commit SHAs. Workflow permissions remain
read-only except where a documented job requires more; `id-token: write` belongs
only to the publish job. Publication cannot run from an arbitrary branch or an
unreviewed commit.

The supported package `engines` range contains Node.js 22 and 24 only. Node.js
26 remains an advisory workflow target until it enters LTS; Node.js 18 and 20
remain unsupported.

The repository has no prior release, so the manifest is intentionally empty and
`release-please-config.json` temporarily sets `release-as` to
`0.1.0-alpha.1`. The reviewed manual alpha pull request must set the manifest to
`0.1.0-alpha.1`, consolidate the existing candidate changelog entry, and remove
`release-as` before merge. Leaving `release-as` in the default branch would
incorrectly pin later releases. The publication workflow fails unless the
manifest equals the package version, `release-as` is absent, and the version
has exactly one dated changelog heading.

## Registry Alpha (`0.1.0-alpha.1`)

The first npm artifact must be functional and published under the `next`
dist-tag. Before authorizing release:

1. Complete Private Remote Validation, record real credential-free CI, and stop
   for explicit visibility-change authorization.
2. After the repository becomes public, require pull requests and blocking CI
   for `main` with zero required approvals, block force pushes and deletion,
   reserve administrator bypass for emergencies, protect version tags from
   updates and deletion, and enable immutable releases and Private
   Vulnerability Reporting.
3. Configure `live-smoke` with no required reviewer and `npm` with approval by
   the current release approver and self-review allowed. Set
   `LIVE_SMOKE_ENABLED=true`, rerun default-branch CI, run the authorized live
   smoke, and record Public Preview readiness only after all public gates pass.
4. Prepare the initial alpha through a reviewed manual pull request while
   Release Please remains disabled. Make the manifest record
   `0.1.0-alpha.1`, remove the one-time `release-as` setting, date and normalize
   the changelog entry, update release-status text, and require the canonical
   repository and contact metadata.
5. Derive `0.1.0-alpha.1` from `package.json` and confirm agreement with the
   lock root, manifest, changelog heading, intended `v0.1.0-alpha.1` tag,
   GitHub prerelease state, and packed metadata.
6. Run every local gate on the exact candidate, inspect and retain the exact
   tarball, install it into clean ESM, CommonJS, and compatible-OpenAI host
   fixtures, and confirm one effective OpenAI dependency plus
   `APIError instanceof` identity.
7. Attempt normal npm Trusted Publisher configuration for the canonical
   repository, workflow, and `npm` environment before considering the
   conditional bootstrap.
8. Review the exact candidate, create `v0.1.0-alpha.1`, and publish the matching
   immutable GitHub prerelease.
9. Let the release workflow verify `immutable: true`, `main` ancestry, the
   exact tarball, and the trusted release-tag live smoke: exactly three
   sequential requests, 16 output tokens, 60 seconds per request, concurrency
   one, and stop on the first failure.
10. Approve publication of that same tarball through the protected `npm`
    environment with OIDC and provenance, or use the one-time alpha.1 bootstrap
    only when normal Trusted Publishing cannot create the new package. The
    workflow selects `next`; no static package-manifest dist-tag participates.
11. Install `cometapi@next` from npm and run an independent import and mocked
    call before marking the alpha released. Enable Release Please only after
    the initial manual alpha is complete.

The normal publication runner uses Node.js 22.14.0 or later and npm CLI 11.5.1
or later; Node.js 24 is preferred. npm Trusted Publishing requires the manifest
`repository.url` to match the canonical GitHub repository exactly. Publication
is blocked until that canonical URL is configured.

## Conditional first-publication bootstrap

Maintainers must first attempt normal Trusted Publisher configuration. If npm
does not permit it before the package exists, only `0.1.0-alpha.1` may use this
one-time exception:

1. A maintainer creates a short-lived granular read/write token with minimum
   scope and non-interactive 2FA bypass from an account protected by 2FA.
2. In the protected `npm` environment, set
   `NPM_ALPHA1_BOOTSTRAP_ENABLED=true` and expose the token only as
   `NPM_ALPHA1_BOOTSTRAP_TOKEN` to one reviewed immutable-tag run. The workflow
   rejects the bootstrap for every version except `0.1.0-alpha.1`, requires the
   `next` dist-tag, and fails if the token is absent when publication is needed.
3. That run verifies and publishes the exact artifact with public access and
   provenance, then verifies registry installation.
4. A maintainer immediately configures OIDC, removes the environment variable
   and secret, revokes the token, and restricts token-based publishing.
5. The project immediately prepares and publishes `0.1.0-alpha.2` through
   OIDC, verifies its provenance and public installation, and confirms that
   `next` resolves to `0.1.0-alpha.2`.
6. The release record documents the exception and both public-install evidence
   layers.

This exception must never become a reusable source-controlled publishing path.

## Stable 0.1.0 sequence

```text
feature or fix pull request
  -> required offline CI
  -> merge to the protected default branch
  -> automated release PR
  -> human review and merge
  -> immutable tag and GitHub release
  -> rebuild and verify exact artifact
  -> protected release-tag live smoke
  -> OIDC publication with provenance
  -> dist-tag, integrity, provenance, signature, and public-install verification
  -> roadmap milestone marked released
```

Stable release additionally requires the complete supported-runtime matrix,
executed README examples against the packed artifact, release-PR/tag/changelog/
manifest version agreement, reviewed security and compatibility status, and
post-publication registry evidence.

## Verification record

Every release candidate records these evidence layers separately:

- Completed local checks and their exact commands
- Failed checks and implementation defects
- Skipped or unavailable checks
- Unmet release prerequisites
- Real GitHub Actions evidence
- Trusted live API evidence
- npm ownership and Trusted Publisher evidence
- Tag, release, provenance, publication, and post-publication evidence

Only a publicly installed and verified npm artifact may be called released.
