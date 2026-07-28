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
- `release-please.yml`: a human-reviewed version and changelog PR from
  Conventional Commits and requires `RELEASE_PLEASE_ENABLED=true`. It uses the
  default `GITHUB_TOKEN` and deliberately skips tag and GitHub Release creation.
  Because that token does not trigger CI for its generated PR, a maintainer
  commits the stable README, security, support, compatibility, and roadmap
  state to the generated branch, then manually dispatches `ci.yml` with that
  branch as `ref`. Merge is forbidden unless `gh pr checks` reports every
  required context on the exact final PR head; if GitHub does not associate the
  dispatched checks with that commit, stop rather than bypass protection.
  The manual dispatch also runs the latest-compatible OpenAI 6.x lane so the
  candidate head has minimum, locked, and latest-within-major evidence.
- `publish.yml`: rejects mutable releases and tag commits outside `main`, packs
  and tests one exact artifact, requires a protected live smoke for that release
  tag, and publishes the same file through npm OIDC. Registry token credentials
  are rejected. The workflow verifies the dist-tag, integrity, provenance
  attestation, signatures, deduplication, and public installation. A rerun
  resumes after an already accepted version only when its registry integrity
  matches the downloaded artifact, then repeats all bounded registry-state and
  signature checks.

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

The `0.1.0` promotion limited Release Please to the stable PR because its v5
single-package path has an open upstream tagging defect when component names
are omitted from tags. After the release PR merged, a maintainer created the
draft `v0.1.0` GitHub Release manually against the exact merge commit, reviewed
it with `prerelease=false`, and published it with immutable releases enabled.
Release Please did not add an `autorelease: pending` label to the manually
opened stable PR, and the repository has no `autorelease` labels, so no post-tag
label transition applied to this release.

Release Please did not author the final public status text. A maintainer pushed
the focused README, SECURITY, SUPPORT, COMPATIBILITY, and ROADMAP candidate
state to the generated branch and repeated the CI review on the final head
before merging it.

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
  closeout push; the branch is retained as failure evidence and must not be
  merged or treated as the start of 0.2. Release Please remains disabled until
  its post-manual-release discovery and pull-request authorization strategy are
  reviewed in a separately authorized maintenance task.

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
