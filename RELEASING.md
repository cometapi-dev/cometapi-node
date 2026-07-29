# Releasing

## Release states

Release status is evidence-based:

| State                           | Required evidence                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local code-complete             | Required source, tests, documentation, metadata, fixtures, and workflows exist, and every applicable offline check passes.                                                   |
| Private Remote Validation ready | Local gates pass, the sanitized history and maintainer-confirmed identity are complete, and real credential-free private default-branch CI passes.                           |
| Public Preview ready            | After visibility changes, public-only repository rules, security reporting, environments, default-branch CI, the content gate, and authorized protected live smoke all pass. |
| Registry Alpha candidate        | The exact `0.1.0-alpha.3` artifact passes package and clean-install gates after preserving the unpublished immutable alpha.2 failure record.                                 |
| Registry Alpha released         | The public npm artifact installs from the `next` channel, passes post-publication verification, and has verified provenance plus any documented one-time bootstrap evidence. |
| Stable released                 | Every stable 0.1.0 local, remote, live, review, provenance, and registry gate has recorded evidence.                                                                         |
| Stable patch candidate          | An action-created Release Please PR has the exact version, changelog, manifest, temporary-anchor removal, complete CI matrix, and human-owner review.                        |
| Stable patch released           | The immutable Release Please tag and GitHub Release, bounded live smoke, npm OIDC publication, and independent public-registry verification all pass.                        |

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
- npm package ownership for the maintainer-confirmed `cometapi_dev` account
  and Trusted Publisher configuration
- A `COMETAPI_KEY`, request budget, and explicit authorization for live smoke
  tests
- Immutable public tags, GitHub releases, environment approvals, and npm
  publication

Missing identity, credentials, ownership, or authorization blocks the
corresponding release gate. Do not invent it or replace it with a mock.

The `cometapi` package exists in the public registry. Registry Alpha owner
evidence is complete only when `npm owner ls cometapi` lists the
maintainer-confirmed `cometapi_dev` account; until then this remains a Registry
Alpha prerequisite.

Public Preview, Registry Alpha, and stable `0.1.0` are complete. Future topic
pushes, pull requests, merges, immutable GitHub Releases, bounded live smoke,
npm publication, and environment approvals require authorization from the
current maintainer request. This document defines allowable mechanics but
grants no standing remote-write permission.

## Candidate verification gate

Run from the repository root on a clean checkout:

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

The individual commands remain documented even if `npm run verify` aggregates
them. The verification record includes exact commands and outcomes, including
failures, skipped checks, and unavailable runtime/tool checks.

`npm run test:package` builds and inspects a candidate tarball and runs package
metadata, export, declaration, `publint`, Are the Types Wrong, and dry-run pack
checks. `npm run test:examples` installs one exact tarball with the locked OpenAI
version, checks dependency deduplication, and executes the canonical README ESM
and CommonJS examples with fail-closed mocked transport.
`npm run test:fixtures` installs a candidate tarball into clean ESM,
CommonJS, and compatible-OpenAI host applications. Both commands accept
`--tarball <path>` so the publication workflow can pack once, inspect and
install the exact artifact, then upload that same file. `npm run test:compat`
covers the minimum, locked, and applicable canary dependency lanes with ESM and
CommonJS runtime checks plus `.mts` and `.cts` consumer type checks.

`npm run test:secrets` fails on a shallow Git clone and scans the current tracked
tree plus reachable Git blobs, commit and tag messages, and historical paths.
It reports only the rule and a safe object identifier or path hash rather than a
matched value.

`npm run check:standalone-content` fails on a shallow Git clone, materializes
every unique tracked tree reachable from all local refs and `HEAD` without
honoring export exclusions, and reports the commit and tree for every
outside-root or private-content violation. In the isolated self-containment copy
it scans that exact file tree because Git metadata is intentionally absent.

`npm run check:self-contained` requires a clean tracked worktree, materializes
the exact `HEAD` tree into an empty temporary parent, scans documentation and
configuration for outside-root dependencies, and runs the documented offline
setup and tests from the copied root. Untracked local files cannot satisfy a
missing repository dependency.

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
  --tag v0.1.0 \
  --release-prerelease false \
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
- `release-please.yml`: patch-only versioning, an explicit `cometapi` branch
  component, separate pull requests, and the pinned root-package title
  `chore(main): release <version>`. It requires
  `RELEASE_PLEASE_ENABLED=true` and uses the default `GITHUB_TOKEN`. The
  authorized repository baseline keeps default workflow permissions read-only
  and allows Actions to create pull requests; it does not make bot review valid
  release approval. A manual dispatch is attempt-1-only, runs with GitHub Release
  creation disabled, and prepares exactly one action-authored patch PR after the
  variable is enabled. A new dispatch may revalidate an unchanged canonical PR
  even when Release Please returns no PR output. The preparation run succeeds
  only after independently verifying the canonical branch, title,
  machine-readable body, pending label, four expected release files, and 0.1.x
  patch versions. Before a post-merge `push` may create a Release, the workflow
  scans every merged `main` PR carrying `autorelease: pending`, rejects legacy,
  alternate, fork, older, or multiple candidates, and requires an
  administrator's human approval on the exact final head. A same-run push retry
  may proceed only for the same run ID, SHA, candidate, and review. An existing
  tag and Release are accepted only as the exact bot-authored immutable Release
  whose publication time falls within exactly one executed Release Please step
  from an earlier attempt of that run. Release Please then creates or recovers
  the normal tag and GitHub Release, verifies its notes byte-for-byte against the
  normalized `CHANGELOG` entry, reconciles the release label, and uploads a
  schema-v2 attempt-qualified result artifact.
  The triggering SHA must still equal the fetched `main` tip at checkout and
  immediately before the Release Please action; an older queued run stops before
  mutation.
  This flow does not introduce a PAT or GitHub App credential.
  Component identity remains internal to release discovery:
  `include-component-in-tag=false` requires the exact public `v<version>` tag.
  The workflow has contents, pull-request, and issue permissions only for those
  repository operations; it has no npm OIDC permission.
- `publish.yml`: starts only after successful completion of the trusted Release
  Please workflow for `main`. This indirection is required because a GitHub
  Release created with the default `GITHUB_TOKEN` does not trigger a new
  `release.published` workflow. The handoff accepts only the canonical
  repository's successful attempt-qualified `push` run for the still-current
  exact `main` SHA. It downloads the output artifact from that exact upstream
  run ID and attempt and requires schema version, normalized action outcome,
  recovery state, pre-action Release presence, exact Release-producing attempt,
  SHA, tag, version, URL, repository, workflow path, run ID, and attempt to agree
  before accepting the
  matching version tag and immutable GitHub Release. A successful manual
  preparation run is release-inert and cannot enter publication; a successful
  `push` run without the exact release result fails before live or publication
  work. The release path then packs and tests one exact, attempt-qualified
  artifact, runs the protected release live smoke, and publishes the same file
  through npm OIDC. Registry token credentials are rejected. Re-running all jobs
  creates a new attempt-qualified artifact, while re-running failed downstream
  jobs consumes the already verified producer attempt. Publication resumes after
  an already accepted version only when its registry integrity matches the
  downloaded artifact, then repeats every bounded registry-state and signature
  check.

Third-party actions are pinned to full commit SHAs. Workflow permissions remain
read-only except where a documented job requires more; `id-token: write` belongs
only to the publish job. Publication cannot run from an arbitrary branch or an
unreviewed commit.

The supported package `engines` range contains Node.js 22 and 24 only. Node.js
26 remains an advisory workflow target until it enters LTS; Node.js 18 and 20
remain unsupported.

The first manual alpha recorded `0.1.0-alpha.1` in the manifest and removed the
temporary `release-as` configuration. Later releases advance that manifest with
the package version. The publication workflow fails unless the manifest equals
the package version, `release-as` is absent, and the version has exactly one
dated changelog heading.

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
11. After the first npm publication, an authorized maintainer adds the
    company-controlled owner and verifies the resulting owner list:

    ```bash
    npm owner add cometapi_dev cometapi
    npm owner ls cometapi
    ```

    Record evidence that the output lists `cometapi_dev`; Registry Alpha owner
    setup is incomplete until it does.

12. Install `cometapi@next` from npm and run an independent import and mocked
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
4. Complete the common Registry Alpha owner-verification step after this first
   publication; the bootstrap does not change or defer that requirement.
5. A maintainer immediately configures OIDC, removes the environment variable
   and secret, revokes the token, and restricts token-based publishing.
6. The project prepared the immutable `0.1.0-alpha.2` GitHub release through
   OIDC. Exact-artifact verification and the protected live smoke passed, but
   the local publication guard rejected the fixed `actions/setup-node`
   authentication placeholder before npm was invoked. No alpha.2 registry
   artifact was published.
7. Preserve that immutable failure record, prepare and publish
   `0.1.0-alpha.3` through OIDC with regression coverage for the placeholder,
   verify its provenance and public installation, and confirm that `next`
   resolves to `0.1.0-alpha.3`.
8. The release record documents the exception, the unpublished alpha.2
   attempt, and both public-install evidence layers.

This exception must never become a reusable source-controlled publishing path.

## Registry Alpha release evidence

Registry Alpha completed on 2026-07-27 with these independently auditable
layers:

- The one-time `0.1.0-alpha.1` bootstrap recovery published the exact artifact
  with provenance in [GitHub Actions run 30251436832](https://github.com/cometapi-dev/cometapi-node/actions/runs/30251436832).
- npm ownership lists both `tensornull <tensor.null@gmail.com>` and the
  company-controlled `cometapi_dev <dev@cometapi.com>` account. The bootstrap
  token was revoked, local npm authentication was removed, the protected `npm`
  environment has no secrets or variables, and npm disallows token publishing.
- The immutable `0.1.0-alpha.2` release passed exact-artifact verification and
  protected live smoke in [run 30270656080](https://github.com/cometapi-dev/cometapi-node/actions/runs/30270656080),
  then failed before invoking npm because the local publication guard rejected
  the fixed `actions/setup-node` authentication placeholder. No alpha.2
  registry artifact exists.
- Pull request [#23](https://github.com/cometapi-dev/cometapi-node/pull/23)
  added regression coverage for that placeholder while preserving rejection of
  real registry credentials. Default-branch [CI run 30272606126](https://github.com/cometapi-dev/cometapi-node/actions/runs/30272606126)
  passed before tagging.
- The immutable [`v0.1.0-alpha.3` release](https://github.com/cometapi-dev/cometapi-node/releases/tag/v0.1.0-alpha.3)
  completed exact-artifact verification, the bounded three-request live smoke,
  OIDC publication, registry convergence, signature verification, dependency
  deduplication, and public installation in [run 30272764488](https://github.com/cometapi-dev/cometapi-node/actions/runs/30272764488).
- npm identifies the publisher as GitHub Actions using
  `npm-oidc-no-reply@github.com`. The registry reports SLSA provenance v1 and
  integrity
  `sha512-dtzQOz0dxif74jJpu2fhfUVjiq6TLm3YkPydtsryHGxuU6usaLWTpcblky854T42TG+SbTApCgOoNJDMkEYIOg==`,
  and Sigstore transparency-log index
  [`2257566579`](https://search.sigstore.dev/?logIndex=2257566579).
- Independent installs from the public registry passed for ESM, CommonJS, and a
  host already declaring `openai@6.47.0`. The host resolved one effective
  OpenAI installation and preserved `APIError instanceof` identity. Registry
  signatures and attestations were verified with `npm audit signatures`.
- The `next` dist-tag resolves to `0.1.0-alpha.3`. Stable publication moved
  `latest` to `0.1.0`; the historical registry-created `latest` value on
  `0.1.0-alpha.1` no longer remains.

## Stable 0.1.x sequence

```text
feature or fix pull request
  -> required offline CI
  -> merge to the protected default branch
  -> first-attempt manual Release Please preparation
  -> action-created Release Please branch and release PR
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

The 0.1.1 repair used one explicit `last-release-sha` boundary at the immutable
0.1.0 release commit, `1752cbb57f11dc6dca8dd1b13f0f8d5e8b5fdfca`, only for
the initial preparation dispatch. That dispatch proved the normal action-owned
0.1.1 PR without rediscovering pre-0.1.0 features. A normal topic PR then removes
the temporary override and records final candidate approval on `main`; a fresh
preparation dispatch refreshes the action-owned release PR from that state. The
finalization commit must use a releasable `fix:` subject so Release Please
updates the generated notes and cannot treat the old branch as unchanged.
Future releases discover the Release Please-created `v0.1.1` boundary normally.

Before enabling the repaired workflow, create the standard
`autorelease: pending` and `autorelease: tagged` labels if they are still
absent. The configuration names both labels explicitly, and the action-created
release PR must receive `autorelease: pending` automatically. Stop if the action
cannot create or label that PR; do not replace the normal flow with a manually
authored PR. Release Please performs the normal tagged transition with its
scoped `issues: write` permission.

Confirm through the repository Actions API that
`default_workflow_permissions=read` and
`can_approve_pull_request_reviews=true`. The latter is the explicitly authorized
0.1.1 baseline solely so the default token can create the Release Please PR.
The release workflow must never change either setting, and any later drift is a
stop condition.

After enabling `RELEASE_PLEASE_ENABLED`, start a new manual dispatch on `main`;
do not rerun the skipped workflow from the repair merge. Only attempt 1 of a
manual dispatch may call Release Please; an unchanged PR is restarted with a
new dispatch, not a rerun. The workflow rejects any dispatch whose triggering
ref is not `refs/heads/main`, and all preparation and release runs share one
main-scoped concurrency group. The manually dispatched preparation run cannot
trigger npm publication or create a Release: the action receives explicit
`skip-github-release=true`, it is accepted only when no merged
`autorelease: pending` PR exists, and `publish.yml` accepts only an upstream
`push` event. It must succeed after independently validating the one canonical
action-created 0.1.1 PR, including the unchanged-PR case where the action emits
no `prs` output. Before mutation, the workflow also rejects any open PR whose
head name could be mistaken for the canonical release branch, including a
same-named fork branch.
The `GITHUB_TOKEN`-created PR's `pull_request` CI starts in GitHub's
approval-required state. A human with write access must explicitly authorize
those workflow runs before their results can satisfy required checks; this is
separate from the final-head administrator review.
After the finalization topic PR removes the one-cycle `last-release-sha` and
completes the release-ready documentation on `main`, start a new first-attempt
manual dispatch. Require it to refresh the same action-owned release PR with
only the four generated release files and release notes identical to the
generated CHANGELOG section. Require the refreshed release commit to have the
post-finalization `main` commit as its direct parent; an unchanged older head is
not a refreshed candidate. Run the full matrix on that final head and obtain
approval from a different human repository administrator. The release-PR merge
creates the `push` run that may tag and publish. A later push cannot tag an older
outstanding release PR; its merge SHA must equal the triggering SHA before
Release Please runs. A rerun may retry that same candidate while no tag or
Release exists. If Release Please created the immutable Release but failed
before producing outputs, only the same run may recover it, and only after
proving its exact SHA, tag, bot author, immutable state, target, URL, notes, and
publication inside exactly one earlier Release Please step time window. Recovery
then idempotently removes `autorelease: pending`,
adds `autorelease: tagged`, and writes a schema-v2 artifact for that attempt.
Immediately before the irreversible Release Please call, every attempt also
reconfirms `main`, the release-branch snapshot, all PR collisions, the candidate
and final-head review, final release metadata and public documentation, and the
exact tag/Release state, including removal of the one-cycle `last-release-sha`.
Because workflow concurrency does not lock `main` or PR metadata against other
actors, the maintainer must hold a short mutation freeze from the release-PR
merge until the Release Please run reaches its post-action validation. Do not
merge another `main` PR, edit the release PR, change its labels or review, or
mutate the release branch during that window. The workflow repeats those checks
after the action and stops publication on any drift, but it cannot delete or
replace an immutable Release created during an external race.

The stale branch at `3f0949e5c0ccd0923d10595437f7a315f013af7c` was revalidated
as the failed run's generated 0.2.0 evidence, with no associated open PR or
independent work, then deleted. Release Please recreated the canonical
`release-please--branches--main--components--cometapi` branch for the
action-owned 0.1.1 PR. Do not use that branch as a 0.2 starting point or delete
or rewrite any other branch.

For 0.1.1, `always-bump-patch` keeps every releasable Conventional Commit on the
0.1.x maintenance line; changing that strategy requires a separately authorized
later milestone. A normal `fix:` commit after 0.1.0 must produce exactly one
patch PR. Stop if the branch contains 0.2.0, if any
version/manifest/changelog value is not 0.1.1, or if the generated PR is not
attributable to the explicit `cometapi` component. Merge is forbidden until
Node.js 22 and 24 blocking checks, the Node.js 26 advisory lane,
minimum/locked/latest OpenAI 6.x compatibility,
package and declaration checks, and human-owner review complete on the final
head. After registry verification, restore `RELEASE_PLEASE_ENABLED=false` and
keep the already enabled scheduled-smoke policy at `LIVE_SMOKE_ENABLED=true`.
Use a separate post-release documentation PR to record the ROADMAP and
RELEASING evidence; only that verified closeout may mark Repository foundation
Complete.

The `0.1.0` promotion limited Release Please to the stable PR because the
pinned v5.0.0 action bundles Release Please 17.6.0 and its single-package path
has the open upstream
[release-please-action issue #1205](https://github.com/googleapis/release-please-action/issues/1205)
when component names are omitted from tags. After the release PR merged, a
maintainer created the draft `v0.1.0` GitHub Release manually against the exact
merge commit, reviewed it with `prerelease=false`, and published it with
immutable releases enabled.
Release Please did not add an `autorelease: pending` label to the manually
opened stable PR, and the repository has no `autorelease` labels, so no post-tag
label transition applied to this release.

Release Please did not author the final public status text. A maintainer pushed
the focused README, SECURITY, SUPPORT, COMPATIBILITY, and ROADMAP candidate
state to the generated branch and repeated the CI review on the final head
before merging it.

The failed post-merge Release Please
[run 30345116433](https://github.com/cometapi-dev/cometapi-node/actions/runs/30345116433)
started seven seconds after the maintainer created a draft `v0.1.0` Release, but
the draft had no tag and was not published until more than eight minutes after
the run failed. Release Please therefore found no discoverable published
release/tag boundary, scanned the older initial feature commit, and prepared an
unrequested 0.2.0 branch update. PR creation then failed for the separate reason
that repository Actions were not authorized to create or approve pull requests
at that time.
Publishing the manual Release later could not retroactively bound that run, and
leaving `skip-github-release` enabled would continue the split discovery model.
The 0.1.1 repair replaces that historical combination with explicit component
identity, one-cycle history anchoring, action-created/human-reviewed release
PRs, and normal Release Please tag and GitHub Release creation. Repository
Actions pull-request authorization is now enabled for that scoped job; the
workflow still uses only its default token and job-local permissions.

The recovery rules follow the pinned implementation rather than assuming the
action is atomic. Release Please 17.6.0
[creates the Release before PR comments and label changes](https://github.com/googleapis/release-please/blob/712fcf01effd08d7b0e7b1fd3861f2cb388bc8d1/src/manifest.ts#L1258-L1319),
while the pinned action emits release outputs only after that call returns. An
unchanged release PR may also return
[no PR result](https://github.com/googleapis/release-please/blob/712fcf01effd08d7b0e7b1fd3861f2cb388bc8d1/src/manifest.ts#L1089-L1101).
Finally, commit-level `Release-As:` is rejected before the action because the
[base strategy applies it before configured versioning](https://github.com/googleapis/release-please/blob/712fcf01effd08d7b0e7b1fd3861f2cb388bc8d1/src/strategies/base.ts#L543-L570).
GitHub documents that a `GITHUB_TOKEN`-created PR's opened or synchronize event
[creates an approval-required workflow run](https://github.com/github/docs/blob/e1e4aa937308f21c411c248b4966873536bb0cba/data/reusables/actions/actions-do-not-trigger-workflows.md#L1-L6).

## Stable 0.1.0 release evidence

Stable `0.1.0` completed on 2026-07-28 with these independently auditable
layers:

- The maintainer-edited release pull request [#28](https://github.com/cometapi-dev/cometapi-node/pull/28)
  had required pull-request CI in [run 30344166767](https://github.com/cometapi-dev/cometapi-node/actions/runs/30344166767)
  and the manually dispatched latest-compatible OpenAI 6.x lane in
  [run 30344290818](https://github.com/cometapi-dev/cometapi-node/actions/runs/30344290818)
  on final head `34f8dd342b56f82baa1d5a98807d715fe0bd60bf`.
  GitHub records no formal `APPROVED` review object; maintainer review is
  evidenced by the focused candidate edits, merge, Release publication, and
  protected npm-environment approval.
- The protected merge produced
  `1752cbb57f11dc6dca8dd1b13f0f8d5e8b5fdfca`; its tree matched the reviewed
  final head, and default-branch Node.js 22 and 24 CI passed in
  [run 30345116325](https://github.com/cometapi-dev/cometapi-node/actions/runs/30345116325).
- The immutable [`v0.1.0` release](https://github.com/cometapi-dev/cometapi-node/releases/tag/v0.1.0)
  targets that exact merge commit with `prerelease=false`. Its
  [publish run 30345735681](https://github.com/cometapi-dev/cometapi-node/actions/runs/30345735681)
  rebuilt and verified one exact artifact, executed the bounded three-request
  release-tag live smoke with a 16-output-token cap, 60-second per-request
  timeout, concurrency one, and stop on first failure, then published through
  the protected `npm` environment and GitHub Actions OIDC.
- npm's `latest` dist-tag resolves to `0.1.0`, while `next` remains on
  `0.1.0-alpha.3`. The registry artifact has SHA-1
  `e509196ac5618d5b073207c74c7cdc5204efbe37` and SHA-512 integrity
  `sha512-B7vyPXZkoZRM2JjFMQZthumUHgHWZLcPlQt8SG5oopPL2JGU0LR1iBOjtox4Mos+gZmA1Bs2q6vLPX2loHyfuw==`.
- npm reports SLSA provenance v1 and a registry signature. The provenance binds
  `cometapi@0.1.0` to `refs/tags/v0.1.0`, the publishing workflow, run
  `30345735681`, and the exact release commit. The Sigstore transparency-log
  index is
  [`2269554513`](https://search.sigstore.dev/?logIndex=2269554513), and the npm
  publish-attestation index is
  [`2269555365`](https://search.sigstore.dev/?logIndex=2269555365).
- Separate post-publication registry verification downloaded the workflow
  artifact and npm tarball and found them byte-for-byte identical. Registry
  signature and attestation verification passed. The registry tarball then
  passed the ESM, CommonJS, and compatible-OpenAI host fixtures; the host
  resolved one effective `openai@6.47.0` installation and preserved official
  error identities.
- A closeout `npm audit` of the locked development checkout reported six
  development-tooling findings: five high through
  ESLint/minimatch/brace-expansion and one low in esbuild. `npm audit
--omit=dev` reported zero production vulnerabilities; these findings do not
  affect the published production dependency graph and remain deferred
  dependency-maintenance work.
- The immutable npm `0.1.0` tarball retains its candidate-era README. The
  post-release documentation status recorded here and on the default branch can
  first appear inside a later package artifact; no published tarball was
  rewritten.
- The post-merge Release Please
  [run 30345116433](https://github.com/cometapi-dev/cometapi-node/actions/runs/30345116433)
  failed after updating its unreviewed temporary branch to
  `3f0949e5c0ccd0923d10595437f7a315f013af7c`, a generated `0.2.0` draft, but
  before creating a pull request. It did not modify `main`, create a tag, or
  publish a package. `RELEASE_PLEASE_ENABLED` was set to `false` before the
  closeout push. During the authorized 0.1.1 repair, the branch was revalidated
  as failure-only evidence with no associated PR or independent work, deleted,
  and then recreated by Release Please for the normal action-owned 0.1.1 PR.

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

For a pre-visibility closeout, use the merged private pull request as the
durable evidence record because a commit cannot contain its own final object
ID. After merge, add one timeline comment that records the exact final `main`
commit, the complete local gate results for that commit, pull-request and
default-branch Node.js 22/24 CI URLs, failed dependency-update dispositions,
the read-only private/public-only configuration audit, and every skipped or
unknown boundary. The comment must explicitly confirm that no visibility,
repository-rule, environment, secret, live API, tag, release, or registry state
was changed.

Only a publicly installed and verified npm artifact may be called released.
