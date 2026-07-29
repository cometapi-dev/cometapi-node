import { describe, expect, it } from "vitest";

import {
  validatePreparedReleasePullRequest,
  validateGitHubRelease,
  validateMergedReleasePullRequest,
  validateReleasePleasePullRequestBody,
  validateReleasePleaseActionResult,
  validateReleasePleaseBranchState,
  validateReleaseWorkflowRun,
  selectPendingReleasePullRequest,
} from "../scripts/release-workflow-validation.mjs";

const REPOSITORY = "cometapi-dev/cometapi-node";
const RELEASE_BRANCH = "release-please--branches--main--components--cometapi";
const RELEASE_SHA = "a".repeat(40);
const BRANCH_SHA = "b".repeat(40);
const RUN_ID = 123456789;

function releaseBody(version = "0.1.1") {
  return `:robot: I have created a release *beep* *boop*
---


## [${version}](https://github.com/cometapi-dev/cometapi-node/compare/v0.1.0...v${version}) (2026-07-29)

### Bug Fixes

* enforce the supported options boundary

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please).`;
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
    title: `chore(main): release cometapi ${version}`,
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
    htmlUrl: `${releaseUrl()}`,
    releaseCreated: true,
    repository: REPOSITORY,
    runAttempt: 1,
    runId: RUN_ID,
    schemaVersion: 1,
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

function releaseFixture() {
  return {
    author: { login: "github-actions[bot]" },
    draft: false,
    html_url: releaseUrl(),
    immutable: true,
    name: "v0.1.1",
    prerelease: false,
    published_at: "2026-07-29T00:01:00Z",
    tag_name: "v0.1.1",
    target_commitish: RELEASE_SHA,
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
    ).toThrow(/release workflow/i);
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
      branchSha: BRANCH_SHA,
      branchVersion: "0.1.1",
      changelog: releaseBody(),
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

  it.each([
    ["no action PR", (state) => (state.actionPullRequests = [])],
    [
      "multiple action PRs",
      (state) =>
        state.actionPullRequests.push({
          ...state.actionPullRequests[0],
          number: 32,
        }),
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

  it("accepts a Release Please 17.6.0 machine-readable body", () => {
    expect(
      validateReleasePleasePullRequestBody(releaseBody(), "0.1.1"),
    ).toEqual({ version: "0.1.1" });
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
});

describe("release workflow trust validation", () => {
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
    ["rerun", (event) => (event.workflow_run.run_attempt = 2)],
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
    ["release_created", (result) => (result.releaseCreated = false)],
    ["repository", (result) => (result.repository = "fork/repo")],
    ["run ID", (result) => (result.runId += 1)],
    ["run attempt", (result) => (result.runAttempt = 2)],
    ["SHA", (result) => (result.sha = "b".repeat(40))],
    ["tag", (result) => (result.tagName = "v0.2.0")],
    ["version", (result) => (result.version = "0.2.0")],
    ["URL", (result) => (result.htmlUrl = `${releaseUrl()}-other`)],
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
    ).toThrow(/release workflow/i);
  });

  it("accepts the exact immutable Release Please release", () => {
    expect(
      validateGitHubRelease(releaseFixture(), {
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
  ])("rejects a %s GitHub release", (_name, mutate) => {
    const release = releaseFixture();
    mutate(release);
    expect(() =>
      validateGitHubRelease(release, {
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
        htmlUrl: releaseUrl(),
        releaseCommit: RELEASE_SHA,
        tag: "v0.1.1",
        tagCommit: "b".repeat(40),
      }),
    ).toThrow(/tag commit/i);
  });
});
