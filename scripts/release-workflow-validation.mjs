const STABLE_VERSION_PATTERN = /^0\.1\.(0|[1-9]\d*)$/;
const RELEASE_PR_FILES = [
  ".release-please-manifest.json",
  "CHANGELOG.md",
  "package-lock.json",
  "package.json",
];
const RELEASE_PR_HEADER = ":robot: I have created a release *beep* *boop*";
const RELEASE_PR_FOOTER =
  "This PR was generated with [Release Please](https://github.com/googleapis/release-please). See [documentation](https://github.com/googleapis/release-please#release-please).";
const RELEASE_WORKFLOW_JOB =
  "Prepare a reviewed release pull request or GitHub release";
const RELEASE_WORKFLOW_STEP = "Run Release Please";

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

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    fail(`Release workflow ${label} must be boolean.`);
  }
}

function requireTimestamp(value, label) {
  if (
    typeof value !== "string" ||
    value === "" ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail(`Release workflow ${label} must be an ISO timestamp.`);
  }
  return Date.parse(value);
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
  return `chore(main): release ${version}`;
}

function normalizeMarkdown(value, label) {
  if (typeof value !== "string") {
    fail(`Release workflow ${label} must be a string.`);
  }
  return value.trim().replace(/\r\n/g, "\n");
}

export function extractReleaseNotesFromChangelog(changelog, version) {
  stablePatch(version, "CHANGELOG release version");
  const lines = normalizeMarkdown(changelog, "CHANGELOG").split("\n");
  const escapedVersion = version.replaceAll(".", "\\.");
  const releaseHeading = new RegExp(
    `^## \\[?${escapedVersion}\\]?(?:\\([^\\n]+\\))? (?:\\(\\d{4}-\\d{2}-\\d{2}\\)|- \\d{4}-\\d{2}-\\d{2})$`,
  );
  const releaseHeadingIndexes = lines
    .map((line, index) => (releaseHeading.test(line) ? index : -1))
    .filter((index) => index !== -1);
  if (releaseHeadingIndexes.length !== 1) {
    fail(
      "Release workflow CHANGELOG must contain exactly one dated release heading for the patch.",
    );
  }
  const start = releaseHeadingIndexes[0];
  const nextRelease = lines.findIndex(
    (line, index) => index > start && /^##\s/.test(line),
  );
  const notes = lines.slice(
    start,
    nextRelease === -1 ? undefined : nextRelease,
  );
  return normalizeMarkdown(notes.join("\n"), "CHANGELOG release notes");
}

function requirePendingLabel(labels, label) {
  if (!Array.isArray(labels) || !labels.includes("autorelease: pending")) {
    fail(`Release workflow ${label} must have the autorelease: pending label.`);
  }
}

export function validateReleasePleasePullRequestBody(
  body,
  version,
  expectedReleaseNotes,
) {
  stablePatch(version, "release pull request body version");
  const lines = normalizeMarkdown(body, "release pull request body").split(
    "\n",
  );
  const firstDelimiter = lines.indexOf("---");
  const lastDelimiter = lines.lastIndexOf("---");
  if (firstDelimiter < 0 || lastDelimiter <= firstDelimiter) {
    fail(
      "Release workflow release pull request body must contain the two Release Please delimiters.",
    );
  }
  requireEqual(
    lines.slice(0, firstDelimiter).join("\n").trim(),
    RELEASE_PR_HEADER,
    "release pull request body header",
  );
  requireEqual(
    lines
      .slice(lastDelimiter + 1)
      .join("\n")
      .trim(),
    RELEASE_PR_FOOTER,
    "release pull request body footer",
  );
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
  if (expectedReleaseNotes !== undefined) {
    requireEqual(
      releaseNotes,
      normalizeMarkdown(expectedReleaseNotes, "expected release notes"),
      "release pull request notes",
    );
  }
  return { version };
}

function requireReleasePullRequest(
  pullRequest,
  {
    branchSha,
    branchVersion,
    releaseBranch,
    repository,
    requirePending = true,
    expectedReleaseNotes,
  },
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
  if (requirePending) {
    requirePendingLabel(pullRequest.labels, "release pull request");
  } else if (!Array.isArray(pullRequest.labels)) {
    fail("Release workflow release pull request labels must be an array.");
  }
  validateReleasePleasePullRequestBody(
    pullRequest.body,
    branchVersion,
    expectedReleaseNotes,
  );
}

export function validateReleasePleaseCommitMessages(messages) {
  if (!Array.isArray(messages)) {
    fail("Release Please commit messages must be an array.");
  }
  for (const message of messages) {
    if (typeof message !== "string") {
      fail("Release Please commit messages must contain only strings.");
    }
    if (/^release-as\s*:/im.test(message)) {
      fail(
        "Release Please commit-level Release-As overrides are forbidden during 0.1.x maintenance.",
      );
    }
  }
  return { commitCount: messages.length };
}

export function validateReleasePleaseMutationConfiguration(config) {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    fail("Release Please configuration must be an object.");
  }
  const packageConfig = config.packages?.["."];
  if (
    Object.hasOwn(config, "release-as") ||
    (packageConfig !== null &&
      typeof packageConfig === "object" &&
      Object.hasOwn(packageConfig, "release-as"))
  ) {
    fail(
      "Release Please configuration-level release-as overrides are forbidden during 0.1.x maintenance.",
    );
  }
  return { overrideFree: true };
}

export function validateOpenReleasePullRequestCollisions(
  pullRequests,
  { branchSha, releaseBranch, repository },
) {
  if (!Array.isArray(pullRequests)) {
    fail("Release Please open pull requests must be an array.");
  }
  if (branchSha !== null && branchSha !== undefined) {
    requireCommit(branchSha, "Release Please branch SHA");
  }
  const conflicts = pullRequests.filter(
    (pullRequest) =>
      pullRequest?.baseRef === "main" &&
      pullRequest?.headRef === releaseBranch &&
      pullRequest?.state === "open" &&
      (pullRequest?.headRepository !== repository ||
        pullRequest?.headSha !== branchSha),
  );
  if (conflicts.length > 0) {
    fail(
      "Release Please found an open pull request whose head can collide with the canonical release branch.",
    );
  }
  return { conflictCount: 0 };
}

function normalizePullRequestSnapshot(pullRequests, releasePullRequestNumber) {
  if (!Array.isArray(pullRequests)) {
    fail("Release workflow pull request snapshot must be an array.");
  }
  requirePositiveInteger(
    releasePullRequestNumber,
    "snapshot release pull request number",
  );
  const numbers = new Set();
  return pullRequests
    .map((pullRequest) => {
      requirePositiveInteger(
        pullRequest?.number,
        "snapshot pull request number",
      );
      if (numbers.has(pullRequest.number)) {
        fail("Release workflow pull request snapshot numbers must be unique.");
      }
      numbers.add(pullRequest.number);
      const labels = Array.isArray(pullRequest.labels)
        ? [...pullRequest.labels].sort()
        : fail(
            "Release workflow snapshot pull request labels must be an array.",
          );
      return {
        author: pullRequest.author,
        baseRef: pullRequest.baseRef,
        body: pullRequest.body,
        headRef: pullRequest.headRef,
        headRepository: pullRequest.headRepository,
        headSha: pullRequest.headSha,
        labels:
          pullRequest.number === releasePullRequestNumber
            ? labels.filter(
                (label) =>
                  label !== "autorelease: pending" &&
                  label !== "autorelease: tagged",
              )
            : labels,
        mergeCommitSha: pullRequest.mergeCommitSha,
        mergedAt: pullRequest.mergedAt,
        number: pullRequest.number,
        state: pullRequest.state,
        title: pullRequest.title,
      };
    })
    .sort((left, right) => left.number - right.number);
}

export function validatePostActionPullRequestSnapshot(
  before,
  after,
  { releasePullRequestNumber },
) {
  requireEqual(
    JSON.stringify(
      normalizePullRequestSnapshot(before, releasePullRequestNumber),
    ),
    JSON.stringify(
      normalizePullRequestSnapshot(after, releasePullRequestNumber),
    ),
    "post-action pull request snapshot",
  );
  return { unchanged: true };
}

export function selectPendingReleasePullRequest(
  pullRequests,
  {
    eventName,
    releaseBranch,
    releaseCommit,
    releaseExists = false,
    repository,
    runAttempt = 1,
  },
) {
  if (!Array.isArray(pullRequests)) {
    fail("Release workflow pending release pull requests must be an array.");
  }
  requireCommit(releaseCommit, "current release commit");
  requireBoolean(releaseExists, "pre-action release existence");
  requirePositiveInteger(runAttempt, "run attempt");
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
    if (eventName === "push" && releaseExists) {
      if (runAttempt === 1) {
        fail(
          "Release workflow recovery is forbidden on the first run attempt.",
        );
      }
      const recoveryPullRequests = pullRequests.filter(
        (pullRequest) =>
          pullRequest?.baseRef === "main" &&
          pullRequest?.state === "closed" &&
          pullRequest?.mergedAt !== null &&
          pullRequest?.mergeCommitSha === releaseCommit,
      );
      if (recoveryPullRequests.length !== 1) {
        fail(
          "Release workflow recovery requires exactly one merged pull request for the release commit.",
        );
      }
      const recoveryPullRequest = recoveryPullRequests[0];
      requireEqual(
        recoveryPullRequest.headRef,
        releaseBranch,
        "recovery release pull request head",
      );
      requireEqual(
        recoveryPullRequest.headRepository,
        repository,
        "recovery release pull request head repository",
      );
      return recoveryPullRequest;
    }
    requireEqual(eventName, "workflow_dispatch", "release preparation event");
    requireEqual(runAttempt, 1, "release preparation run attempt");
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
  requirePendingLabel = true,
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
  const mainPatch = stablePatch(mainVersion, "main version");
  if (!exists) {
    return { state: "missing" };
  }

  requireCommit(branchSha, "Release Please branch SHA");
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
    requirePending: requirePendingLabel,
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
  expectedReleaseNotes,
  pullRequest,
  releaseBranch,
  releaseCommit,
  repository,
  requirePendingLabel = true,
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
    requirePending: requirePendingLabel,
    expectedReleaseNotes,
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
  expectedReleaseNotes,
  pullRequest,
  releaseBranch,
  repository,
  requirePendingLabel = true,
  version,
}) {
  requireReleasePullRequest(pullRequest, {
    branchSha: pullRequest?.headSha,
    branchVersion: version,
    releaseBranch,
    repository,
    requirePending: requirePendingLabel,
    expectedReleaseNotes,
  });
  return pullRequest;
}

export function validateTaggedReleasePullRequest({
  expectedReleaseNotes,
  pullRequest,
  releaseBranch,
  releaseCommit,
  repository,
  version,
}) {
  requireCommit(releaseCommit, "release commit");
  validateReleaseCandidatePullRequest({
    pullRequest,
    releaseBranch,
    repository,
    requirePendingLabel: false,
    version,
    expectedReleaseNotes,
  });
  if (pullRequest.state !== "closed" || pullRequest.mergedAt === null) {
    fail("Release workflow tagged release pull request must be merged.");
  }
  requireEqual(
    pullRequest.mergeCommitSha,
    releaseCommit,
    "tagged release pull request merge commit",
  );
  if (
    !pullRequest.labels.includes("autorelease: tagged") ||
    pullRequest.labels.includes("autorelease: pending")
  ) {
    fail(
      "Release workflow tagged release pull request must have only the completed autorelease state.",
    );
  }
  return { pullRequestNumber: pullRequest.number };
}

export function validatePreparedReleasePullRequest({
  actionPullRequests,
  actionPullRequestsCreated,
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
  if (!Array.isArray(actionPullRequests) || actionPullRequests.length > 1) {
    fail(
      "Release workflow preparation must return at most one release pull request.",
    );
  }
  requireBoolean(
    actionPullRequestsCreated,
    "preparation pull request creation output",
  );
  requireEqual(
    actionPullRequests.length,
    actionPullRequestsCreated ? 1 : 0,
    "preparation action pull request count",
  );

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

  const expectedReleaseNotes = extractReleaseNotesFromChangelog(
    changelog,
    branchVersion,
  );

  requireReleasePullRequest(pullRequest, {
    branchSha,
    branchVersion,
    releaseBranch,
    repository,
    expectedReleaseNotes,
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

  const actionPullRequest = actionPullRequests[0];
  if (actionPullRequest !== undefined) {
    if (
      actionPullRequest === null ||
      typeof actionPullRequest !== "object" ||
      Array.isArray(actionPullRequest)
    ) {
      fail("Release workflow action pull request output must be an object.");
    }
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
  }

  return { pullRequestNumber: pullRequest.number, version: branchVersion };
}

function releasePublishedAt(release) {
  const releasePublished = requireTimestamp(
    release?.published_at,
    "GitHub release publication time",
  );
  return releasePublished;
}

function requireReleasePublishedDuringRun(release, runCreatedAt) {
  const runCreated = requireTimestamp(runCreatedAt, "run creation time");
  const releasePublished = releasePublishedAt(release);
  if (releasePublished < runCreated) {
    fail(
      "Release workflow cannot recover a Release published before this run.",
    );
  }
}

export function validateReleaseAttemptEvidence(
  attempts,
  { includeCurrentAttempt, release, releaseCommit, runAttempt, runId },
) {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    fail("Release workflow attempt evidence must be a non-empty array.");
  }
  requireCommit(releaseCommit, "release commit");
  requirePositiveInteger(runAttempt, "run attempt");
  requirePositiveInteger(runId, "run ID");
  requireBoolean(
    includeCurrentAttempt,
    "attempt evidence current-attempt state",
  );
  const releasePublished = releasePublishedAt(release);
  const seenAttempts = new Set();
  const matchingAttempts = [];

  for (const attemptEvidence of attempts) {
    const attempt = attemptEvidence?.attempt;
    requirePositiveInteger(attempt, "attempt evidence number");
    if (attempt > runAttempt || seenAttempts.has(attempt)) {
      fail(
        "Release workflow attempt evidence must contain unique attempts no later than the current attempt.",
      );
    }
    seenAttempts.add(attempt);
    if (!Array.isArray(attemptEvidence.jobs)) {
      fail("Release workflow attempt evidence jobs must be an array.");
    }
    const releaseJobs = attemptEvidence.jobs.filter(
      (job) => job?.name === RELEASE_WORKFLOW_JOB,
    );
    if (releaseJobs.length !== 1) {
      fail(
        "Release workflow attempt evidence must contain exactly one release job.",
      );
    }
    const job = releaseJobs[0];
    requireEqual(job.run_id, runId, "attempt evidence run ID");
    requireEqual(job.run_attempt, attempt, "attempt evidence run attempt");
    requireEqual(job.head_sha, releaseCommit, "attempt evidence head SHA");
    if (!Array.isArray(job.steps)) {
      fail("Release workflow attempt evidence job steps must be an array.");
    }
    const releaseSteps = job.steps.filter(
      (step) => step?.name === RELEASE_WORKFLOW_STEP,
    );
    if (releaseSteps.length !== 1) {
      fail(
        "Release workflow attempt evidence must contain exactly one Release Please step.",
      );
    }
    const step = releaseSteps[0];
    if (
      step.status !== "completed" ||
      (step.conclusion !== "success" && step.conclusion !== "failure")
    ) {
      continue;
    }
    const stepStarted = requireTimestamp(
      step.started_at,
      "Release Please step start time",
    );
    const stepCompleted = requireTimestamp(
      step.completed_at,
      "Release Please step completion time",
    );
    if (stepCompleted < stepStarted) {
      fail(
        "Release workflow Release Please step cannot finish before it starts.",
      );
    }
    if (releasePublished >= stepStarted && releasePublished <= stepCompleted) {
      matchingAttempts.push(attempt);
    }
  }
  const finalExpectedAttempt = includeCurrentAttempt
    ? runAttempt
    : runAttempt - 1;
  if (
    finalExpectedAttempt < 1 ||
    seenAttempts.size !== finalExpectedAttempt ||
    !Array.from(
      { length: finalExpectedAttempt },
      (_value, index) => index + 1,
    ).every((attempt) => seenAttempts.has(attempt))
  ) {
    fail(
      "Release workflow attempt evidence must cover every expected run attempt.",
    );
  }

  if (matchingAttempts.length !== 1) {
    fail(
      "Release workflow Release creation must match exactly one executed Release Please attempt.",
    );
  }
  return { releaseSourceAttempt: matchingAttempts[0] };
}

export function validateReleasePresenceBeforeAction({
  attempts,
  expectedReleaseNotes,
  release,
  releaseCommit,
  repository,
  runAttempt,
  runCreatedAt,
  runId,
  tagCommit,
  version,
}) {
  requireCommit(releaseCommit, "release commit");
  requirePositiveInteger(runAttempt, "run attempt");
  requirePositiveInteger(runId, "run ID");
  stablePatch(version, "release version");
  requireTimestamp(runCreatedAt, "run creation time");
  const releaseExists = release !== null && release !== undefined;
  const tagExists = tagCommit !== null && tagCommit !== undefined;
  if (releaseExists !== tagExists) {
    fail("Release workflow tag and GitHub Release existence must agree.");
  }
  if (!releaseExists) {
    return { exists: false };
  }
  if (runAttempt === 1) {
    fail("Release workflow recovery is forbidden on the first run attempt.");
  }

  const tag = `v${version}`;
  const htmlUrl = `https://github.com/${repository}/releases/tag/${tag}`;
  validateGitHubRelease(release, {
    expectedBody: expectedReleaseNotes,
    htmlUrl,
    releaseCommit,
    tag,
    tagCommit,
  });
  requireReleasePublishedDuringRun(release, runCreatedAt);
  const evidence = validateReleaseAttemptEvidence(attempts, {
    includeCurrentAttempt: false,
    release,
    releaseCommit,
    runAttempt,
    runId,
  });
  if (evidence.releaseSourceAttempt >= runAttempt) {
    fail("Release workflow recovery must come from an earlier run attempt.");
  }
  return { exists: true, ...evidence };
}

export function classifyPushReleasePresence({
  currentRelease,
  currentTagCommit,
  headCommit,
  manifestVersion,
  packageChanged,
  previousVersion,
  version,
}) {
  requireCommit(headCommit, "push head commit");
  requireBoolean(packageChanged, "push package.json change state");
  const previousPatch = stablePatch(previousVersion, "push previous version");
  const currentPatch = stablePatch(version, "push current version");
  requireEqual(
    manifestVersion,
    version,
    "push manifest and package version agreement",
  );
  const releaseExists = currentRelease !== null && currentRelease !== undefined;
  const tagExists = currentTagCommit !== null && currentTagCommit !== undefined;
  if (releaseExists !== tagExists) {
    fail(
      "Release workflow current tag and GitHub Release existence must agree.",
    );
  }
  if (currentPatch === previousPatch) {
    if (packageChanged) {
      fail(
        "Release workflow package.json push must change the stable package version.",
      );
    }
    if (!releaseExists) {
      fail(
        "Release workflow ignored push must retain the exact published current version.",
      );
    }
    requireCommit(currentTagCommit, "published current tag commit");
    requireEqual(
      currentTagCommit,
      currentRelease?.target_commitish,
      "published current release target",
    );
    requireEqual(
      currentRelease?.tag_name,
      `v${version}`,
      "published current release tag",
    );
    requireEqual(
      currentRelease?.draft,
      false,
      "published current release draft state",
    );
    requireEqual(
      currentRelease?.prerelease,
      false,
      "published current release prerelease state",
    );
    requireEqual(
      currentRelease?.immutable,
      true,
      "published current release immutable state",
    );
    return { mode: "ignore", version };
  }
  if (currentPatch !== previousPatch + 1) {
    fail("Release workflow push must increment exactly one stable patch.");
  }
  if (!packageChanged) {
    fail("Release workflow version-changing push must include package.json.");
  }
  if (releaseExists) {
    requireCommit(currentTagCommit, "candidate tag commit");
    if (currentTagCommit !== headCommit) {
      fail(
        "Release workflow candidate tag must target the triggering commit before recovery.",
      );
    }
  }
  return { mode: "release", version };
}

export function validateReleasePleaseCompletion({
  actionResult,
  attempts,
  expectedReleaseNotes,
  release,
  releaseCommit,
  releaseExistedBeforeAction,
  repository,
  runAttempt,
  runCreatedAt,
  runId,
  tagCommit,
  version,
}) {
  if (
    actionResult === null ||
    typeof actionResult !== "object" ||
    Array.isArray(actionResult)
  ) {
    fail("Release Please action result must be an object.");
  }
  if (
    actionResult.outcome !== "success" &&
    actionResult.outcome !== "failure"
  ) {
    fail("Release Please action outcome must be success or failure.");
  }
  requireBoolean(releaseExistedBeforeAction, "pre-action release existence");
  requirePositiveInteger(runAttempt, "run attempt");
  requirePositiveInteger(runId, "run ID");
  if (releaseExistedBeforeAction && runAttempt === 1) {
    fail("Release workflow recovery is forbidden on the first run attempt.");
  }
  requireCommit(releaseCommit, "release commit");
  stablePatch(version, "release version");
  const tagName = `v${version}`;
  const htmlUrl = `https://github.com/${repository}/releases/tag/${tagName}`;
  validateGitHubRelease(release, {
    expectedBody: expectedReleaseNotes,
    htmlUrl,
    releaseCommit,
    tag: tagName,
    tagCommit,
  });
  requireReleasePublishedDuringRun(release, runCreatedAt);
  const evidence = validateReleaseAttemptEvidence(attempts, {
    includeCurrentAttempt: true,
    release,
    releaseCommit,
    runAttempt,
    runId,
  });
  if (
    (releaseExistedBeforeAction &&
      evidence.releaseSourceAttempt >= runAttempt) ||
    (!releaseExistedBeforeAction &&
      evidence.releaseSourceAttempt !== runAttempt)
  ) {
    fail(
      "Release workflow Release source attempt must match its pre-action state.",
    );
  }

  if (!releaseExistedBeforeAction && actionResult.outcome === "success") {
    requireEqual(actionResult.releaseCreated, true, "release_created output");
    requireEqual(actionResult.sha, releaseCommit, "release output SHA");
    requireEqual(actionResult.tagName, tagName, "release output tag");
    requireEqual(actionResult.version, version, "release output version");
    requireEqual(actionResult.htmlUrl, htmlUrl, "release output URL");
    const releasedPaths = Array.isArray(actionResult.releasedPaths)
      ? actionResult.releasedPaths
      : [];
    requireEqual(
      JSON.stringify(releasedPaths),
      JSON.stringify(["."]),
      "released paths output",
    );
  }
  if (releaseExistedBeforeAction && actionResult.releaseCreated === true) {
    fail(
      "Release Please cannot create a Release that existed before the action.",
    );
  }

  return {
    actionOutcome: actionResult.outcome,
    htmlUrl,
    recovered: actionResult.outcome === "failure" || releaseExistedBeforeAction,
    releaseCreated: true,
    releaseExistedBeforeAction,
    releaseSourceAttempt: evidence.releaseSourceAttempt,
    sha: releaseCommit,
    tagName,
    version,
  };
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
  requireEqual(result.schemaVersion, 2, "result schema version");
  if (
    result.actionOutcome !== "success" &&
    result.actionOutcome !== "failure"
  ) {
    fail("Release Please action outcome must be success or failure.");
  }
  requireBoolean(result.recovered, "result recovered state");
  requireBoolean(
    result.releaseExistedBeforeAction,
    "result pre-action release existence",
  );
  requirePositiveInteger(
    result.releaseSourceAttempt,
    "result release source attempt",
  );
  requireEqual(
    result.recovered,
    result.actionOutcome === "failure" || result.releaseExistedBeforeAction,
    "result recovered state",
  );
  requireEqual(result.releaseCreated, true, "release_created output");
  requireEqual(result.repository, repository, "result repository");
  requireEqual(result.workflowName, workflowName, "result workflow name");
  requireEqual(result.workflowPath, workflowPath, "result workflow path");
  requirePositiveInteger(runId, "run ID");
  requirePositiveInteger(result.runId, "result run ID");
  requireEqual(result.runId, runId, "result run ID");
  requirePositiveInteger(runAttempt, "run attempt");
  requireEqual(result.runAttempt, runAttempt, "result run attempt");
  if (
    (result.releaseExistedBeforeAction &&
      result.releaseSourceAttempt >= runAttempt) ||
    (!result.releaseExistedBeforeAction &&
      result.releaseSourceAttempt !== runAttempt)
  ) {
    fail(
      "Release workflow result source attempt must match its pre-action state.",
    );
  }
  if (result.releaseExistedBeforeAction && runAttempt === 1) {
    fail("Release workflow recovery is forbidden on the first run attempt.");
  }
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
  requirePositiveInteger(run?.run_attempt, "run attempt");
  requireCommit(run?.head_sha, "run head SHA");
  requireCommit(checkedOutSha, "checked-out SHA");
  requireEqual(run.head_sha, checkedOutSha, "run head SHA");

  return {
    releaseCommit: run.head_sha,
    runAttempt: run.run_attempt,
    runId: run.id,
  };
}

export function validateReleasePleaseRunMetadata(
  run,
  { releaseCommit, repository, runAttempt, runId },
) {
  if (run === null || typeof run !== "object" || Array.isArray(run)) {
    fail("Release workflow current run metadata must be an object.");
  }
  requirePositiveInteger(runId, "current run ID");
  requireEqual(run.id, runId, "current run ID");
  requirePositiveInteger(runAttempt, "current run attempt");
  requireEqual(run.run_attempt, runAttempt, "current run attempt");
  requireEqual(run.event, "push", "current run event");
  requireEqual(run.head_branch, "main", "current run head branch");
  requireCommit(releaseCommit, "release commit");
  requireEqual(run.head_sha, releaseCommit, "current run head SHA");
  requireEqual(run.repository?.full_name, repository, "current run repository");
  requireTimestamp(run.created_at, "current run creation time");
  return { createdAt: run.created_at };
}

export function validateGitHubRelease(
  release,
  { expectedBody, htmlUrl, releaseCommit, tag, tagCommit },
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
  requireEqual(
    normalizeMarkdown(release?.body, "GitHub release body"),
    normalizeMarkdown(expectedBody, "expected GitHub release body"),
    "GitHub release body",
  );
  releasePublishedAt(release);

  const prerelease = tag.slice(1).includes("-");
  requireEqual(
    release?.prerelease,
    prerelease,
    "GitHub release prerelease state",
  );
  return { prerelease };
}
