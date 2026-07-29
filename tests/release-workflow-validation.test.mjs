import { fileURLToPath, URL } from "node:url";

import { getFileInfo } from "prettier";
import { describe, expect, it } from "vitest";

import {
  classifyPushReleasePresence,
  extractReleaseNotesFromChangelog,
  validatePreparedReleasePullRequest,
  validateGitHubRelease,
  validateMergedReleasePullRequest,
  validateOpenReleasePullRequestCollisions,
  validatePostActionPullRequestSnapshot,
  validatePublishRecoveryTrigger,
  validateReleasePleaseCommitMessages,
  validateReleasePleaseCompletion,
  validateReleasePleaseMutationConfiguration,
  validateReleasePleasePullRequestBody,
  validateReleasePleaseRunMetadata,
  validateReleasePresenceBeforeAction,
  validateReleasePleaseActionResult,
  validateReleasePleaseBranchState,
  validateReleaseWorkflowRun,
  selectPendingReleasePullRequest,
  validateTaggedReleasePullRequest,
} from "../scripts/release-workflow-validation.mjs";

const REPOSITORY = "cometapi-dev/cometapi-node";
const RELEASE_BRANCH = "release-please--branches--main--components--cometapi";
const RELEASE_SHA = "a".repeat(40);
const BRANCH_SHA = "b".repeat(40);
const RUN_ID = 123456789;

function releaseNotes(version = "0.1.1") {
  return `## [${version}](https://github.com/cometapi-dev/cometapi-node/compare/v0.1.0...v${version}) (2026-07-29)

### Bug Fixes

* enforce the supported options boundary`;
}

function releaseBody(version = "0.1.1") {
  return `:robot: I have created a release *beep* *boop*
---


${releaseNotes(version)}

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please). See [documentation](https://github.com/googleapis/release-please#release-please).`;
}

function pullRequestFixture({ merged = false, version = "0.1.1" } = {}) {
  return {
    author: "github-actions[bot]",
    baseRef: "main",
    body: releaseBody(version),
    files: [
      ".release-please-manifest.json",
      "CHANGELOG.md",
      "package-lock.json",
      "package.json",
    ],
    headRef: RELEASE_BRANCH,
    headRepository: REPOSITORY,
    headSha: BRANCH_SHA,
    labels: ["autorelease: pending"],
    mergeCommitIsAncestor: merged,
    mergeCommitSha: merged ? RELEASE_SHA : null,
    mergedAt: merged ? "2026-07-29T00:00:00Z" : null,
    number: 31,
    state: merged ? "closed" : "open",
    title: `chore(main): release ${version}`,
  };
}

function workflowRunFixture() {
  return {
    action: "completed",
    repository: { full_name: REPOSITORY },
    workflow_run: {
      conclusion: "success",
      event: "push",
      head_branch: "main",
      head_repository: { full_name: REPOSITORY },
      head_sha: RELEASE_SHA,
      id: RUN_ID,
      name: "Release Please",
      path: ".github/workflows/release-please.yml",
      run_attempt: 1,
    },
  };
}

function actionResultFixture() {
  return {
    actionOutcome: "success",
    htmlUrl: `${releaseUrl()}`,
    recovered: false,
    releaseCreated: true,
    releaseExistedBeforeAction: false,
    releaseSourceAttempt: 1,
    repository: REPOSITORY,
    runAttempt: 1,
    runId: RUN_ID,
    schemaVersion: 2,
    sha: RELEASE_SHA,
    tagName: "v0.1.1",
    version: "0.1.1",
    workflowName: "Release Please",
    workflowPath: ".github/workflows/release-please.yml",
  };
}

function releaseUrl() {
  return `https://github.com/${REPOSITORY}/releases/tag/v0.1.1`;
}

function releaseFixture({
  createdAt = "2026-07-28T23:59:00Z",
  publishedAt = "2026-07-29T00:01:00Z",
} = {}) {
  return {
    author: { login: "github-actions[bot]" },
    body: releaseNotes(),
    draft: false,
    html_url: releaseUrl(),
    immutable: true,
    name: "v0.1.1",
    prerelease: false,
    created_at: createdAt,
    published_at: publishedAt,
    tag_name: "v0.1.1",
    target_commitish: RELEASE_SHA,
  };
}

describe("Release Please generated files", () => {
  it("leaves the action-owned CHANGELOG byte-for-byte unchanged by Prettier", async () => {
    const changelog = fileURLToPath(
      new URL("../CHANGELOG.md", import.meta.url),
    );

    await expect(
      getFileInfo(changelog, { ignorePath: ".prettierignore" }),
    ).resolves.toMatchObject({ ignored: true });
    expect(
      extractReleaseNotesFromChangelog(
        `# Changelog\n\n${releaseNotes()}\n\n## [0.1.0] - 2026-07-28\n\nPrevious.`,
        "0.1.1",
      ),
    ).toBe(releaseNotes());
    expect(() =>
      validateReleasePleasePullRequestBody(
        releaseBody().replace("supported options", "different options"),
        "0.1.1",
        releaseNotes(),
      ),
    ).toThrow(/pull request notes/i);
  });
});

describe("Publish recovery trigger", () => {
  const recoveryCommit = "c98b514227858cd183c781270a7f78f65b577e82";
  const recoveryFiles = [
    ".github/workflows/publish.yml",
    "RELEASING.md",
    "scripts/release-workflow-validation.mjs",
    "tests/release-workflow-validation.test.mjs",
    "tests/workflow-contract.test.mjs",
  ];

  function recoveryTrigger(overrides = {}) {
    return {
      actor: "tensornull",
      changedFiles: recoveryFiles,
      eventAfter: BRANCH_SHA,
      eventBefore: recoveryCommit,
      eventName: "push",
      eventRef: "refs/heads/main",
      mainCommit: BRANCH_SHA,
      mainFirstParent: recoveryCommit,
      sourceReleaseCommit: recoveryCommit,
      sourceRunAttempt: 1,
      sourceRunId: 30469181724,
      workflowRunAttempt: 1,
      ...overrides,
    };
  }

  it("accepts only the reviewed one-cycle recovery merge", () => {
    expect(validatePublishRecoveryTrigger(recoveryTrigger())).toEqual({
      releaseCommit: recoveryCommit,
      releaseRunAttempt: 1,
      releaseRunId: 30469181724,
    });
  });

  it.each([
    ["actor", { actor: "github-actions[bot]" }],
    ["event", { eventName: "workflow_dispatch" }],
    ["ref", { eventRef: "refs/heads/dev" }],
    ["before SHA", { eventBefore: RELEASE_SHA }],
    ["after SHA", { eventAfter: RELEASE_SHA }],
    ["first parent", { mainFirstParent: RELEASE_SHA }],
    ["source commit", { sourceReleaseCommit: RELEASE_SHA }],
    ["source run ID", { sourceRunId: 30469181725 }],
    ["source attempt", { sourceRunAttempt: 2 }],
    ["missing file", { changedFiles: recoveryFiles.slice(1) }],
    ["extra file", { changedFiles: [...recoveryFiles, "package.json"] }],
  ])("rejects recovery trigger drift in %s", (_name, overrides) => {
    expect(() =>
      validatePublishRecoveryTrigger(recoveryTrigger(overrides)),
    ).toThrow(/release workflow/i);
  });

  it("accepts a rerun of the same immutable recovery event", () => {
    expect(
      validatePublishRecoveryTrigger(
        recoveryTrigger({ workflowRunAttempt: 2 }),
      ),
    ).toMatchObject({ releaseRunId: 30469181724 });
  });
});

describe("Release Please push classification", () => {
  function publishedCurrentRelease(overrides = {}) {
    return {
      draft: false,
      immutable: true,
      prerelease: false,
      tag_name: "v0.1.0",
      target_commitish: RELEASE_SHA,
      ...overrides,
    };
  }

  it("ignores a metadata-only push whose current version remains published", () => {
    expect(
      classifyPushReleasePresence({
        currentRelease: publishedCurrentRelease(),
        currentTagCommit: RELEASE_SHA,
        headCommit: BRANCH_SHA,
        manifestVersion: "0.1.0",
        packageChanged: false,
        previousVersion: "0.1.0",
        version: "0.1.0",
      }),
    ).toEqual({ mode: "ignore", version: "0.1.0" });
  });

  it("classifies an exact next-patch push as a release", () => {
    expect(
      classifyPushReleasePresence({
        currentRelease: null,
        currentTagCommit: null,
        headCommit: RELEASE_SHA,
        manifestVersion: "0.1.1",
        packageChanged: true,
        previousVersion: "0.1.0",
        version: "0.1.1",
      }),
    ).toEqual({ mode: "release", version: "0.1.1" });
  });

  it.each([
    [
      "unchanged unpublished version",
      { currentRelease: null, currentTagCommit: null },
    ],
    ["minor bump", { previousVersion: "0.1.0", version: "0.2.0" }],
    ["skipped patch", { previousVersion: "0.1.0", version: "0.1.2" }],
    ["metadata-only package change", { packageChanged: true }],
    ["manifest drift", { manifestVersion: "0.1.1" }],
    [
      "published-version tag without a Release",
      { currentRelease: null, currentTagCommit: RELEASE_SHA },
    ],
    ["published-version Release without a tag", { currentTagCommit: null }],
    [
      "mutable published Release",
      { currentRelease: publishedCurrentRelease({ immutable: false }) },
    ],
    [
      "mismatched published target",
      {
        currentRelease: publishedCurrentRelease({
          target_commitish: BRANCH_SHA,
        }),
      },
    ],
    [
      "candidate tag on another commit",
      {
        currentRelease: publishedCurrentRelease({
          tag_name: "v0.1.1",
          target_commitish: BRANCH_SHA,
        }),
        currentTagCommit: BRANCH_SHA,
        previousVersion: "0.1.0",
        version: "0.1.1",
      },
    ],
  ])("rejects a %s push", (_name, overrides) => {
    expect(() =>
      classifyPushReleasePresence({
        currentRelease: publishedCurrentRelease(),
        currentTagCommit: RELEASE_SHA,
        headCommit: RELEASE_SHA,
        manifestVersion: "0.1.0",
        packageChanged: false,
        previousVersion: "0.1.0",
        version: "0.1.0",
        ...overrides,
      }),
    ).toThrow(/release workflow/i);
  });

  it("rejects an unchanged-version rerun even if the historical tag exists", () => {
    expect(() =>
      classifyPushReleasePresence({
        currentRelease: publishedCurrentRelease(),
        currentTagCommit: RELEASE_SHA,
        headCommit: BRANCH_SHA,
        manifestVersion: "0.1.0",
        packageChanged: true,
        previousVersion: "0.1.0",
        version: "0.1.0",
      }),
    ).toThrow(/package\.json push must change/i);
  });
});

function attemptEvidenceFixture(
  attempt,
  {
    completedAt = "2026-07-29T00:01:30Z",
    conclusion = "success",
    startedAt = "2026-07-29T00:00:30Z",
  } = {},
) {
  return {
    attempt,
    jobs: [
      {
        head_sha: RELEASE_SHA,
        name: "Prepare a reviewed release pull request or GitHub release",
        run_attempt: attempt,
        run_id: RUN_ID,
        steps: [
          {
            completed_at: completedAt,
            conclusion,
            name: "Run Release Please",
            started_at: startedAt,
            status: "completed",
          },
        ],
      },
    ],
  };
}

function branchState(overrides = {}) {
  return {
    branchSha: BRANCH_SHA,
    branchVersion: "0.1.1",
    conflictingOpenPullRequests: [],
    exists: true,
    isAncestor: false,
    mainVersion: "0.1.0",
    manifestVersion: "0.1.1",
    pullRequests: [pullRequestFixture()],
    releaseBranch: RELEASE_BRANCH,
    repository: REPOSITORY,
    ...overrides,
  };
}

describe("Release Please branch validation", () => {
  it("accepts a missing release branch", () => {
    expect(
      validateReleasePleaseBranchState(
        branchState({ exists: false, pullRequests: [] }),
      ),
    ).toEqual({ state: "missing" });
  });

  it("rejects a 0.2 main version even when the release branch is missing", () => {
    expect(() =>
      validateReleasePleaseBranchState(
        branchState({
          exists: false,
          mainVersion: "0.2.0",
          pullRequests: [],
        }),
      ),
    ).toThrow(/stable 0\.1\.x/i);
  });

  it("accepts a merged branch that is an ancestor of main", () => {
    expect(
      validateReleasePleaseBranchState(
        branchState({
          branchVersion: "0.1.1",
          isAncestor: true,
          mainVersion: "0.1.1",
          pullRequests: [],
        }),
      ),
    ).toEqual({ state: "merged-ancestor" });
  });

  it("accepts the exact next-patch branch with one open release PR", () => {
    expect(validateReleasePleaseBranchState(branchState())).toEqual({
      pullRequestNumber: 31,
      state: "open",
    });
  });

  it("rejects an open fork PR whose head can collide with the release branch", () => {
    expect(() =>
      validateReleasePleaseBranchState(
        branchState({
          conflictingOpenPullRequests: [
            {
              headRef: RELEASE_BRANCH,
              headRepository: "fork/repo",
              number: 32,
            },
          ],
        }),
      ),
    ).toThrow(/collide with the canonical release branch/i);
  });

  it("accepts a squash-merged branch through its exact merged PR", () => {
    expect(
      validateReleasePleaseBranchState(
        branchState({
          branchVersion: "0.1.1",
          mainVersion: "0.1.1",
          pullRequests: [pullRequestFixture({ merged: true })],
        }),
      ),
    ).toEqual({ pullRequestNumber: 31, state: "merged-pr" });
  });

  it("rejects the stale 0.2.0 branch even if someone opens a PR for it", () => {
    expect(() =>
      validateReleasePleaseBranchState(
        branchState({
          branchVersion: "0.2.0",
          manifestVersion: "0.2.0",
          pullRequests: [pullRequestFixture({ version: "0.2.0" })],
        }),
      ),
    ).toThrow(/stable 0\.1\.x/i);
  });

  it.each([
    ["no PR", () => []],
    ["multiple PRs", (pr) => [pr, { ...pr, number: 32 }]],
  ])("rejects a divergent branch with %s", (_name, mutate) => {
    const pullRequest = pullRequestFixture();
    expect(() =>
      validateReleasePleaseBranchState(
        branchState({ pullRequests: mutate(pullRequest) }),
      ),
    ).toThrow(/exactly one matching release PR/i);
  });

  it.each([
    ["base", (pr) => (pr.baseRef = "dev")],
    ["head", (pr) => (pr.headRef = "other")],
    ["head SHA", (pr) => (pr.headSha = "c".repeat(40))],
    ["title", (pr) => (pr.title = "chore(main): release 0.2.0")],
    ["label", (pr) => (pr.labels = [])],
    ["author", (pr) => (pr.author = "maintainer")],
    ["body", (pr) => (pr.body = "ordinary pull request body")],
    ["head repository", (pr) => (pr.headRepository = "fork/repo")],
  ])("rejects a release PR with the wrong %s", (_name, mutate) => {
    const pullRequest = pullRequestFixture();
    mutate(pullRequest);
    expect(() =>
      validateReleasePleaseBranchState(
        branchState({ pullRequests: [pullRequest] }),
      ),
    ).toThrow(/release (?:please|workflow)/i);
  });
});

describe("Release Please pull request preparation", () => {
  function preparedState(overrides = {}) {
    const pullRequest = pullRequestFixture();
    return {
      actionPullRequests: [
        {
          baseBranchName: pullRequest.baseRef,
          body: pullRequest.body,
          files: [],
          headBranchName: pullRequest.headRef,
          labels: pullRequest.labels,
          number: pullRequest.number,
          title: pullRequest.title,
        },
      ],
      actionPullRequestsCreated: true,
      branchSha: BRANCH_SHA,
      branchVersion: "0.1.1",
      changelog: `# Changelog\n\n${releaseNotes()}`,
      mainVersion: "0.1.0",
      manifestVersion: "0.1.1",
      packageLockPackageVersion: "0.1.1",
      packageLockVersion: "0.1.1",
      pullRequest,
      releaseBranch: RELEASE_BRANCH,
      repository: REPOSITORY,
      ...overrides,
    };
  }

  it("accepts the single action-created 0.1.1 patch PR", () => {
    expect(validatePreparedReleasePullRequest(preparedState())).toEqual({
      pullRequestNumber: 31,
      version: "0.1.1",
    });
  });

  it("rejects an invented component in the pinned root-package title", () => {
    const state = preparedState();
    state.actionPullRequests[0].title = "chore(main): release cometapi 0.1.1";
    state.pullRequest.title = "chore(main): release cometapi 0.1.1";
    expect(() => validatePreparedReleasePullRequest(state)).toThrow(
      /release pull request title/i,
    );
  });

  it("accepts an unchanged existing action-authored PR when the action returns no output", () => {
    expect(
      validatePreparedReleasePullRequest(
        preparedState({
          actionPullRequests: [],
          actionPullRequestsCreated: false,
        }),
      ),
    ).toEqual({ pullRequestNumber: 31, version: "0.1.1" });
  });

  it.each([
    [
      "multiple action PRs",
      (state) =>
        state.actionPullRequests.push({
          ...state.actionPullRequests[0],
          number: 32,
        }),
    ],
    [
      "inconsistent creation output",
      (state) => (state.actionPullRequestsCreated = false),
    ],
    ["wrong manifest", (state) => (state.manifestVersion = "0.2.0")],
    ["wrong branch SHA", (state) => (state.branchSha = "c".repeat(40))],
    ["wrong lock root", (state) => (state.packageLockVersion = "0.2.0")],
    [
      "wrong lock package",
      (state) => (state.packageLockPackageVersion = "0.2.0"),
    ],
    [
      "wrong changed files",
      (state) => state.pullRequest.files.push("README.md"),
    ],
    ["unparseable body", (state) => (state.pullRequest.body = "ordinary PR")],
    ["wrong changelog", (state) => (state.changelog = "# Changelog\n")],
  ])("rejects a preparation with %s", (_name, mutate) => {
    const state = preparedState();
    mutate(state);
    expect(() => validatePreparedReleasePullRequest(state)).toThrow(
      /release workflow/i,
    );
  });

  it("rejects commit-level Release-As overrides before mutation", () => {
    expect(() =>
      validateReleasePleaseCommitMessages([
        "fix: ordinary patch",
        "fix: override\n\nRelease-As: 0.2.0",
      ]),
    ).toThrow(/Release-As/i);
  });

  it("accepts ordinary conventional commits without version overrides", () => {
    expect(
      validateReleasePleaseCommitMessages([
        "fix: options boundary",
        "fix: release workflow",
      ]),
    ).toEqual({ commitCount: 2 });
  });

  it.each([
    ["root", { "release-as": "0.2.0", packages: { ".": {} } }],
    ["package", { packages: { ".": { "release-as": "0.2.0" } } }],
  ])(
    "rejects a %s configuration-level release-as override",
    (_name, config) => {
      expect(() => validateReleasePleaseMutationConfiguration(config)).toThrow(
        /configuration-level release-as/i,
      );
    },
  );

  it("accepts an override-free Release Please configuration", () => {
    expect(
      validateReleasePleaseMutationConfiguration({
        packages: { ".": { versioning: "always-bump-patch" } },
      }),
    ).toEqual({ overrideFree: true });
  });

  it("accepts a Release Please 17.6.0 machine-readable body", () => {
    expect(
      validateReleasePleasePullRequestBody(releaseBody(), "0.1.1"),
    ).toEqual({ version: "0.1.1" });
  });

  it("extracts exactly the reviewed patch notes from CHANGELOG", () => {
    expect(
      extractReleaseNotesFromChangelog(
        `# Changelog\n\n${releaseNotes()}\n\n## [0.1.0] - 2026-07-28\n\nPrevious.`,
        "0.1.1",
      ),
    ).toBe(releaseNotes());
  });

  it("rejects a release PR whose notes differ from CHANGELOG", () => {
    expect(() =>
      validateReleasePleasePullRequestBody(
        releaseBody().replace("supported options", "different options"),
        "0.1.1",
        releaseNotes(),
      ),
    ).toThrow(/pull request notes/i);
  });

  it.each([
    [
      "the default repository PR template",
      "## Summary\n\nDescribe the change.",
    ],
    [
      "an overflow link",
      "This release is too large to preview in the pull request body. View the full release notes here: https://github.com/cometapi-dev/cometapi-node/blob/release-notes/release-notes.md",
    ],
    ["one delimiter", ":robot:\n---\n## [0.1.1] (2026-07-29)"],
    ["the wrong version", releaseBody("0.2.0")],
  ])("rejects %s as a release PR body", (_name, body) => {
    expect(() => validateReleasePleasePullRequestBody(body, "0.1.1")).toThrow(
      /release workflow/i,
    );
  });
});

describe("release PR review validation", () => {
  function reviewFixture() {
    return {
      commitId: BRANCH_SHA,
      id: 10,
      login: "human-owner",
      permission: "admin",
      state: "APPROVED",
      userType: "User",
    };
  }

  it("selects the unique pending release PR for the current push", () => {
    const pullRequest = pullRequestFixture({ merged: true });
    expect(
      selectPendingReleasePullRequest([pullRequest], {
        eventName: "push",
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
      }),
    ).toBe(pullRequest);
  });

  it("selects the exact merged PR on a verified release recovery rerun", () => {
    const pullRequest = pullRequestFixture({ merged: true });
    pullRequest.labels = ["autorelease: tagged"];
    expect(
      selectPendingReleasePullRequest([pullRequest], {
        eventName: "push",
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        releaseExists: true,
        repository: REPOSITORY,
        runAttempt: 2,
      }),
    ).toBe(pullRequest);
  });

  it("allows preparation when no pending merged release PR exists", () => {
    expect(
      selectPendingReleasePullRequest([pullRequestFixture()], {
        eventName: "workflow_dispatch",
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
      }),
    ).toBeNull();
  });

  it("rejects a rerun attempt that would prepare a release PR", () => {
    expect(() =>
      selectPendingReleasePullRequest([pullRequestFixture()], {
        eventName: "workflow_dispatch",
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 2,
      }),
    ).toThrow(/preparation run attempt/i);
  });

  it.each([
    [
      "an older merge",
      [pullRequestFixture({ merged: true })],
      { eventName: "push", releaseCommit: "c".repeat(40) },
    ],
    [
      "a manual release dispatch",
      [pullRequestFixture({ merged: true })],
      { eventName: "workflow_dispatch", releaseCommit: RELEASE_SHA },
    ],
    [
      "multiple pending merges",
      [
        pullRequestFixture({ merged: true }),
        { ...pullRequestFixture({ merged: true }), number: 32 },
      ],
      { eventName: "push", releaseCommit: RELEASE_SHA },
    ],
    [
      "an exact candidate plus an alternate pending merge",
      [
        pullRequestFixture({ merged: true }),
        {
          ...pullRequestFixture({ merged: true }),
          headRef: "release-cometapi-v0.1.0",
          mergeCommitSha: "c".repeat(40),
          number: 30,
        },
      ],
      { eventName: "push", releaseCommit: RELEASE_SHA },
    ],
    [
      "a legacy branch",
      [
        {
          ...pullRequestFixture({ merged: true }),
          headRef: "release-cometapi-v0.1.1",
        },
      ],
      { eventName: "push", releaseCommit: RELEASE_SHA },
    ],
    [
      "a v12 branch",
      [
        {
          ...pullRequestFixture({ merged: true }),
          headRef: "release-please--branches--main",
        },
      ],
      { eventName: "push", releaseCommit: RELEASE_SHA },
    ],
    [
      "a fork branch",
      [
        {
          ...pullRequestFixture({ merged: true }),
          headRepository: "fork/repo",
        },
      ],
      { eventName: "push", releaseCommit: RELEASE_SHA },
    ],
  ])(
    "rejects %s before Release Please runs",
    (_name, pullRequests, overrides) => {
      expect(() =>
        selectPendingReleasePullRequest(pullRequests, {
          eventName: overrides.eventName,
          releaseBranch: RELEASE_BRANCH,
          releaseCommit: overrides.releaseCommit,
          repository: REPOSITORY,
        }),
      ).toThrow(/release workflow/i);
    },
  );

  it("accepts an administrator's approval on the final release PR head", () => {
    expect(
      validateMergedReleasePullRequest({
        pullRequest: pullRequestFixture({ merged: true }),
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        reviews: [reviewFixture()],
        version: "0.1.1",
      }),
    ).toEqual({ pullRequestNumber: 31 });
  });

  it("accepts the reviewed release PR after an exact Release recovery removed the pending label", () => {
    const pullRequest = pullRequestFixture({ merged: true });
    pullRequest.labels = ["autorelease: tagged"];
    expect(
      validateMergedReleasePullRequest({
        pullRequest,
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        requirePendingLabel: false,
        reviews: [reviewFixture()],
        version: "0.1.1",
      }),
    ).toEqual({ pullRequestNumber: 31 });
  });

  it.each([
    ["stale commit", (review) => (review.commitId = "c".repeat(40))],
    ["non-admin", (review) => (review.permission = "maintain")],
    ["bot", (review) => (review.userType = "Bot")],
    ["PR author", (review) => (review.login = "github-actions[bot]")],
    ["changes requested", (review) => (review.state = "CHANGES_REQUESTED")],
  ])("rejects a %s review", (_name, mutate) => {
    const review = reviewFixture();
    mutate(review);
    expect(() =>
      validateMergedReleasePullRequest({
        pullRequest: pullRequestFixture({ merged: true }),
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        reviews: [review],
        version: "0.1.1",
      }),
    ).toThrow(/human approval/i);
  });

  it("uses each reviewer's latest decision", () => {
    const approval = reviewFixture();
    expect(() =>
      validateMergedReleasePullRequest({
        pullRequest: pullRequestFixture({ merged: true }),
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        reviews: [
          approval,
          { ...approval, id: 11, state: "CHANGES_REQUESTED" },
        ],
        version: "0.1.1",
      }),
    ).toThrow(/human approval/i);
  });

  it("accepts the exact merged release PR after label reconciliation", () => {
    const pullRequest = pullRequestFixture({ merged: true });
    pullRequest.labels = ["autorelease: tagged"];
    expect(
      validateTaggedReleasePullRequest({
        pullRequest,
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        version: "0.1.1",
      }),
    ).toEqual({ pullRequestNumber: 31 });
  });

  it.each([
    ["missing tagged label", []],
    [
      "remaining pending label",
      ["autorelease: pending", "autorelease: tagged"],
    ],
  ])("rejects a tagged release PR with %s", (_name, labels) => {
    const pullRequest = pullRequestFixture({ merged: true });
    pullRequest.labels = labels;
    expect(() =>
      validateTaggedReleasePullRequest({
        pullRequest,
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        version: "0.1.1",
      }),
    ).toThrow(/autorelease state/i);
  });
});

describe("release workflow trust validation", () => {
  function currentRunFixture() {
    return {
      created_at: "2026-07-29T00:00:00Z",
      event: "push",
      head_branch: "main",
      head_sha: RELEASE_SHA,
      id: RUN_ID,
      repository: { full_name: REPOSITORY },
      run_attempt: 1,
    };
  }

  it("accepts exact current run metadata and returns its original creation time", () => {
    expect(
      validateReleasePleaseRunMetadata(currentRunFixture(), {
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 1,
        runId: RUN_ID,
      }),
    ).toEqual({ createdAt: "2026-07-29T00:00:00Z" });
  });

  it.each([
    ["run ID", (run) => (run.id += 1)],
    ["attempt", (run) => (run.run_attempt = 2)],
    ["event", (run) => (run.event = "workflow_dispatch")],
    ["branch", (run) => (run.head_branch = "feature")],
    ["SHA", (run) => (run.head_sha = "b".repeat(40))],
    ["repository", (run) => (run.repository.full_name = "fork/repo")],
    ["creation time", (run) => (run.created_at = "not-a-date")],
  ])("rejects mismatched current run %s", (_name, mutate) => {
    const run = currentRunFixture();
    mutate(run);
    expect(() =>
      validateReleasePleaseRunMetadata(run, {
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 1,
        runId: RUN_ID,
      }),
    ).toThrow(/release workflow/i);
  });

  it("accepts the exact successful first-attempt main run", () => {
    expect(
      validateReleaseWorkflowRun(workflowRunFixture(), {
        checkedOutSha: RELEASE_SHA,
        repository: REPOSITORY,
        workflowName: "Release Please",
        workflowPath: ".github/workflows/release-please.yml",
      }),
    ).toEqual({ releaseCommit: RELEASE_SHA, runAttempt: 1, runId: RUN_ID });
  });

  it.each([
    ["action", (event) => (event.action = "requested")],
    ["conclusion", (event) => (event.workflow_run.conclusion = "failure")],
    ["event", (event) => (event.workflow_run.event = "workflow_dispatch")],
    ["head branch", (event) => (event.workflow_run.head_branch = "feature")],
    [
      "head repository",
      (event) => (event.workflow_run.head_repository.full_name = "fork/repo"),
    ],
    ["repository", (event) => (event.repository.full_name = "fork/repo")],
    ["workflow name", (event) => (event.workflow_run.name = "Other")],
    ["workflow path", (event) => (event.workflow_run.path = "other.yml")],
    ["workflow SHA", (event) => (event.workflow_run.head_sha = "b".repeat(40))],
  ])("rejects a hostile or stale %s", (_name, mutate) => {
    const event = workflowRunFixture();
    mutate(event);
    expect(() =>
      validateReleaseWorkflowRun(event, {
        checkedOutSha: RELEASE_SHA,
        repository: REPOSITORY,
        workflowName: "Release Please",
        workflowPath: ".github/workflows/release-please.yml",
      }),
    ).toThrow(/release workflow/i);
  });

  it("accepts an exact successful recovery rerun", () => {
    const event = workflowRunFixture();
    event.workflow_run.run_attempt = 2;
    expect(
      validateReleaseWorkflowRun(event, {
        checkedOutSha: RELEASE_SHA,
        repository: REPOSITORY,
        workflowName: "Release Please",
        workflowPath: ".github/workflows/release-please.yml",
      }),
    ).toEqual({ releaseCommit: RELEASE_SHA, runAttempt: 2, runId: RUN_ID });
  });

  it.each([0, "2", 1.5])("rejects invalid run attempt %j", (runAttempt) => {
    const event = workflowRunFixture();
    event.workflow_run.run_attempt = runAttempt;
    expect(() =>
      validateReleaseWorkflowRun(event, {
        checkedOutSha: RELEASE_SHA,
        repository: REPOSITORY,
        workflowName: "Release Please",
        workflowPath: ".github/workflows/release-please.yml",
      }),
    ).toThrow(/run attempt/i);
  });

  it("requires an exact immutable release published during the same run before recovery", () => {
    expect(
      validateReleasePresenceBeforeAction({
        attempts: [attemptEvidenceFixture(1)],
        expectedReleaseNotes: releaseNotes(),
        release: releaseFixture(),
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 2,
        runCreatedAt: "2026-07-29T00:00:00Z",
        runId: RUN_ID,
        tagCommit: RELEASE_SHA,
        version: "0.1.1",
      }),
    ).toEqual({ exists: true, releaseSourceAttempt: 1 });
  });

  it.each([
    ["first attempt", { runAttempt: 1 }],
    ["pre-run publication", { runCreatedAt: "2026-07-29T00:02:00Z" }],
    ["missing tag", { tagCommit: null }],
    [
      "release outside the prior action step",
      { release: releaseFixture({ publishedAt: "2026-07-29T00:01:31Z" }) },
    ],
  ])("rejects a %s release recovery", (_name, overrides) => {
    expect(() =>
      validateReleasePresenceBeforeAction({
        attempts: [attemptEvidenceFixture(1)],
        expectedReleaseNotes: releaseNotes(),
        release: releaseFixture(),
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 2,
        runCreatedAt: "2026-07-29T00:00:00Z",
        runId: RUN_ID,
        tagCommit: RELEASE_SHA,
        version: "0.1.1",
        ...overrides,
      }),
    ).toThrow(/release workflow/i);
  });

  it.each([
    [
      "skipped Release Please step",
      (attempts) => (attempts[0].jobs[0].steps[0].conclusion = "skipped"),
    ],
    ["wrong run ID", (attempts) => (attempts[0].jobs[0].run_id = RUN_ID + 1)],
    [
      "wrong head SHA",
      (attempts) => (attempts[0].jobs[0].head_sha = "b".repeat(40)),
    ],
  ])("rejects recovery attempt evidence with a %s", (_name, mutate) => {
    const attempts = [attemptEvidenceFixture(1)];
    mutate(attempts);
    expect(() =>
      validateReleasePresenceBeforeAction({
        attempts,
        expectedReleaseNotes: releaseNotes(),
        release: releaseFixture(),
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 2,
        runCreatedAt: "2026-07-29T00:00:00Z",
        runId: RUN_ID,
        tagCommit: RELEASE_SHA,
        version: "0.1.1",
      }),
    ).toThrow(/release workflow/i);
  });

  it("accepts an absent release before any exact attempt", () => {
    expect(
      validateReleasePresenceBeforeAction({
        attempts: [],
        expectedReleaseNotes: releaseNotes(),
        release: null,
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 1,
        runCreatedAt: "2026-07-29T00:00:00Z",
        runId: RUN_ID,
        tagCommit: null,
        version: "0.1.1",
      }),
    ).toEqual({ exists: false });
  });

  it("accepts a Release Please failure after it created the exact immutable release", () => {
    expect(
      validateReleasePleaseCompletion({
        actionResult: { outcome: "failure" },
        attempts: [attemptEvidenceFixture(1, { conclusion: "failure" })],
        expectedReleaseNotes: releaseNotes(),
        release: releaseFixture(),
        releaseCommit: RELEASE_SHA,
        releaseExistedBeforeAction: false,
        repository: REPOSITORY,
        runAttempt: 1,
        runCreatedAt: "2026-07-29T00:00:00Z",
        runId: RUN_ID,
        tagCommit: RELEASE_SHA,
        version: "0.1.1",
      }),
    ).toMatchObject({
      actionOutcome: "failure",
      recovered: true,
      releaseCreated: true,
      releaseExistedBeforeAction: false,
      releaseSourceAttempt: 1,
      tagName: "v0.1.1",
    });
  });

  it("accepts a later attempt that creates the release after a pre-mutation failure", () => {
    expect(
      validateReleasePleaseCompletion({
        actionResult: {
          htmlUrl: releaseUrl(),
          outcome: "success",
          releaseCreated: true,
          releasedPaths: ["."],
          sha: RELEASE_SHA,
          tagName: "v0.1.1",
          version: "0.1.1",
        },
        attempts: [
          attemptEvidenceFixture(1, {
            completedAt: "2026-07-29T00:00:10Z",
            conclusion: "failure",
            startedAt: "2026-07-29T00:00:05Z",
          }),
          attemptEvidenceFixture(2),
        ],
        expectedReleaseNotes: releaseNotes(),
        release: releaseFixture(),
        releaseCommit: RELEASE_SHA,
        releaseExistedBeforeAction: false,
        repository: REPOSITORY,
        runAttempt: 2,
        runCreatedAt: "2026-07-29T00:00:00Z",
        runId: RUN_ID,
        tagCommit: RELEASE_SHA,
        version: "0.1.1",
      }),
    ).toMatchObject({
      actionOutcome: "success",
      recovered: false,
      releaseExistedBeforeAction: false,
      releaseSourceAttempt: 2,
    });
  });

  it.each([
    ["success", true],
    ["failure", true],
  ])(
    "accepts an exact pre-existing release when the recovery action reports %s",
    (outcome, recovered) => {
      expect(
        validateReleasePleaseCompletion({
          actionResult: { outcome, releaseCreated: false },
          attempts: [
            attemptEvidenceFixture(1),
            attemptEvidenceFixture(2, {
              completedAt: "2026-07-29T00:02:30Z",
              conclusion: outcome,
              startedAt: "2026-07-29T00:02:00Z",
            }),
          ],
          expectedReleaseNotes: releaseNotes(),
          release: releaseFixture(),
          releaseCommit: RELEASE_SHA,
          releaseExistedBeforeAction: true,
          repository: REPOSITORY,
          runAttempt: 2,
          runCreatedAt: "2026-07-29T00:00:00Z",
          runId: RUN_ID,
          tagCommit: RELEASE_SHA,
          version: "0.1.1",
        }),
      ).toMatchObject({
        actionOutcome: outcome,
        recovered,
        releaseSourceAttempt: 1,
      });
    },
  );

  it("rejects an action failure that did not create the release", () => {
    expect(() =>
      validateReleasePleaseCompletion({
        actionResult: { outcome: "failure" },
        attempts: [attemptEvidenceFixture(1, { conclusion: "failure" })],
        expectedReleaseNotes: releaseNotes(),
        release: null,
        releaseCommit: RELEASE_SHA,
        releaseExistedBeforeAction: false,
        repository: REPOSITORY,
        runAttempt: 1,
        runCreatedAt: "2026-07-29T00:00:00Z",
        runId: RUN_ID,
        tagCommit: null,
        version: "0.1.1",
      }),
    ).toThrow(/release workflow/i);
  });

  it("accepts the exact Release Please outputs artifact", () => {
    expect(
      validateReleasePleaseActionResult(actionResultFixture(), {
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 1,
        runId: RUN_ID,
        version: "0.1.1",
        workflowName: "Release Please",
        workflowPath: ".github/workflows/release-please.yml",
      }),
    ).toEqual({
      htmlUrl: releaseUrl(),
      releaseCommit: RELEASE_SHA,
      tag: "v0.1.1",
      version: "0.1.1",
    });
  });

  it.each([
    ["schema", (result) => (result.schemaVersion = 1)],
    ["action outcome", (result) => (result.actionOutcome = "cancelled")],
    ["release_created", (result) => (result.releaseCreated = false)],
    ["repository", (result) => (result.repository = "fork/repo")],
    ["run ID", (result) => (result.runId += 1)],
    ["run attempt", (result) => (result.runAttempt += 1)],
    ["recovery flag", (result) => (result.recovered = true)],
    ["recovery flag type", (result) => (result.recovered = "false")],
    [
      "pre-action release flag type",
      (result) => (result.releaseExistedBeforeAction = "false"),
    ],
    ["release source attempt", (result) => (result.releaseSourceAttempt = 2)],
    ["SHA", (result) => (result.sha = "b".repeat(40))],
    ["tag", (result) => (result.tagName = "v0.2.0")],
    ["version", (result) => (result.version = "0.2.0")],
    ["URL", (result) => (result.htmlUrl = `${releaseUrl()}-other`)],
    ["workflow name", (result) => (result.workflowName = "Other")],
    ["workflow path", (result) => (result.workflowPath = "other.yml")],
  ])("rejects a mismatched action result %s", (_name, mutate) => {
    const result = actionResultFixture();
    mutate(result);
    expect(() =>
      validateReleasePleaseActionResult(result, {
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 1,
        runId: RUN_ID,
        version: "0.1.1",
        workflowName: "Release Please",
        workflowPath: ".github/workflows/release-please.yml",
      }),
    ).toThrow(/release (?:please|workflow)/i);
  });

  it("accepts an exact run-bound recovery artifact", () => {
    const result = actionResultFixture();
    result.actionOutcome = "failure";
    result.recovered = true;
    result.releaseExistedBeforeAction = true;
    result.releaseSourceAttempt = 1;
    result.runAttempt = 2;
    expect(
      validateReleasePleaseActionResult(result, {
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 2,
        runId: RUN_ID,
        version: "0.1.1",
        workflowName: "Release Please",
        workflowPath: ".github/workflows/release-please.yml",
      }),
    ).toMatchObject({ tag: "v0.1.1", version: "0.1.1" });
  });

  it("accepts an exact second-attempt artifact that created the release", () => {
    const result = actionResultFixture();
    result.releaseSourceAttempt = 2;
    result.runAttempt = 2;
    expect(
      validateReleasePleaseActionResult(result, {
        releaseCommit: RELEASE_SHA,
        repository: REPOSITORY,
        runAttempt: 2,
        runId: RUN_ID,
        version: "0.1.1",
        workflowName: "Release Please",
        workflowPath: ".github/workflows/release-please.yml",
      }),
    ).toMatchObject({ tag: "v0.1.1", version: "0.1.1" });
  });

  it.each([
    [1, 2],
    [2, 1],
  ])(
    "rejects attempt %i evidence for workflow attempt %i",
    (artifactAttempt, workflowAttempt) => {
      const result = actionResultFixture();
      result.runAttempt = artifactAttempt;
      expect(() =>
        validateReleasePleaseActionResult(result, {
          releaseCommit: RELEASE_SHA,
          repository: REPOSITORY,
          runAttempt: workflowAttempt,
          runId: RUN_ID,
          version: "0.1.1",
          workflowName: "Release Please",
          workflowPath: ".github/workflows/release-please.yml",
        }),
      ).toThrow(/run attempt/i);
    },
  );

  it("accepts the exact immutable Release Please release", () => {
    expect(
      validateGitHubRelease(releaseFixture(), {
        expectedBody: releaseNotes(),
        htmlUrl: releaseUrl(),
        releaseCommit: RELEASE_SHA,
        tag: "v0.1.1",
        tagCommit: RELEASE_SHA,
      }),
    ).toEqual({ prerelease: false });
  });

  it.each([
    ["mutable", (release) => (release.immutable = false)],
    ["draft", (release) => (release.draft = true)],
    ["wrong tag", (release) => (release.tag_name = "v0.2.0")],
    ["wrong name", (release) => (release.name = "v0.2.0")],
    ["wrong target", (release) => (release.target_commitish = "b".repeat(40))],
    ["wrong URL", (release) => (release.html_url = `${releaseUrl()}-other`)],
    ["unpublished", (release) => (release.published_at = null)],
    ["manual author", (release) => (release.author.login = "maintainer")],
    ["unreviewed notes", (release) => (release.body = "changed notes")],
  ])("rejects a %s GitHub release", (_name, mutate) => {
    const release = releaseFixture();
    mutate(release);
    expect(() =>
      validateGitHubRelease(release, {
        expectedBody: releaseNotes(),
        htmlUrl: releaseUrl(),
        releaseCommit: RELEASE_SHA,
        tag: "v0.1.1",
        tagCommit: RELEASE_SHA,
      }),
    ).toThrow(/release workflow/i);
  });

  it("rejects a tag that does not resolve to the workflow commit", () => {
    expect(() =>
      validateGitHubRelease(releaseFixture(), {
        expectedBody: releaseNotes(),
        htmlUrl: releaseUrl(),
        releaseCommit: RELEASE_SHA,
        tag: "v0.1.1",
        tagCommit: "b".repeat(40),
      }),
    ).toThrow(/tag commit/i);
  });

  it("rejects a same-name fork PR introduced before the final mutation check", () => {
    expect(() =>
      validateOpenReleasePullRequestCollisions(
        [
          {
            baseRef: "main",
            headRef: RELEASE_BRANCH,
            headRepository: "fork/repo",
            headSha: "c".repeat(40),
            state: "open",
          },
        ],
        {
          branchSha: null,
          releaseBranch: RELEASE_BRANCH,
          repository: REPOSITORY,
        },
      ),
    ).toThrow(/collide/i);
  });

  it("accepts only the release label transition after the action", () => {
    const before = [pullRequestFixture({ merged: true })];
    const after = JSON.parse(JSON.stringify(before));
    after[0].labels = ["autorelease: tagged"];
    expect(
      validatePostActionPullRequestSnapshot(before, after, {
        releasePullRequestNumber: 31,
      }),
    ).toEqual({ unchanged: true });
  });

  it.each([
    ["body", (pullRequest) => (pullRequest.body = "changed")],
    ["head SHA", (pullRequest) => (pullRequest.headSha = "c".repeat(40))],
    [
      "new pull request",
      (_pullRequest, after) => after.push({ ...after[0], number: 32 }),
    ],
  ])(
    "rejects a post-action pull request snapshot with a changed %s",
    (_name, mutate) => {
      const before = [pullRequestFixture({ merged: true })];
      const after = JSON.parse(JSON.stringify(before));
      mutate(after[0], after);
      expect(() =>
        validatePostActionPullRequestSnapshot(before, after, {
          releasePullRequestNumber: 31,
        }),
      ).toThrow(/snapshot/i);
    },
  );
});
