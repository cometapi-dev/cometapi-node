# Releasing

## Release states

Release status is evidence-based:

| State                           | Required evidence                                                                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local code-complete             | Required source, tests, documentation, metadata, fixtures, and workflows exist, and every applicable offline check passes.                                                       |
| Private Remote Validation ready | Local gates pass, the sanitized history and maintainer-confirmed identity are complete, and real credential-free private default-branch CI passes.                               |
| Public Preview ready            | After visibility changes, public-only repository rules, security reporting, environments, default-branch CI, the content gate, and authorized protected live smoke all pass.     |
| Registry Alpha candidate        | The exact `0.1.0-alpha.3` artifact passes package and clean-install gates after preserving the unpublished immutable alpha.2 failure record.                                     |
| Registry Alpha released         | The public npm artifact installs from the `next` channel, passes post-publication verification, and has verified provenance plus any documented one-time bootstrap evidence.     |
| Stable released                 | Every applicable stable local, remote, live, review, provenance, and registry gate has recorded evidence.                                                                        |
| Stable patch candidate          | An action-created Release Please PR has the exact version, changelog, manifest, complete CI matrix, and formal exact-head `APPROVED` review from a distinct human administrator. |
| Stable patch released           | The immutable Release Please tag and GitHub Release, bounded live smoke, npm OIDC publication, and independent public-registry verification all pass.                            |

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

Public Preview, Registry Alpha, stable 0.1.x maintenance, and Repository
foundation are complete. Future topic
pushes, pull requests, merges, immutable GitHub Releases, bounded live smoke,
npm publication, and environment approvals require authorization from the
current maintainer request. This document defines allowable mechanics but
grants no standing remote-write permission.

## Pull-request review identity

GitHub does not allow a pull-request author to approve that same pull request,
including when the author is an organization or repository administrator. The
repository setting `can_approve_pull_request_reviews=true` authorizes eligible
GitHub Actions workflows to submit approving pull-request reviews; it does not
override this author-self-approval restriction. Before requesting a review,
compare the PR author login with the intended reviewer login.

If they are the same, never ask that reviewer to select the disabled `Approve`
action and never describe a `COMMENTED` review as `APPROVED`. A ruleset that
requires an approving review needs a different human reviewer. When the active
ruleset requires zero approvals and the release procedure asks only for an
owner's exact-head audit record, the author may submit a `Comment` review whose
body names the reviewed commit; verify its `user.login`, `state=COMMENTED`, and
`commit_id` through the reviews API before merge. Action-authored Release Please
PRs remain different: the release workflow requires a formal, exact-head
`APPROVED` review from a human repository administrator whose login differs
from the bot author.

Any head change invalidates an earlier exact-head `COMMENTED` audit or formal
approval. Release and publication trust-boundary PRs require a new exact-head
human record before merge. GitHub's **Approve and run workflows** control is a
separate authorization for CI created by an action-authored PR; it is not a PR
review and satisfies no approval requirement.

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

`package.json` is the sole candidate-version authority; validation must not
hard-code a second version as an independent authority. Before release, local
package checks derive that value and require:

1. The package-lock root name and version to match `package.json`.
2. Either the Release Please manifest to match, or, for the first release only,
   an empty manifest plus `release-as` matching the candidate version.
3. Exactly one changelog heading for the candidate. It may remain `Unreleased`
   during prerelease preparation.
4. The packed package metadata name, version, dependency range, and runtime
   contract to match the source manifest.

For normal stable maintenance, the generated Release Please PR changes exactly
these four files:

- `.release-please-manifest.json`
- `CHANGELOG.md`
- `package-lock.json`
- `package.json`

Those files carry the candidate-specific version agreement. README, status,
compatibility, and runbook prose must remain publication-neutral so the
generated PR does not require a manually predicted version or an additional
documentation mutation.

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
Query exact public state when needed instead of copying it into durable prose:

```bash
npm view cometapi version
npm view cometapi dist-tags --json
gh release view --repo cometapi-dev/cometapi-node \
  --json tagName,isDraft,isPrerelease,publishedAt,url
```

## Releasable documentation and identity gate

Development checks may run before public identity is complete, but the
publication path is fail-closed: `publish.yml` invokes
`scripts/validate-release.mjs --require-releasable-docs` and fails before build,
live smoke, or registry access unless all of these conditions hold:

1. `LICENSE` contains a maintainer-supplied copyright year and holder with no
   placeholder.
2. `README.md` contains the exact unpinned `npm install cometapi` command, links
   to the unversioned npm package page, and contains no exact-version current,
   approval, unpublished-candidate, or in-progress release claim.
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

Maintainers land this transition in a reviewed implementation or finalization
PR before Release Please preparation. After Release Please creates or refreshes
the generated four-file release PR, validate that PR's exact final committed
state with:

```bash
release_version="$(node -p "require('./package.json').version")"
node scripts/validate-release.mjs \
  --tag "v${release_version}" \
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
  release approval. Automatic push execution covers every `main` commit so a
  normal `fix:` commit that changes source, tests, or documentation cannot be
  filtered out before Release Please classifies it. The in-job before/after
  check sends an unchanged current package version to patch-PR preparation and
  requires a release-PR merge to increment exactly one patch. Thus an ordinary
  source `fix:` prepares or refreshes exactly one canonical patch PR, while the
  reviewed package-version bump alone can enter GitHub Release creation. A
  manual preparation dispatch is attempt-1-only, skips GitHub Release creation,
  and prepares or revalidates exactly one action-authored patch PR. The
  preparation run verifies the canonical branch, title, machine-readable body,
  pending label, four expected release files, and 0.1.x patch versions. Before a
  post-merge `push` may create a Release, the workflow rejects legacy,
  alternate, fork, older, or multiple candidates and requires a formal human
  administrator approval on the exact final head. Release Please creates the
  immutable tag and GitHub Release, verifies the release notes byte-for-byte
  against the normalized `CHANGELOG` entry, reconciles release labels, and
  uploads one schema-v2 attempt-qualified result artifact. An existing Release
  may be reconciled only by a later attempt of that same run after its exact
  commit, tag, author, immutable state, notes, and creation window are proven.
  The triggering SHA must remain the fetched `main` tip before every mutation.
  Before and after tag creation, the workflow also validates the permanent
  publication contract stored at the exact release commit. This flow does not
  introduce a PAT or GitHub App credential.
  Component identity remains internal to release discovery:
  `include-component-in-tag=false` requires the exact public `v<version>` tag.
  Its write permissions are limited to `contents`, `pull-requests`, and
  `issues`; it also has `actions: read` and no npm OIDC permission.
- `publish.yml`: separates release discovery from registry authority. A
  successful trusted Release Please `workflow_run` can enter only the `handoff`
  job. That job has no Environment and no OIDC permission. It validates the
  exact source job and treats a preparation run whose result-upload step was
  skipped as release-inert. For a release run, it requires the unique
  attempt-qualified result, immutable bot-authored Release, tag commit, exact
  current `main` identity, and the dispatch contract stored in the tag, then
  uses its sole
  `actions: write` permission to dispatch the same workflow with `ref=v<version>`.
  The `verify`, `live-smoke`, and `publish` jobs accept only
  that tag-bound `workflow_dispatch`; they are unreachable from the original
  main-context `workflow_run`. A successful manual Release Please preparation
  run is release-inert and cannot enter the handoff.

  The tag run independently revalidates the source run and result artifact,
  exact tag and immutable Release, package metadata, and exact current `main`
  identity. It freezes the Release Please run set, packs and tests one fresh
  attempt-qualified artifact, runs a fresh bounded live smoke, and sends that
  same file to the protected npm Environment. Immediately after approval and
  directly before registry mutation, it rechecks the source run, enable
  variable, Release, tag, current `main`, active Publish runs, Release Please run
  snapshot, npm Environment reviewer and branch policies, public versions, and
  dist-tags. The Environment must contain exactly its permanent `tag:v*`
  deployment policy. Registry token credentials are rejected; only the publish
  job receives `id-token: write`. Provenance must bind the package to the exact
  stable `v0.1.x` tag and release commit. Replays are integrity-idempotent, not
  exactly-once: an existing version is accepted only when its registry integrity
  matches the downloaded artifact, after which the bounded registry, signature,
  and provenance checks run again. Package metadata and the attestation endpoint
  may converge independently, so attestation HTTP failures, including an early
  `404`, receive a bounded ten-minute retry. Exhaustion remains a hard failure.

The one-time `0.1.1` main-context publication exception is historical evidence,
not a reusable release route. Its dispatch inputs, fixed evidence identifiers,
prior-artifact reuse, live-evidence reuse, and temporary `main` policy handling
must remain absent from executable workflow code. No later release may add a
`main` publication policy, dispatch publication from a branch, fabricate an
auxiliary tag, or choose a different patch to bypass a failed release.

The permanent npm Environment deployment-policy set is exactly one `tag:v*`
policy. Any `branch:main` policy or other additional policy is configuration
drift and stops publication. Environment reviewers, the Trusted Publisher
tuple, repository variables, protections, secrets, and npm ownership are
external release prerequisites; the workflow validates the state it can read
and never changes those settings.

Third-party actions are pinned to full commit SHAs. Workflow permissions remain
read-only except where a documented job requires more; `id-token: write` belongs
only to the publish job, and `actions: write` belongs only to the unprivileged
handoff. Publication cannot run from an arbitrary branch or an unreviewed
commit.

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
- At the Registry Alpha closeout on 2026-07-27, npm had assigned
  `0.1.0-alpha.3` to the prerelease channel. At the stable `0.1.0` closeout, npm
  had assigned `0.1.0` to the stable channel and replaced the registry-created
  assignment for `0.1.0-alpha.1`.

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

`CHANGELOG.md` is owned by Release Please and excluded from Prettier so the
action-generated release notes remain byte-for-byte identical to the release
PR body. Release validators still require the exact dated stable-patch section,
the four-file candidate shape, and exact PR-body note equality; secret,
standalone-content, and public-preview checks continue to scan the file.

Before a stable patch operation, verify the standard `autorelease: pending` and
`autorelease: tagged` labels, `default_workflow_permissions=read`, Actions
pull-request creation authorization, no canonical-branch collision, and the
current external Environment and Trusted Publisher state. The workflow never
changes those settings; drift is a stop condition. Enable
`RELEASE_PLEASE_ENABLED`, start a new attempt-1 manual dispatch on `main`, and
never rerun a preparation dispatch. An unchanged candidate is revalidated by a
new dispatch. Manual preparation uses `skip-github-release=true` and is release-
and publication-inert.

The action-created PR must contain only the four release files and exact
generated notes. A human with write access separately authorizes its CI through
**Approve and run workflows** when GitHub requires that gate. After all final-
head checks pass, a human repository administrator whose login differs from the
bot author must submit a formal exact-head `APPROVED` review. That
administrator's latest review must remain exact-head `APPROVED` through merge
and post-action validation; a later `COMMENTED` or `CHANGES_REQUESTED` review,
or any head change, invalidates the approval.

The release-PR merge creates the only `push` run that may call Release Please in
release mode. From that merge through successful registry verification and the
final readback, do not start a new Release Please workflow or rerun any run
except the bounded source-run retry described below or the exact post-publish
failed-job replay described after the handoff; publication freezes the complete
Release Please run set. Through post-action validation, do not edit the release
PR, change its labels or review, or mutate its branch. Keep `main` frozen at the
release commit through successful registry verification and the final variable
and Environment-policy readback; every handoff, tag, and pre-publish gate
requires that exact identity. A Release Please rerun may retry the same release
candidate only while no tag or Release exists. If an earlier attempt of that run
already created the Release, same-run reconciliation is allowed only after
proving the exact run ID, SHA, tag, bot author, immutable state, target, URL,
notes, and publication time inside one earlier Release Please step. It may only
reconcile labels and write the attempt-qualified result artifact.

The successful Release Please `workflow_run` enters an unprivileged handoff,
which validates the exact result and immutable Release before dispatching
`publish.yml` with `ref=v<version>`. Only the tag-bound dispatch may rebuild and
verify the artifact, run the fresh bounded live smoke, enter the npm
Environment, request OIDC, or verify the registry. The permanent npm Environment
policy set is exactly `tag:v*`. After registry verification, immediately restore
`RELEASE_PLEASE_ENABLED=false` and keep `LIVE_SMOKE_ENABLED=true`.
The handoff itself runs only on attempt 1 and refuses the dispatch when any
exact Publish child already exists for that immutable tag and commit. A handoff
rerun may never create a replacement child publication run.

Never substitute a manually authored release PR, manual or auxiliary tag,
branch-context publication, temporary `main` Environment policy, cross-run
artifact or live-evidence reuse, arbitrary rerun, or different patch version. An
ambiguous npm result requires exact registry integrity, signature, and
provenance inspection; it never authorizes an automatic retry.

If the exact publish step succeeded but a later registry verification step
failed, query the immutable version and both dist-tags before taking any action.
When the exact version is absent, `latest` must equal the previous patch. When
the exact version equals the candidate, `latest` may equal the previous patch or
candidate. Final verification requires the exact version and `latest` to equal
the candidate. Throughout the run, `next` must equal the prerelease value
captured by the initial verification job; durable guidance does not pin that
registry value.

An early attestation-endpoint `404` is the known convergence case. Other HTTP or
transport failures receive the same finite retry, but persistent authentication,
authorization, URL, server, or convergence failures remain failures. Let the
workflow's strict ten-minute wall-clock fetch finish; exhaustion is terminal, so
stop and report rather than rerunning to extend the wait. Only after attestations
are readable and independent signature and provenance checks pass may a
different failed post-publication gate use exactly one `rerun failed jobs` on
the same tag-bound run. Before approving that replay, confirm that GitHub kept
the successful exact-artifact and live-smoke jobs. Rerun-all is invalid and its
attempt guards must fail before live API access. The attempt-2 protected
preflight must record that the exact version exists, and the idempotent
publication script must report matching integrity and skip `npm publish`. An
exact-version metadata `E404` after that preflight is a hard stop rather than
permission to republish. The failed publish job still requires a fresh npm
Environment approval. Attempt 3 or later, a second replay request, retry
exhaustion, or any mismatch is terminal. After successful verification, restore
`RELEASE_PLEASE_ENABLED=false` immediately.

The `0.1.1` repair used the immutable `0.1.0` commit as a one-cycle
`last-release-sha` only for its initial preparation, then removed the anchor.
The failed run's exact generated `0.2.0` branch was verified as failure-only
evidence with no open PR or independent work before replacement by the
canonical action-owned `0.1.1` branch. Neither branch is a 0.2 starting point.
The one-time main-context npm recovery is historical evidence only; its complete
record appears below and its executable path was removed by PR #41.

The `0.1.0` promotion limited Release Please to the stable PR because the
pinned v5.0.0 action bundles Release Please 17.6.0 and its single-package path
has the open upstream
[release-please-action issue #1205](https://github.com/googleapis/release-please-action/issues/1205)
when component names are omitted from tags. After the release PR merged, a
maintainer created the draft `v0.1.0` GitHub Release manually against the exact
merge commit, reviewed it with `prerelease=false`, and published it with
immutable releases enabled.
Release Please did not add an `autorelease: pending` label to the manually
opened stable PR, and the repository had no `autorelease` labels at the time, so
no post-tag label transition applied to this release.

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

The same-run Release reconciliation rules follow the pinned implementation
rather than assuming the action is atomic. Release Please 17.6.0
[creates the Release before PR comments and label changes](https://github.com/googleapis/release-please/blob/712fcf01effd08d7b0e7b1fd3861f2cb388bc8d1/src/manifest.ts#L1258-L1319),
while the pinned action emits release outputs only after that call returns. An
unchanged release PR may also return
[no PR result](https://github.com/googleapis/release-please/blob/712fcf01effd08d7b0e7b1fd3861f2cb388bc8d1/src/manifest.ts#L1089-L1101).
Finally, commit-level `Release-As:` is rejected before the action because the
[base strategy applies it before configured versioning](https://github.com/googleapis/release-please/blob/712fcf01effd08d7b0e7b1fd3861f2cb388bc8d1/src/strategies/base.ts#L543-L570).
GitHub documents that a `GITHUB_TOKEN`-created PR's opened or synchronize event
[creates an approval-required workflow run](https://github.com/github/docs/blob/e1e4aa937308f21c411c248b4966873536bb0cba/data/reusables/actions/actions-do-not-trigger-workflows.md#L1-L6).

## Stable 0.1.1 release evidence

Stable `0.1.1` completed on 2026-07-30 with these independently auditable
layers:

- The action-authored release pull request
  [#33](https://github.com/cometapi-dev/cometapi-node/pull/33) had final head
  `132d158c5bc4b83d582dd0a3c7677b05b46d471b`. Its complete final-head matrix
  passed in [CI run 30443300601 attempt 2](https://github.com/cometapi-dev/cometapi-node/actions/runs/30443300601/attempts/2)
  and the latest-compatible/manual matrix passed in
  [run 30468358086](https://github.com/cometapi-dev/cometapi-node/actions/runs/30468358086).
  Human repository administrator `tensornull`, distinct from bot author
  `github-actions[bot]`, submitted formal
  [review 4810328062](https://github.com/cometapi-dev/cometapi-node/pull/33#pullrequestreview-4810328062)
  with `state=APPROVED` against that exact head before merge.
- The reviewed merge produced
  [`c98b514227858cd183c781270a7f78f65b577e82`](https://github.com/cometapi-dev/cometapi-node/commit/c98b514227858cd183c781270a7f78f65b577e82).
  [Release Please run 30469181724 attempt 1](https://github.com/cometapi-dev/cometapi-node/actions/runs/30469181724/attempts/1)
  created, rather than recovered, the exact lightweight `v0.1.1` tag and
  immutable non-prerelease GitHub Release ID `361883325`. The
  [`v0.1.1` Release](https://github.com/cometapi-dev/cometapi-node/releases/tag/v0.1.1)
  is bot-authored, targets that merge commit, and was published at
  `2026-07-29T16:07:15Z`.
- The initial
  [Publish run 30469240186](https://github.com/cometapi-dev/cometapi-node/actions/runs/30469240186)
  failed before packing, live smoke, OIDC, or npm mutation. Its downloaded
  `release-please-result/result.json` was inside the workspace scanned by
  `npm run format:check`, and Prettier correctly returned non-zero for that
  runtime JSON file.
- [Run 30471665743 attempt 1](https://github.com/cometapi-dev/cometapi-node/actions/runs/30471665743/attempts/1)
  then completed all offline and exact-artifact checks. Its
  [live job 90643725110](https://github.com/cometapi-dev/cometapi-node/actions/runs/30471665743/job/90643725110)
  checked out the exact release commit and passed three sequential `gpt-5.4`
  requests with a 16-token output cap, 60-second per-request timeout,
  concurrency one, and stop-on-first-failure behavior. The npm job received no
  runner and no OIDC token: GitHub's check annotation states that branch `main`
  was not allowed by the tag-only npm Environment policy.
- That failed run retained artifact ID `8731956162`, named
  `npm-package-0.1.1-30471665743-1`, with ZIP digest
  `sha256:567b00f1ec32168d5c5be7d0b553542441920d3bb401959bcc2d6e157f35d08b`.
  It contains only `cometapi-0.1.1.tgz`; the tarball has SHA-256
  `3c926a2b15be99fbba92e1e100c2ee254ff866da27496a5c31824c542cccbf91`.
  Artifact metadata names recovery-control head `22c313d4f80c53ba01672dd35cc27b621d5ec9ce`,
  while Actions logs prove that packaging and live validation checked out
  release commit `c98b514227858cd183c781270a7f78f65b577e82`.
- The authorized one-time control
  [PR #40](https://github.com/cometapi-dev/cometapi-node/pull/40) merged as
  `37b811c54773295487aa4200f349ec3edd30d729`.
  [Publish run 30533520823 attempt 1](https://github.com/cometapi-dev/cometapi-node/actions/runs/30533520823/attempts/1)
  revalidated and published the exact retained artifact while reusing the
  already successful bounded-live evidence rather than spending another live
  request budget. Its
  [npm job 90841672147](https://github.com/cometapi-dev/cometapi-node/actions/runs/30533520823/job/90841672147)
  used GitHub Actions OIDC and completed the public-registry gates.
- At the stable `0.1.1` closeout on 2026-07-30, npm had assigned `0.1.1` to the
  stable channel and `0.1.0-alpha.3` to the prerelease channel. The registry
  tarball was byte-identical to the source artifact and had SHA-1
  `00edad522c9ffaf937facbe5a35ef211869551c1` and integrity
  `sha512-uYo573XD+ITsa8F4GbYLAlXMrj9SA1Qc4KBgvoRbnwwTvfX+Ye8QVo7xgSNOl9AoYpoglQCW8lEo9cvjwan+7Q==`.
  `npm audit signatures` passed. npm exposes both its publish attestation
  ([Sigstore index 2289305373](https://search.sigstore.dev/?logIndex=2289305373))
  and SLSA provenance
  ([index 2289305033](https://search.sigstore.dev/?logIndex=2289305033)).
  The provenance binds `cometapi@0.1.1` to `refs/heads/main`, control commit
  `37b811c54773295487aa4200f349ec3edd30d729`, and Publish run
  `30533520823/1`; it does not claim tag-bound publication.
- A separate clean public-registry installation on Node.js `24.18.1` passed ESM,
  CommonJS, `.mts` and `.cts` declarations, all three supported mocked
  operations including streaming and errors, one effective OpenAI installation,
  official `APIError instanceof` identity, integrity, signature, and both
  attestations.
- [Cleanup PR #41](https://github.com/cometapi-dev/cometapi-node/pull/41)
  removed every one-time recovery input, fixed evidence identifier,
  prior-artifact/live reuse branch, and temporary `main` policy path. Its final
  head `c5566246abce065a39f1f66ed2b6e2d4bc89e62f` passed
  [PR CI 30538011343](https://github.com/cometapi-dev/cometapi-node/actions/runs/30538011343),
  merged as `c319503684b371ad4a4f1ce78a156978de86072e`, and passed
  [default-branch CI 30538123153](https://github.com/cometapi-dev/cometapi-node/actions/runs/30538123153).
  Post-release state was read back as `RELEASE_PLEASE_ENABLED=false`,
  `LIVE_SMOKE_ENABLED=true`, and exactly one npm deployment policy,
  `tag:v*` (policy ID `55718965`).

The permanent immutable-tag handoff has passed static contract checks,
adversarial mutations, pull-request CI, and default-branch CI. Because the
immutable `v0.1.1` tag predates that final path, `0.1.1` publication used the
disclosed main-context exception above. The next explicitly authorized stable
patch remains the first end-to-end registry publication of the permanent
tag-bound route.

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
- At the `0.1.0` closeout, npm's `latest` dist-tag resolved to `0.1.0`, while
  `next` remained on `0.1.0-alpha.3`. The registry artifact has SHA-1
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
