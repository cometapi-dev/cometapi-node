const STABLE_VERSION_PATTERN = /^0\.1\.(0|[1-9]\d*)$/;

function fail(message) {
  throw new Error(message);
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(
      `Release workflow ${label} must equal ${String(expected)}; received ${String(actual)}.`,
    );
  }
}

function requireCommit(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/.test(value)) {
    fail(`Release workflow ${label} must be a full lowercase commit SHA.`);
  }
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    fail(`Release workflow ${label} must be a positive integer.`);
  }
}

function stablePatch(version, label) {
  const match =
    typeof version === "string" && version.match(STABLE_VERSION_PATTERN);
  if (!match) {
    fail(`Release workflow ${label} must be a stable 0.1.x version.`);
  }
  return Number(match[1]);
}

function releaseTitle(version) {
  return `chore(main): release cometapi ${version}`;
}

function requirePendingLabel(labels, label) {
  if (!Array.isArray(labels) || !labels.includes("autorelease: pending")) {
    fail(`Release workflow ${label} must have the autorelease: pending label.`);
  }
}

function requireReleasePullRequest(
  pullRequest,
  { branchSha, branchVersion, releaseBranch },
) {
  if (pullRequest === null || typeof pullRequest !== "object") {
    fail("Release workflow release pull request metadata must be an object.");
  }
  requirePositiveInteger(pullRequest.number, "release pull request number");
  requireCommit(pullRequest.headSha, "release pull request head SHA");
  requireCommit(branchSha, "expected release pull request head SHA");
  requireEqual(pullRequest.baseRef, "main", "release pull request base");
  requireEqual(pullRequest.headRef, releaseBranch, "release pull request head");
  requireEqual(pullRequest.headSha, branchSha, "release pull request head SHA");
  requireEqual(
    pullRequest.title,
    releaseTitle(branchVersion),
    "release pull request title",
  );
  requirePendingLabel(pullRequest.labels, "release pull request");
}

export function selectPendingReleasePullRequest(
  pullRequests,
  { eventName, releaseBranch, releaseCommit },
) {
  if (!Array.isArray(pullRequests)) {
    fail("Release workflow pending release pull requests must be an array.");
  }
  requireCommit(releaseCommit, "current release commit");
  const pendingReleasePullRequests = pullRequests.filter(
    (pullRequest) =>
      pullRequest?.baseRef === "main" &&
      pullRequest?.headRef === releaseBranch &&
      pullRequest?.state === "closed" &&
      pullRequest?.mergedAt !== null &&
      Array.isArray(pullRequest?.labels) &&
      pullRequest.labels.includes("autorelease: pending"),
  );
  if (pendingReleasePullRequests.length > 1) {
    fail("Release workflow found multiple pending merged release PRs.");
  }
  if (pendingReleasePullRequests.length === 0) {
    return null;
  }

  const pullRequest = pendingReleasePullRequests[0];
  requireEqual(
    pullRequest.mergeCommitSha,
    releaseCommit,
    "pending release pull request merge commit",
  );
  requireEqual(eventName, "push", "pending release event");
  return pullRequest;
}

export function validateReleasePleaseBranchState({
  branchSha,
  branchVersion,
  exists,
  isAncestor,
  mainVersion,
  manifestVersion,
  pullRequests = [],
  releaseBranch,
}) {
  if (typeof exists !== "boolean" || typeof isAncestor !== "boolean") {
    fail("Release Please branch state flags must be boolean.");
  }
  if (!Array.isArray(pullRequests)) {
    fail("Release Please branch pull requests must be an array.");
  }
  if (!exists) {
    return { state: "missing" };
  }

  requireCommit(branchSha, "Release Please branch SHA");
  const mainPatch = stablePatch(mainVersion, "main version");
  const branchPatch = stablePatch(
    branchVersion,
    "Release Please branch version",
  );
  requireEqual(
    manifestVersion,
    branchVersion,
    "Release Please branch manifest version",
  );

  if (isAncestor) {
    requireEqual(
      branchVersion,
      mainVersion,
      "merged Release Please branch version",
    );
    return { state: "merged-ancestor" };
  }

  if (pullRequests.length !== 1) {
    fail(
      "Release Please branch is divergent and does not have exactly one matching release PR.",
    );
  }
  const pullRequest = pullRequests[0];
  requireReleasePullRequest(pullRequest, {
    branchSha,
    branchVersion,
    releaseBranch,
  });

  if (pullRequest.state === "open" && pullRequest.mergedAt === null) {
    if (branchPatch !== mainPatch + 1) {
      fail("Open Release Please branch must contain the next stable patch.");
    }
    return { pullRequestNumber: pullRequest.number, state: "open" };
  }

  if (pullRequest.state === "closed" && pullRequest.mergedAt !== null) {
    requireEqual(
      branchVersion,
      mainVersion,
      "merged Release Please branch version",
    );
    requireEqual(
      pullRequest.mergeCommitIsAncestor,
      true,
      "release pull request merge reachability",
    );
    return { pullRequestNumber: pullRequest.number, state: "merged-pr" };
  }

  fail("Release Please branch is associated only with an unmerged closed PR.");
}

export function validateMergedReleasePullRequest({
  pullRequest,
  releaseBranch,
  releaseCommit,
  reviews,
  version,
}) {
  requireCommit(releaseCommit, "release commit");
  stablePatch(version, "release version");
  requireReleasePullRequest(pullRequest, {
    branchSha: pullRequest?.headSha,
    branchVersion: version,
    releaseBranch,
  });
  if (pullRequest.state !== "closed" || pullRequest.mergedAt === null) {
    fail("Release workflow release pull request must be merged.");
  }
  requireEqual(
    pullRequest.mergeCommitSha,
    releaseCommit,
    "release pull request merge commit",
  );
  if (!Array.isArray(reviews)) {
    fail("Release workflow release pull request reviews must be an array.");
  }

  const latestReviewByUser = new Map();
  for (const review of reviews) {
    if (
      review &&
      typeof review.login === "string" &&
      Number.isInteger(review.id) &&
      (!latestReviewByUser.has(review.login) ||
        latestReviewByUser.get(review.login).id < review.id)
    ) {
      latestReviewByUser.set(review.login, review);
    }
  }
  const approvedByHumanOwner = [...latestReviewByUser.values()].some(
    (review) =>
      review.state === "APPROVED" &&
      review.commitId === pullRequest.headSha &&
      review.permission === "admin" &&
      review.userType === "User" &&
      review.login !== pullRequest.author,
  );
  if (!approvedByHumanOwner) {
    fail(
      "Release workflow requires an administrator's human approval on the final release PR head.",
    );
  }

  return { pullRequestNumber: pullRequest.number };
}

export function validateReleasePleaseActionResult(
  result,
  {
    releaseCommit,
    repository,
    runAttempt,
    runId,
    version,
    workflowName,
    workflowPath,
  },
) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    fail("Release Please result artifact must be an object.");
  }
  requireEqual(result.schemaVersion, 1, "result schema version");
  requireEqual(result.releaseCreated, true, "release_created output");
  requireEqual(result.repository, repository, "result repository");
  requireEqual(result.workflowName, workflowName, "result workflow name");
  requireEqual(result.workflowPath, workflowPath, "result workflow path");
  requirePositiveInteger(runId, "run ID");
  requirePositiveInteger(result.runId, "result run ID");
  requireEqual(result.runId, runId, "result run ID");
  requireEqual(runAttempt, 1, "run attempt");
  requireEqual(result.runAttempt, runAttempt, "result run attempt");
  requireCommit(releaseCommit, "release commit");
  requireCommit(result.sha, "result SHA");
  requireEqual(result.sha, releaseCommit, "result SHA");
  stablePatch(version, "release version");
  requireEqual(result.version, version, "result version");
  requireEqual(result.tagName, `v${version}`, "result tag name");
  requireEqual(
    result.htmlUrl,
    `https://github.com/${repository}/releases/tag/${result.tagName}`,
    "result release URL",
  );

  return {
    htmlUrl: result.htmlUrl,
    releaseCommit: result.sha,
    tag: result.tagName,
    version: result.version,
  };
}

export function validateReleaseWorkflowRun(
  event,
  { checkedOutSha, repository, workflowName, workflowPath },
) {
  const run = event?.workflow_run;
  requireEqual(event?.action, "completed", "run action");
  requireEqual(event?.repository?.full_name, repository, "run repository");
  requireEqual(run?.name, workflowName, "run workflow name");
  requireEqual(run?.path, workflowPath, "run workflow path");
  requireEqual(run?.conclusion, "success", "run conclusion");
  requireEqual(run?.event, "push", "run event");
  requireEqual(run?.head_branch, "main", "run head branch");
  requireEqual(
    run?.head_repository?.full_name,
    repository,
    "run head repository",
  );
  requirePositiveInteger(run?.id, "run ID");
  requireEqual(run?.run_attempt, 1, "run attempt");
  requireCommit(run?.head_sha, "run head SHA");
  requireCommit(checkedOutSha, "checked-out SHA");
  requireEqual(run.head_sha, checkedOutSha, "run head SHA");

  return {
    releaseCommit: run.head_sha,
    runAttempt: run.run_attempt,
    runId: run.id,
  };
}

export function validateGitHubRelease(
  release,
  { htmlUrl, releaseCommit, tag, tagCommit },
) {
  requireCommit(releaseCommit, "release commit");
  requireCommit(tagCommit, "tag commit");
  requireEqual(tagCommit, releaseCommit, "GitHub release tag commit");
  requireEqual(release?.immutable, true, "GitHub release immutable state");
  requireEqual(release?.draft, false, "GitHub release draft state");
  requireEqual(
    release?.author?.login,
    "github-actions[bot]",
    "GitHub release author",
  );
  requireEqual(release?.tag_name, tag, "GitHub release tag");
  requireEqual(release?.name, tag, "GitHub release name");
  requireEqual(
    release?.target_commitish,
    releaseCommit,
    "GitHub release target",
  );
  requireEqual(release?.html_url, htmlUrl, "GitHub release URL");
  if (
    typeof release?.published_at !== "string" ||
    release.published_at === ""
  ) {
    fail("Release workflow GitHub release must be published.");
  }

  const prerelease = tag.slice(1).includes("-");
  requireEqual(
    release?.prerelease,
    prerelease,
    "GitHub release prerelease state",
  );
  return { prerelease };
}
