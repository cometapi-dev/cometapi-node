const STABLE_VERSION_PATTERN = /^0\.1\.(0|[1-9]\d*)$/;
const RELEASE_PR_FILES = [
  ".release-please-manifest.json",
  "CHANGELOG.md",
  "package-lock.json",
  "package.json",
];

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

export function validateReleasePleasePullRequestBody(body, version) {
  stablePatch(version, "release pull request body version");
  if (typeof body !== "string") {
    fail("Release workflow release pull request body must be a string.");
  }
  const lines = body.trim().replace(/\r\n/g, "\n").split("\n");
  const firstDelimiter = lines.indexOf("---");
  const lastDelimiter = lines.lastIndexOf("---");
  if (firstDelimiter < 0 || lastDelimiter <= firstDelimiter) {
    fail(
      "Release workflow release pull request body must contain the two Release Please delimiters.",
    );
  }
  const releaseNotes = lines
    .slice(firstDelimiter + 1, lastDelimiter)
    .join("\n")
    .trim();
  const versionMatch = releaseNotes.match(
    /^#{2,} \[?(\d+\.\d+\.\d+(?:-[^\]\s]+)?)\]?/,
  );
  if (!versionMatch) {
    fail(
      "Release workflow release pull request body must begin its release notes with a version heading.",
    );
  }
  requireEqual(versionMatch[1], version, "release pull request body version");
  return { version };
}

function requireReleasePullRequest(
  pullRequest,
  { branchSha, branchVersion, releaseBranch, repository },
) {
  if (pullRequest === null || typeof pullRequest !== "object") {
    fail("Release workflow release pull request metadata must be an object.");
  }
  requirePositiveInteger(pullRequest.number, "release pull request number");
  requireCommit(pullRequest.headSha, "release pull request head SHA");
  requireCommit(branchSha, "expected release pull request head SHA");
  requireEqual(
    pullRequest.author,
    "github-actions[bot]",
    "release pull request author",
  );
  requireEqual(pullRequest.baseRef, "main", "release pull request base");
  requireEqual(pullRequest.headRef, releaseBranch, "release pull request head");
  requireEqual(
    pullRequest.headRepository,
    repository,
    "release pull request head repository",
  );
  requireEqual(pullRequest.headSha, branchSha, "release pull request head SHA");
  requireEqual(
    pullRequest.title,
    releaseTitle(branchVersion),
    "release pull request title",
  );
  requirePendingLabel(pullRequest.labels, "release pull request");
  validateReleasePleasePullRequestBody(pullRequest.body, branchVersion);
}

export function selectPendingReleasePullRequest(
  pullRequests,
  { eventName, releaseBranch, releaseCommit, repository },
) {
  if (!Array.isArray(pullRequests)) {
    fail("Release workflow pending release pull requests must be an array.");
  }
  requireCommit(releaseCommit, "current release commit");
  const pendingReleasePullRequests = pullRequests.filter(
    (pullRequest) =>
      pullRequest?.baseRef === "main" &&
      pullRequest?.state === "closed" &&
      pullRequest?.mergedAt !== null &&
      Array.isArray(pullRequest?.labels) &&
      pullRequest.labels.includes("autorelease: pending"),
  );
  if (pendingReleasePullRequests.length > 1) {
    fail("Release workflow found multiple pending merged release PRs.");
  }
  if (pendingReleasePullRequests.length === 0) {
    requireEqual(eventName, "workflow_dispatch", "release preparation event");
    return null;
  }

  const pullRequest = pendingReleasePullRequests[0];
  requireEqual(
    pullRequest.headRef,
    releaseBranch,
    "pending release pull request head",
  );
  requireEqual(
    pullRequest.headRepository,
    repository,
    "pending release pull request head repository",
  );
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
  conflictingOpenPullRequests = [],
  exists,
  isAncestor,
  mainVersion,
  manifestVersion,
  pullRequests = [],
  releaseBranch,
  repository,
}) {
  if (typeof exists !== "boolean" || typeof isAncestor !== "boolean") {
    fail("Release Please branch state flags must be boolean.");
  }
  if (!Array.isArray(pullRequests)) {
    fail("Release Please branch pull requests must be an array.");
  }
  if (!Array.isArray(conflictingOpenPullRequests)) {
    fail("Release Please conflicting open pull requests must be an array.");
  }
  if (conflictingOpenPullRequests.length > 0) {
    fail(
      "Release Please found an open pull request whose head can collide with the canonical release branch.",
    );
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
    repository,
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
  repository,
  reviews,
  version,
}) {
  requireCommit(releaseCommit, "release commit");
  stablePatch(version, "release version");
  requireReleasePullRequest(pullRequest, {
    branchSha: pullRequest?.headSha,
    branchVersion: version,
    releaseBranch,
    repository,
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

export function validateReleaseCandidatePullRequest({
  pullRequest,
  releaseBranch,
  repository,
  version,
}) {
  requireReleasePullRequest(pullRequest, {
    branchSha: pullRequest?.headSha,
    branchVersion: version,
    releaseBranch,
    repository,
  });
  return pullRequest;
}

export function validatePreparedReleasePullRequest({
  actionPullRequests,
  branchSha,
  branchVersion,
  changelog,
  mainVersion,
  manifestVersion,
  packageLockPackageVersion,
  packageLockVersion,
  pullRequest,
  releaseBranch,
  repository,
}) {
  if (!Array.isArray(actionPullRequests) || actionPullRequests.length !== 1) {
    fail(
      "Release workflow preparation must create or update exactly one release pull request.",
    );
  }
  const actionPullRequest = actionPullRequests[0];
  if (
    actionPullRequest === null ||
    typeof actionPullRequest !== "object" ||
    Array.isArray(actionPullRequest)
  ) {
    fail("Release workflow action pull request output must be an object.");
  }

  const mainPatch = stablePatch(mainVersion, "preparation main version");
  const branchPatch = stablePatch(
    branchVersion,
    "preparation release branch version",
  );
  if (branchPatch !== mainPatch + 1) {
    fail("Release workflow preparation must produce the next stable patch.");
  }
  requireEqual(manifestVersion, branchVersion, "preparation manifest version");
  requireEqual(
    packageLockVersion,
    branchVersion,
    "preparation package-lock version",
  );
  requireEqual(
    packageLockPackageVersion,
    branchVersion,
    "preparation package-lock root package version",
  );

  requireReleasePullRequest(pullRequest, {
    branchSha,
    branchVersion,
    releaseBranch,
    repository,
  });
  if (pullRequest.state !== "open" || pullRequest.mergedAt !== null) {
    fail("Release workflow prepared release pull request must be open.");
  }
  const changedFiles = Array.isArray(pullRequest.files)
    ? [...pullRequest.files].sort()
    : [];
  requireEqual(
    JSON.stringify(changedFiles),
    JSON.stringify(RELEASE_PR_FILES),
    "prepared release pull request files",
  );

  requirePositiveInteger(
    actionPullRequest.number,
    "action pull request number",
  );
  requireEqual(
    actionPullRequest.number,
    pullRequest.number,
    "action pull request number",
  );
  requireEqual(
    actionPullRequest.baseBranchName,
    pullRequest.baseRef,
    "action pull request base",
  );
  requireEqual(
    actionPullRequest.headBranchName,
    pullRequest.headRef,
    "action pull request head",
  );
  requireEqual(
    actionPullRequest.title,
    pullRequest.title,
    "action pull request title",
  );
  requireEqual(
    actionPullRequest.body,
    pullRequest.body,
    "action pull request body",
  );
  requirePendingLabel(actionPullRequest.labels, "action pull request");
  if (!Array.isArray(actionPullRequest.files)) {
    fail("Release workflow action pull request files must be an array.");
  }

  if (typeof changelog !== "string") {
    fail("Release workflow prepared CHANGELOG must be a string.");
  }
  const escapedVersion = branchVersion.replaceAll(".", "\\.");
  const releaseHeading = new RegExp(
    `^#{2,3} \\[?${escapedVersion}\\]?(?:\\([^\\n]+\\))? (?:\\(\\d{4}-\\d{2}-\\d{2}\\)|- \\d{4}-\\d{2}-\\d{2})$`,
    "gm",
  );
  if ([...changelog.matchAll(releaseHeading)].length !== 1) {
    fail(
      "Release workflow prepared CHANGELOG must contain exactly one dated release heading for the patch.",
    );
  }

  return { pullRequestNumber: pullRequest.number, version: branchVersion };
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
