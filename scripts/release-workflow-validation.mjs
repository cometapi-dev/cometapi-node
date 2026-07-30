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
const PUBLISH_OPERATION = "release";
const PUBLISH_RECOVERY = Object.freeze({
  actor: "tensornull",
  artifactDigest:
    "sha256:567b00f1ec32168d5c5be7d0b553542441920d3bb401959bcc2d6e157f35d08b",
  artifactId: 8731956162,
  artifactName: "npm-package-0.1.1-30471665743-1",
  changedFiles: Object.freeze([
    ".github/workflows/publish.yml",
    ".github/workflows/release-please.yml",
    "RELEASING.md",
    "scripts/release-workflow-validation.mjs",
    "tests/release-workflow-validation.test.mjs",
    "tests/workflow-contract.test.mjs",
  ]),
  dispatchControlParent: "5f493045a2205fe19904ca5be36f5bbf23378aec",
  dispatchTask: "recover-v0.1.1",
  failedPublishJobId: 90643868523,
  liveJobId: 90643725110,
  releaseCommit: "c98b514227858cd183c781270a7f78f65b577e82",
  releaseRunAttempt: 1,
  releaseRunId: 30469181724,
  releaseTag: "v0.1.1",
  permanentTagPolicyId: 55718965,
  sourcePublishCommit: "22c313d4f80c53ba01672dd35cc27b621d5ec9ce",
  sourcePublishRunAttempt: 1,
  sourcePublishRunId: 30471665743,
  verifyJobId: 90643169818,
});

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

export function validatePublishWorkflowContract(workflow) {
  if (
    workflow === null ||
    typeof workflow !== "object" ||
    Array.isArray(workflow)
  ) {
    fail("Release workflow Publish definition must be an object.");
  }
  requireEqual(workflow.name, "Publish", "Publish workflow name");
  const inputs = workflow.on?.workflow_dispatch?.inputs;
  if (inputs === null || typeof inputs !== "object" || Array.isArray(inputs)) {
    fail(
      "Release workflow Publish workflow_dispatch inputs must be an object.",
    );
  }
  for (const name of [
    "publish_operation",
    "control_commit",
    "release_commit",
    "release_tag",
    "release_run_id",
    "release_run_attempt",
  ]) {
    requireEqual(inputs[name]?.required, true, `Publish ${name} requirement`);
    requireEqual(inputs[name]?.type, "string", `Publish ${name} type`);
  }
  for (const name of [
    "source_publish_run_id",
    "source_publish_run_attempt",
    "recovery_policy_id",
  ]) {
    requireEqual(inputs[name]?.required, false, `Publish ${name} requirement`);
    requireEqual(inputs[name]?.type, "string", `Publish ${name} type`);
  }
  requireEqual(
    JSON.stringify(workflow.on?.workflow_run),
    JSON.stringify({ workflows: ["Release Please"], types: ["completed"] }),
    "Publish workflow_run trigger",
  );
  requireEqual(
    JSON.stringify(workflow.permissions),
    JSON.stringify({ actions: "read", checks: "read", contents: "read" }),
    "Publish default permissions",
  );
  requireEqual(
    JSON.stringify(workflow.concurrency),
    JSON.stringify({ group: "npm-publish", "cancel-in-progress": false }),
    "Publish workflow concurrency",
  );
  const jobs = workflow.jobs;
  if (jobs === null || typeof jobs !== "object" || Array.isArray(jobs)) {
    fail("Release workflow Publish jobs must be an object.");
  }
  requireEqual(
    JSON.stringify(Object.keys(jobs).sort()),
    JSON.stringify(["handoff", "live-smoke", "publish", "verify"]),
    "Publish job set",
  );
  requireEqual(
    JSON.stringify(jobs.handoff?.permissions),
    JSON.stringify({ actions: "write", contents: "read" }),
    "Publish handoff permissions",
  );
  requireEqual(
    jobs.handoff?.environment,
    undefined,
    "Publish handoff environment",
  );
  const handoffIf = jobs.handoff?.if;
  for (const fragment of [
    "vars.RELEASE_PLEASE_ENABLED == 'true'",
    "github.event_name == 'workflow_run'",
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_branch == 'main'",
  ]) {
    if (typeof handoffIf !== "string" || !handoffIf.includes(fragment)) {
      fail(`Release workflow Publish handoff must require ${fragment}.`);
    }
  }
  const dispatchStep = jobs.handoff?.steps?.find(
    (step) => step?.name === "Dispatch the exact immutable tag",
  );
  for (const fragment of [
    "actions/runs/${publish_run_id}/jobs",
    "The tag-bound Publish verify job did not become observable.",
  ]) {
    if (
      typeof dispatchStep?.run === "string" &&
      dispatchStep.run.includes(fragment)
    ) {
      fail(
        `Release workflow Publish handoff must stop after exact run discovery and cannot contain ${fragment}.`,
      );
    }
  }
  const handoffResultStep = jobs.handoff?.steps?.find(
    (step) => step?.name === "Classify the exact Release Please handoff",
  );
  if (typeof handoffResultStep?.run !== "string") {
    fail(
      "Release workflow Publish handoff must classify the exact Release Please result before download.",
    );
  }
  for (const stepName of [
    "Install validation dependencies without lifecycle scripts",
    "Download the exact Release Please result",
    "Validate the exact release and tag dispatch contract",
    "Dispatch the exact immutable tag",
  ]) {
    const step = jobs.handoff?.steps?.find(
      (candidate) => candidate?.name === stepName,
    );
    if (
      typeof step?.if !== "string" ||
      !step.if.includes("steps.result.outputs.has-result == 'true'")
    ) {
      fail(
        `Release workflow Publish handoff ${stepName} must require an exact result.`,
      );
    }
  }
  for (const fragment of [
    "actions/workflows/publish.yml/dispatches",
    "tag-dispatch-runs-before.json",
    "Multiple Publish runs matched the immutable tag handoff.",
    '-f ref="$RELEASE_TAG"',
    '-f "inputs[publish_operation]=release"',
    '-f "inputs[control_commit]=$RELEASE_COMMIT"',
  ]) {
    if (
      typeof dispatchStep?.run !== "string" ||
      !dispatchStep.run.includes(fragment)
    ) {
      fail(
        `Release workflow Publish handoff dispatch must contain ${fragment}.`,
      );
    }
  }
  requireEqual(
    jobs.verify?.environment,
    undefined,
    "Publish verify environment",
  );
  requireEqual(
    jobs.verify?.permissions,
    undefined,
    "Publish verify job permissions",
  );
  const verifyIf = jobs.verify?.if;
  for (const fragment of [
    "github.event_name == 'workflow_dispatch'",
    "inputs.publish_operation == 'release'",
    "startsWith(github.ref, 'refs/tags/v0.1.')",
    "github.ref == format('refs/tags/{0}', inputs.release_tag)",
    "github.sha == inputs.release_commit",
    "github.workflow_sha == inputs.control_commit",
    "inputs.control_commit == inputs.release_commit",
    "inputs.recovery_policy_id != ''",
  ]) {
    if (typeof verifyIf !== "string" || !verifyIf.includes(fragment)) {
      fail(`Release workflow Publish verify must require ${fragment}.`);
    }
  }
  for (const [name, job] of Object.entries(jobs)) {
    if (
      name !== "handoff" &&
      JSON.stringify(job).includes("github.event.workflow_run")
    ) {
      fail(
        `Release workflow Publish ${name} cannot consume workflow_run context.`,
      );
    }
  }
  requireEqual(
    jobs["live-smoke"]?.environment,
    "live-smoke",
    "live environment",
  );
  requireEqual(
    jobs["live-smoke"]?.permissions,
    undefined,
    "Publish live-smoke permissions",
  );
  requireEqual(
    JSON.stringify(jobs["live-smoke"]?.needs),
    JSON.stringify(["verify"]),
    "Publish live-smoke dependencies",
  );
  const requireUniqueStep = (job, name, label) => {
    const matches = Array.isArray(job?.steps)
      ? job.steps.filter((step) => step?.name === name)
      : [];
    requireEqual(matches.length, 1, `${label} step count`);
    return matches[0];
  };
  requireEqual(
    jobs.verify?.outputs?.["release-please-snapshot"],
    "${{ steps.release-please-snapshot.outputs.digest }}",
    "Publish Release Please snapshot output",
  );
  const releasePleaseSnapshotStep = requireUniqueStep(
    jobs.verify,
    "Freeze the Release Please run set",
    "Publish Release Please snapshot",
  );
  const uniqueRecoveryStep = requireUniqueStep(
    jobs.verify,
    "Require the only recovery dispatch for this control commit",
    "Publish unique recovery dispatch",
  );
  requireEqual(
    uniqueRecoveryStep?.if,
    "inputs.publish_operation == 'recover-v0.1.1'",
    "Publish unique recovery dispatch gate",
  );
  requireEqual(
    uniqueRecoveryStep?.env?.CONTROL_COMMIT,
    "${{ inputs.control_commit }}",
    "Publish unique recovery control commit",
  );
  requireEqual(
    uniqueRecoveryStep?.env?.CURRENT_RUN_ID,
    "${{ github.run_id }}",
    "Publish unique recovery current run ID",
  );
  for (const fragment of [
    "gh api --paginate --slurp",
    "actions/workflows/publish.yml/runs?branch=main&event=workflow_dispatch&head_sha=${CONTROL_COMMIT}&per_page=100",
    "validateUniquePublishRecoveryRun",
  ]) {
    if (
      typeof uniqueRecoveryStep?.run !== "string" ||
      !uniqueRecoveryStep.run.includes(fragment)
    ) {
      fail(
        `Release workflow Publish unique recovery dispatch must contain ${fragment}.`,
      );
    }
  }
  for (const fragment of [
    "actions/workflows/release-please.yml/runs?per_page=100",
    "snapshotReleasePleaseRuns",
    "createHash",
  ]) {
    if (
      typeof releasePleaseSnapshotStep?.run !== "string" ||
      !releasePleaseSnapshotStep.run.includes(fragment)
    ) {
      fail(`Release workflow Publish run snapshot must contain ${fragment}.`);
    }
  }
  const recoveryArtifactStep = requireUniqueStep(
    jobs.verify,
    "Download the prior live-verified release artifact",
    "Publish recovery artifact download",
  );
  requireEqual(
    recoveryArtifactStep?.if,
    "inputs.publish_operation == 'recover-v0.1.1'",
    "Publish recovery artifact gate",
  );
  for (const [name, expected] of Object.entries({
    "artifact-ids": "${{ steps.recovery-evidence.outputs.artifact-id }}",
    path: "release-artifacts",
    "merge-multiple": true,
    "digest-mismatch": "error",
    "github-token": "${{ github.token }}",
    repository: "${{ github.repository }}",
    "run-id": "${{ inputs.source_publish_run_id }}",
  })) {
    requireEqual(
      recoveryArtifactStep?.with?.[name],
      expected,
      `Publish recovery artifact ${name}`,
    );
  }
  const packArtifactStep = requireUniqueStep(
    jobs.verify,
    "Pack the exact release artifact",
    "Publish normal artifact pack",
  );
  requireEqual(
    packArtifactStep?.if,
    "inputs.publish_operation == 'release'",
    "Publish normal artifact gate",
  );
  if (
    typeof packArtifactStep?.run !== "string" ||
    !packArtifactStep.run.includes(
      "npm pack --pack-destination release-artifacts",
    )
  ) {
    fail(
      "Release workflow Publish normal release must pack one exact artifact.",
    );
  }
  const selectArtifactStep = requireUniqueStep(
    jobs.verify,
    "Select the exact release artifact",
    "Publish exact artifact selection",
  );
  requireEqual(selectArtifactStep?.id, "pack", "Publish artifact selector ID");
  if (
    typeof selectArtifactStep?.run !== "string" ||
    !selectArtifactStep.run.includes('if [[ "${#tarballs[@]}" -ne 1 ]]')
  ) {
    fail("Release workflow Publish must select exactly one release artifact.");
  }
  const consumerArtifactStep = requireUniqueStep(
    jobs.verify,
    "Test consumers against the exact release artifact",
    "Publish exact artifact consumer tests",
  );
  for (const command of [
    "npm run test:package --",
    "npm run test:examples --",
    "npm run test:fixtures --",
  ]) {
    if (
      typeof consumerArtifactStep?.run !== "string" ||
      !consumerArtifactStep.run.includes(command) ||
      !consumerArtifactStep.run.includes("steps.pack.outputs.tarball")
    ) {
      fail(
        `Release workflow Publish exact artifact consumer tests must contain ${command}.`,
      );
    }
  }
  const uploadArtifactStep = requireUniqueStep(
    jobs.verify,
    "Upload the verified release artifact",
    "Publish exact artifact upload",
  );
  requireEqual(
    uploadArtifactStep?.with?.path,
    "${{ steps.pack.outputs.tarball }}",
    "Publish exact artifact upload path",
  );
  const reuseLiveStep = requireUniqueStep(
    jobs["live-smoke"],
    "Reuse the successful bounded live smoke",
    "Publish recovery live-smoke",
  );
  requireEqual(
    reuseLiveStep?.if,
    "needs.verify.outputs.publish-operation == 'recover-v0.1.1'",
    "Publish recovery live gate",
  );
  if (
    typeof reuseLiveStep?.run !== "string" ||
    !reuseLiveStep.run.includes('if [[ "$REUSE_LIVE_SMOKE" != "true" ]]')
  ) {
    fail("Release workflow Publish recovery must require exact live evidence.");
  }
  const boundedLiveStep = requireUniqueStep(
    jobs["live-smoke"],
    "Run the bounded live smoke",
    "Publish normal live-smoke",
  );
  requireEqual(
    boundedLiveStep?.if,
    "needs.verify.outputs.publish-operation == 'release'",
    "Publish normal live gate",
  );
  requireEqual(
    boundedLiveStep?.run,
    "npm run test:live",
    "Publish normal live command",
  );
  requireEqual(
    JSON.stringify(boundedLiveStep?.env),
    JSON.stringify({
      COMETAPI_KEY: "${{ secrets.COMETAPI_KEY }}",
      COMETAPI_LIVE_SMOKE: "1",
      COMETAPI_SMOKE_MODEL: "${{ vars.COMETAPI_SMOKE_MODEL || 'gpt-5.4' }}",
      COMETAPI_LIVE_REQUEST_LIMIT: "3",
      COMETAPI_LIVE_MAX_OUTPUT_TOKENS: "16",
      COMETAPI_LIVE_REQUEST_TIMEOUT_MS: "60000",
      COMETAPI_LIVE_CONCURRENCY: "1",
    }),
    "Publish normal live environment",
  );
  requireEqual(
    JSON.stringify(jobs.publish?.needs),
    JSON.stringify(["live-smoke", "verify"]),
    "Publish deployment dependencies",
  );
  requireEqual(jobs.publish?.environment?.name, "npm", "Publish environment");
  requireEqual(
    JSON.stringify(jobs.publish?.permissions),
    JSON.stringify({
      actions: "read",
      checks: "read",
      contents: "read",
      deployments: "read",
      "id-token": "write",
    }),
    "Publish deployment permissions",
  );
  const permissionCounts = { actionsWrite: 0, idTokenWrite: 0 };
  for (const job of Object.values(jobs)) {
    if (job?.permissions?.actions === "write")
      permissionCounts.actionsWrite += 1;
    if (job?.permissions?.["id-token"] === "write")
      permissionCounts.idTokenWrite += 1;
  }
  requireEqual(permissionCounts.actionsWrite, 1, "actions-write job count");
  requireEqual(permissionCounts.idTokenWrite, 1, "OIDC job count");
  const reconfirmStep = requireUniqueStep(
    jobs.publish,
    "Reconfirm protected state immediately before publication",
    "Publish protected-state reconfirmation",
  );
  requireEqual(
    reconfirmStep?.env?.RELEASE_PLEASE_SNAPSHOT,
    "${{ needs.verify.outputs.release-please-snapshot }}",
    "Publish Release Please snapshot reconfirmation",
  );
  requireEqual(
    reconfirmStep?.env?.RECOVERY_POLICY_ID,
    "${{ inputs.recovery_policy_id }}",
    "Publish recovery policy ID reconfirmation",
  );
  requireEqual(
    reconfirmStep?.env?.RELEASE_PLEASE_ENABLED,
    "${{ vars.RELEASE_PLEASE_ENABLED }}",
    "Publish Release Please variable context",
  );
  requireEqual(
    reconfirmStep?.env?.CURRENT_RUN_ID,
    "${{ github.run_id }}",
    "Publish recovery current run reconfirmation",
  );
  for (const fragment of [
    "actions/workflows/release-please.yml/runs?per_page=100",
    "actions/workflows/publish.yml/runs?branch=main&event=workflow_dispatch&head_sha=${CONTROL_COMMIT}&per_page=100",
    'gh api --paginate --slurp \\\n  "repos/${GITHUB_REPOSITORY}/environments/npm/deployment-branch-policies?per_page=100"',
    "{branch_policies: [.[].branch_policies[]]}",
    "snapshotReleasePleaseRuns",
    "validateUniquePublishRecoveryRun",
    "expectedPolicyIds",
    "if (digest !== process.env.RELEASE_PLEASE_SNAPSHOT)",
  ]) {
    if (
      typeof reconfirmStep?.run !== "string" ||
      !reconfirmStep.run.includes(fragment)
    ) {
      fail(
        `Release workflow Publish protected-state reconfirmation must contain ${fragment}.`,
      );
    }
  }
  requireEqual(
    reconfirmStep.run.split("validateUniquePublishRecoveryRun").length - 1,
    2,
    "Publish recovery unique-run pre-publication reference count",
  );
  if (
    reconfirmStep.run.indexOf("validateRegistryStateBeforePublish") >=
    reconfirmStep.run.lastIndexOf("validateUniquePublishRecoveryRun")
  ) {
    fail(
      "Release workflow Publish must revalidate the unique recovery run after registry state and before publication.",
    );
  }
  const publishStep = requireUniqueStep(
    jobs.publish,
    "Publish the exact artifact with provenance",
    "Publish npm publication",
  );
  const registryStep = requireUniqueStep(
    jobs.publish,
    "Verify the public registry artifact",
    "Publish public-registry verification",
  );
  requireEqual(
    registryStep?.env?.GH_TOKEN,
    "${{ github.token }}",
    "Publish registry verification token",
  );
  const publishSteps = jobs.publish?.steps ?? [];
  if (
    publishSteps.indexOf(reconfirmStep) >= publishSteps.indexOf(publishStep) ||
    publishSteps.indexOf(publishStep) >= publishSteps.indexOf(registryStep)
  ) {
    fail(
      "Release workflow Publish must reconfirm protected state, publish, and then verify the registry in order.",
    );
  }
  requireEqual(
    publishStep?.run,
    "bash scripts/publish-artifact.sh",
    "npm publication command",
  );
  return { supportsTagDispatch: true };
}

export function snapshotReleasePleaseRuns(runs) {
  if (!Array.isArray(runs)) {
    fail("Release workflow Release Please run snapshot must be an array.");
  }
  const seen = new Set();
  const snapshot = runs.map((run) => {
    requirePositiveInteger(run?.id, "Release Please snapshot run ID");
    if (seen.has(run.id)) {
      fail(
        "Release workflow Release Please run snapshot contains a duplicate run ID.",
      );
    }
    seen.add(run.id);
    requirePositiveInteger(
      run?.run_attempt,
      "Release Please snapshot run attempt",
    );
    requireEqual(run?.name, "Release Please", "snapshot workflow name");
    requireEqual(
      run?.path,
      ".github/workflows/release-please.yml",
      "snapshot workflow path",
    );
    requireEqual(
      run?.repository?.full_name,
      "cometapi-dev/cometapi-node",
      "snapshot repository",
    );
    requireCommit(run?.head_sha, "Release Please snapshot head SHA");
    if (run?.event !== "push" && run?.event !== "workflow_dispatch") {
      fail("Release workflow Release Please snapshot event is unsupported.");
    }
    requireEqual(run?.status, "completed", "snapshot run status");
    if (typeof run?.conclusion !== "string" || run.conclusion === "") {
      fail(
        "Release workflow Release Please snapshot conclusion must be final.",
      );
    }
    return {
      conclusion: run.conclusion,
      event: run.event,
      headSha: run.head_sha,
      id: run.id,
      runAttempt: run.run_attempt,
      status: run.status,
    };
  });
  snapshot.sort((left, right) => left.id - right.id);
  return JSON.stringify(snapshot);
}

export function classifyReleasePleaseHandoff({
  artifacts,
  jobs,
  runAttempt,
  runId,
}) {
  requirePositiveInteger(runId, "handoff source run ID");
  requirePositiveInteger(runAttempt, "handoff source run attempt");
  if (!Array.isArray(jobs)) {
    fail("Release workflow handoff source jobs must be an array.");
  }
  const matchingJobs = jobs.filter((job) => job?.name === RELEASE_WORKFLOW_JOB);
  requireEqual(matchingJobs.length, 1, "handoff source job count");
  const sourceJob = matchingJobs[0];
  requireEqual(sourceJob?.run_id, runId, "handoff source job run ID");
  requireEqual(
    sourceJob?.run_attempt,
    runAttempt,
    "handoff source job run attempt",
  );
  requireEqual(sourceJob?.status, "completed", "handoff source job status");
  requireEqual(
    sourceJob?.conclusion,
    "success",
    "handoff source job conclusion",
  );
  const uploadSteps = Array.isArray(sourceJob?.steps)
    ? sourceJob.steps.filter(
        (step) => step?.name === "Upload the exact Release Please result",
      )
    : [];
  requireEqual(uploadSteps.length, 1, "handoff result upload-step count");
  requireEqual(
    uploadSteps[0]?.status,
    "completed",
    "handoff result upload-step status",
  );
  if (!Array.isArray(artifacts)) {
    fail("Release workflow handoff source artifacts must be an array.");
  }
  const artifactName = `release-please-result-${runId}-${runAttempt}`;
  const matchingArtifacts = artifacts.filter(
    (artifact) => artifact?.name === artifactName,
  );
  if (uploadSteps[0]?.conclusion === "skipped") {
    requireEqual(
      matchingArtifacts.length,
      0,
      "preparation handoff result-artifact count",
    );
    return { artifactName, hasResult: false };
  }
  requireEqual(
    uploadSteps[0]?.conclusion,
    "success",
    "handoff result upload-step conclusion",
  );
  requireEqual(
    matchingArtifacts.length,
    1,
    "release handoff result-artifact count",
  );
  requireEqual(
    matchingArtifacts[0]?.expired,
    false,
    "release handoff result-artifact expiration",
  );
  requireEqual(
    matchingArtifacts[0]?.workflow_run?.id,
    runId,
    "release handoff result-artifact run ID",
  );
  return { artifactName, hasResult: true };
}

export function validatePublishWorkflowDispatchTrigger({
  actor,
  controlCommit,
  eventName,
  eventRef,
  eventSha,
  operation,
  releaseCommit,
  releaseTag,
  sourceReleaseCommit,
  sourceRunAttempt,
  sourceRunId,
  triggeringActor,
  workflowRunAttempt,
  workflowSha,
}) {
  requireEqual(actor, "github-actions[bot]", "tag dispatch actor");
  requireEqual(
    triggeringActor,
    "github-actions[bot]",
    "tag dispatch triggering actor",
  );
  requireEqual(eventName, "workflow_dispatch", "tag dispatch event");
  requireEqual(operation, PUBLISH_OPERATION, "tag dispatch operation");
  requireCommit(controlCommit, "tag dispatch control commit");
  requireCommit(releaseCommit, "tag dispatch release commit");
  requireCommit(sourceReleaseCommit, "tag dispatch source release commit");
  requireCommit(eventSha, "tag dispatch event SHA");
  requireCommit(workflowSha, "tag dispatch workflow SHA");
  requireEqual(controlCommit, releaseCommit, "tag dispatch control commit");
  requireEqual(eventSha, releaseCommit, "tag dispatch event SHA");
  requireEqual(workflowSha, releaseCommit, "tag dispatch workflow SHA");
  requireEqual(
    sourceReleaseCommit,
    releaseCommit,
    "tag dispatch source release commit",
  );
  const patch = stablePatch(releaseTag?.slice(1), "tag dispatch version");
  if (patch < 1) {
    fail("Release workflow tag dispatch requires a post-0.1.0 patch release.");
  }
  requireEqual(eventRef, `refs/tags/${releaseTag}`, "tag dispatch ref");
  requirePositiveInteger(sourceRunId, "tag dispatch source run ID");
  requirePositiveInteger(sourceRunAttempt, "tag dispatch source run attempt");
  requirePositiveInteger(workflowRunAttempt, "tag dispatch run attempt");
  return {
    releaseCommit,
    releaseRunAttempt: sourceRunAttempt,
    releaseRunId: sourceRunId,
    releaseTag,
  };
}

export function validateNpmEnvironmentState({
  environment,
  expectedPolicyIds,
  operation,
  policies,
}) {
  requireEqual(environment?.id, 18800205839, "npm environment ID");
  requireEqual(environment?.name, "npm", "npm environment name");
  requireEqual(environment?.can_admins_bypass, false, "npm admin bypass state");
  requireEqual(
    environment?.deployment_branch_policy?.protected_branches,
    false,
    "npm protected-branch policy state",
  );
  requireEqual(
    environment?.deployment_branch_policy?.custom_branch_policies,
    true,
    "npm custom branch-policy state",
  );
  const rules = Array.isArray(environment?.protection_rules)
    ? environment.protection_rules
    : [];
  requireEqual(rules.length, 2, "npm protection-rule count");
  const reviewerRule = rules.find(
    (rule) => rule?.type === "required_reviewers",
  );
  const branchRule = rules.find((rule) => rule?.type === "branch_policy");
  requireEqual(Boolean(branchRule), true, "npm branch-policy rule presence");
  requireEqual(
    reviewerRule?.prevent_self_review,
    false,
    "npm self-review policy",
  );
  requireEqual(reviewerRule?.reviewers?.length, 1, "npm reviewer count");
  requireEqual(reviewerRule?.reviewers?.[0]?.type, "User", "npm reviewer type");
  requireEqual(
    reviewerRule?.reviewers?.[0]?.reviewer?.login,
    "tensornull",
    "npm reviewer login",
  );
  requireEqual(
    reviewerRule?.reviewers?.[0]?.reviewer?.id,
    129579691,
    "npm reviewer ID",
  );
  if (!Array.isArray(policies)) {
    fail("Release workflow npm deployment policies must be an array.");
  }
  for (const policy of policies) {
    requirePositiveInteger(policy?.id, "npm deployment-policy ID");
  }
  const actual = policies.map(({ name, type }) => `${type}:${name}`).sort();
  const expected =
    operation === PUBLISH_OPERATION
      ? ["tag:v*"]
      : operation === PUBLISH_RECOVERY.dispatchTask
        ? ["branch:main", "tag:v*"]
        : null;
  if (expected === null) {
    fail("Release workflow npm environment operation is unsupported.");
  }
  requireEqual(
    JSON.stringify(actual),
    JSON.stringify(expected),
    "npm deployment policies",
  );
  if (expectedPolicyIds !== undefined) {
    if (
      expectedPolicyIds === null ||
      typeof expectedPolicyIds !== "object" ||
      Array.isArray(expectedPolicyIds)
    ) {
      fail("Release workflow expected npm policy IDs must be an object.");
    }
    requireEqual(
      JSON.stringify(Object.keys(expectedPolicyIds).sort()),
      JSON.stringify([...actual].sort()),
      "expected npm policy ID keys",
    );
    requireEqual(
      expectedPolicyIds["tag:v*"],
      PUBLISH_RECOVERY.permanentTagPolicyId,
      "permanent npm tag policy ID",
    );
    for (const policy of policies) {
      const key = `${policy.type}:${policy.name}`;
      requirePositiveInteger(
        expectedPolicyIds[key],
        `expected npm policy ID for ${key}`,
      );
      requireEqual(
        policy.id,
        expectedPolicyIds[key],
        `npm policy ID for ${key}`,
      );
    }
  }
  return { policies: actual };
}

export function validateRegistryStateBeforePublish({
  exactVersion,
  latestVersion,
  nextVersion,
  version,
}) {
  const patch = stablePatch(version, "registry candidate version");
  if (patch < 1) {
    fail("Release workflow registry candidate must be newer than 0.1.0.");
  }
  if (exactVersion !== null) {
    requireEqual(exactVersion, version, "registry exact version");
  }
  const previousVersion = `0.1.${patch - 1}`;
  const allowedLatest =
    exactVersion === null ? [previousVersion] : [previousVersion, version];
  if (!allowedLatest.includes(latestVersion)) {
    fail(
      `Release workflow registry latest must equal ${allowedLatest.join(" or ")}; received ${String(latestVersion)}.`,
    );
  }
  requireEqual(nextVersion, "0.1.0-alpha.3", "registry next version");
  return { exactVersion, latestVersion, nextVersion, previousVersion, version };
}

export function validateRegistryProvenance({
  attestations,
  commit,
  sha512,
  version,
  workflowRef,
}) {
  requireCommit(commit, "provenance workflow commit");
  stablePatch(version, "provenance version");
  if (typeof sha512 !== "string" || !/^[0-9a-f]{128}$/.test(sha512)) {
    fail("Release workflow provenance sha512 must be lowercase hexadecimal.");
  }
  if (
    typeof workflowRef !== "string" ||
    !/^refs\/(heads\/main|tags\/v0\.1\.[1-9]\d*)$/.test(workflowRef)
  ) {
    fail("Release workflow provenance ref must be main or a stable 0.1.x tag.");
  }
  const entries = Array.isArray(attestations?.attestations)
    ? attestations.attestations
    : [];
  const matches = entries.filter(
    (entry) => entry?.predicateType === "https://slsa.dev/provenance/v1",
  );
  requireEqual(matches.length, 1, "SLSA provenance attestation count");
  const encoded = matches[0]?.bundle?.dsseEnvelope?.payload;
  if (typeof encoded !== "string" || encoded === "") {
    fail("Release workflow SLSA provenance payload must be base64 encoded.");
  }
  let statement;
  try {
    statement = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    fail("Release workflow SLSA provenance payload must contain JSON.");
  }
  requireEqual(
    statement?._type,
    "https://in-toto.io/Statement/v1",
    "provenance statement type",
  );
  requireEqual(
    statement?.predicateType,
    "https://slsa.dev/provenance/v1",
    "provenance predicate type",
  );
  requireEqual(statement?.subject?.length, 1, "provenance subject count");
  requireEqual(
    statement?.subject?.[0]?.name,
    `pkg:npm/cometapi@${version}`,
    "provenance subject name",
  );
  requireEqual(
    statement?.subject?.[0]?.digest?.sha512,
    sha512,
    "provenance subject digest",
  );
  const predicate = statement?.predicate;
  requireEqual(
    predicate?.buildDefinition?.buildType,
    "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
    "provenance build type",
  );
  const workflow = predicate?.buildDefinition?.externalParameters?.workflow;
  requireEqual(
    workflow?.repository,
    "https://github.com/cometapi-dev/cometapi-node",
    "provenance workflow repository",
  );
  requireEqual(
    workflow?.path,
    ".github/workflows/publish.yml",
    "provenance workflow path",
  );
  requireEqual(workflow?.ref, workflowRef, "provenance workflow ref");
  const github = predicate?.buildDefinition?.internalParameters?.github;
  requireEqual(github?.event_name, "workflow_dispatch", "provenance event");
  requireEqual(github?.repository_id, "1307188651", "provenance repository ID");
  requireEqual(
    github?.repository_owner_id,
    "225111184",
    "provenance repository owner ID",
  );
  requireEqual(
    predicate?.buildDefinition?.resolvedDependencies?.length,
    1,
    "provenance resolved-dependency count",
  );
  const dependency = predicate?.buildDefinition?.resolvedDependencies?.[0];
  requireEqual(
    dependency?.uri,
    `git+https://github.com/cometapi-dev/cometapi-node@${workflowRef}`,
    "provenance source URI",
  );
  requireEqual(
    dependency?.digest?.gitCommit,
    commit,
    "provenance source commit",
  );
  requireEqual(
    predicate?.runDetails?.builder?.id,
    "https://github.com/actions/runner/github-hosted",
    "provenance builder",
  );
  const invocation = predicate?.runDetails?.metadata?.invocationId;
  const invocationMatch =
    typeof invocation === "string" &&
    invocation.match(
      /^https:\/\/github\.com\/cometapi-dev\/cometapi-node\/actions\/runs\/([1-9]\d*)\/attempts\/([1-9]\d*)$/,
    );
  if (!invocationMatch) {
    fail(
      "Release workflow provenance invocation must identify an exact run attempt.",
    );
  }
  const provenanceRunId = Number(invocationMatch[1]);
  const provenanceRunAttempt = Number(invocationMatch[2]);
  requirePositiveInteger(provenanceRunId, "provenance run ID");
  requirePositiveInteger(provenanceRunAttempt, "provenance run attempt");
  return {
    commit,
    provenanceRunAttempt,
    provenanceRunId,
    version,
    workflowRef,
  };
}

export function validateRegistryProvenanceInvocation({
  commit,
  jobs,
  run,
  runAttempt,
  runId,
  workflowRef,
}) {
  requireCommit(commit, "provenance invocation commit");
  requirePositiveInteger(runId, "provenance invocation run ID");
  requirePositiveInteger(runAttempt, "provenance invocation run attempt");
  requireEqual(run?.id, runId, "provenance invocation run ID");
  requireEqual(
    run?.run_attempt,
    runAttempt,
    "provenance invocation run attempt",
  );
  requireEqual(run?.name, "Publish", "provenance invocation workflow name");
  requireEqual(
    run?.path,
    ".github/workflows/publish.yml",
    "provenance invocation workflow path",
  );
  requireEqual(run?.event, "workflow_dispatch", "provenance invocation event");
  requireEqual(
    run?.head_branch,
    workflowRef.replace(/^refs\/(?:heads|tags)\//, ""),
    "provenance invocation ref",
  );
  requireEqual(run?.head_sha, commit, "provenance invocation commit");
  requireEqual(
    run?.repository?.full_name,
    "cometapi-dev/cometapi-node",
    "provenance invocation repository",
  );
  if (run?.status !== "in_progress" && run?.status !== "completed") {
    fail("Release workflow provenance invocation must be active or completed.");
  }
  if (
    run.status === "completed" &&
    run.conclusion !== "success" &&
    run.conclusion !== "failure"
  ) {
    fail(
      "Release workflow completed provenance invocation must succeed or fail after publication.",
    );
  }
  if (!Array.isArray(jobs)) {
    fail("Release workflow provenance invocation jobs must be an array.");
  }
  const publishJobs = jobs.filter(
    (job) => job?.name === "Publish with npm Trusted Publishing",
  );
  requireEqual(publishJobs.length, 1, "provenance publish-job count");
  const publishJob = publishJobs[0];
  requireEqual(publishJob?.run_id, runId, "provenance publish-job run ID");
  requireEqual(
    publishJob?.run_attempt,
    runAttempt,
    "provenance publish-job run attempt",
  );
  requireEqual(publishJob?.head_sha, commit, "provenance publish-job commit");
  if (!Number.isInteger(publishJob?.runner_id) || publishJob.runner_id < 1) {
    fail("Release workflow provenance publish job must have a runner.");
  }
  const publishSteps = Array.isArray(publishJob?.steps)
    ? publishJob.steps.filter(
        (step) => step?.name === "Publish the exact artifact with provenance",
      )
    : [];
  requireEqual(publishSteps.length, 1, "provenance publish-step count");
  requireEqual(
    publishSteps[0]?.status,
    "completed",
    "provenance publish-step status",
  );
  requireEqual(
    publishSteps[0]?.conclusion,
    "success",
    "provenance publish-step conclusion",
  );
  return { commit, runAttempt, runId, workflowRef };
}

export function validatePublishWorkflowDispatchRecoveryTrigger({
  actor,
  changedFiles,
  controlCommit,
  controlCommitInput,
  controlFirstParent,
  eventName,
  eventRef,
  eventSha,
  mainCommit,
  operation,
  releaseCommit,
  releaseTag,
  recoveryPolicyId,
  sourcePublishRunAttempt,
  sourcePublishRunId,
  sourceReleaseCommit,
  sourceRunAttempt,
  sourceRunId,
  triggeringActor,
  workflowRunAttempt,
  workflowSha,
}) {
  requireEqual(actor, PUBLISH_RECOVERY.actor, "publish recovery actor");
  requireEqual(
    triggeringActor,
    PUBLISH_RECOVERY.actor,
    "publish recovery triggering actor",
  );
  requireEqual(eventName, "workflow_dispatch", "publish recovery event");
  requireEqual(eventRef, "refs/heads/main", "publish recovery ref");
  requireCommit(eventSha, "publish recovery event SHA");
  requireCommit(workflowSha, "publish recovery workflow SHA");
  requireCommit(controlCommit, "publish recovery control commit");
  requireCommit(controlCommitInput, "publish recovery input control commit");
  requireCommit(controlFirstParent, "publish recovery control first parent");
  requireCommit(mainCommit, "publish recovery main commit");
  requireCommit(sourceReleaseCommit, "publish recovery source release commit");
  requireEqual(
    controlCommit,
    mainCommit,
    "publish recovery control and main commit agreement",
  );
  requireEqual(eventSha, controlCommit, "publish recovery event SHA");
  requireEqual(workflowSha, controlCommit, "publish recovery workflow SHA");
  requireEqual(
    controlCommitInput,
    controlCommit,
    "publish recovery input control commit",
  );
  requireEqual(
    controlFirstParent,
    PUBLISH_RECOVERY.dispatchControlParent,
    "publish recovery control first parent",
  );
  requireEqual(
    releaseCommit,
    PUBLISH_RECOVERY.releaseCommit,
    "publish recovery input release commit",
  );
  requireEqual(
    releaseTag,
    PUBLISH_RECOVERY.releaseTag,
    "publish recovery input release tag",
  );
  requireEqual(
    sourceReleaseCommit,
    PUBLISH_RECOVERY.releaseCommit,
    "publish recovery source release commit",
  );
  requirePositiveInteger(sourceRunId, "publish recovery source run ID");
  requireEqual(
    sourceRunId,
    PUBLISH_RECOVERY.releaseRunId,
    "publish recovery source run ID",
  );
  requirePositiveInteger(
    sourceRunAttempt,
    "publish recovery source run attempt",
  );
  requireEqual(
    sourceRunAttempt,
    PUBLISH_RECOVERY.releaseRunAttempt,
    "publish recovery source run attempt",
  );
  requirePositiveInteger(
    sourcePublishRunId,
    "publish recovery source Publish run ID",
  );
  requireEqual(
    sourcePublishRunId,
    PUBLISH_RECOVERY.sourcePublishRunId,
    "publish recovery source Publish run ID",
  );
  requirePositiveInteger(
    sourcePublishRunAttempt,
    "publish recovery source Publish run attempt",
  );
  requireEqual(
    sourcePublishRunAttempt,
    PUBLISH_RECOVERY.sourcePublishRunAttempt,
    "publish recovery source Publish run attempt",
  );
  requireEqual(
    operation,
    PUBLISH_RECOVERY.dispatchTask,
    "publish recovery operation",
  );
  requireEqual(workflowRunAttempt, 1, "publish recovery run attempt");
  requirePositiveInteger(recoveryPolicyId, "publish recovery policy ID");
  if (!Array.isArray(changedFiles)) {
    fail("Release workflow publish recovery changed files must be an array.");
  }
  requireEqual(
    JSON.stringify([...changedFiles].sort()),
    JSON.stringify([...PUBLISH_RECOVERY.changedFiles].sort()),
    "publish recovery changed files",
  );
  return {
    releaseCommit: PUBLISH_RECOVERY.releaseCommit,
    releaseRunAttempt: PUBLISH_RECOVERY.releaseRunAttempt,
    releaseRunId: PUBLISH_RECOVERY.releaseRunId,
    sourcePublishRunAttempt: PUBLISH_RECOVERY.sourcePublishRunAttempt,
    sourcePublishRunId: PUBLISH_RECOVERY.sourcePublishRunId,
  };
}

export function validateUniquePublishRecoveryRun({
  controlCommit,
  currentRunId,
  responses,
}) {
  requireCommit(controlCommit, "publish recovery unique-run control commit");
  requirePositiveInteger(
    currentRunId,
    "publish recovery unique-run current run ID",
  );
  if (!Array.isArray(responses) || responses.length === 0) {
    fail(
      "Release workflow publish recovery run responses must be a non-empty array.",
    );
  }

  const runs = [];
  let totalCount;
  for (const response of responses) {
    if (
      response === null ||
      typeof response !== "object" ||
      Array.isArray(response)
    ) {
      fail("Release workflow publish recovery run response must be an object.");
    }
    if (!Number.isInteger(response.total_count) || response.total_count < 0) {
      fail(
        "Release workflow publish recovery response total count must be a non-negative integer.",
      );
    }
    totalCount ??= response.total_count;
    requireEqual(
      response.total_count,
      totalCount,
      "publish recovery response total-count agreement",
    );
    if (!Array.isArray(response.workflow_runs)) {
      fail(
        "Release workflow publish recovery response workflow runs must be an array.",
      );
    }
    runs.push(...response.workflow_runs);
  }
  requireEqual(
    runs.length,
    totalCount,
    "publish recovery complete paginated run count",
  );

  const seen = new Set();
  for (const run of runs) {
    requirePositiveInteger(run?.id, "publish recovery candidate run ID");
    if (seen.has(run.id)) {
      fail(
        "Release workflow publish recovery run set contains a duplicate run ID.",
      );
    }
    seen.add(run.id);
  }
  requireEqual(totalCount, 1, "publish recovery exact control-run count");

  const candidates = runs.filter(
    (run) => run?.head_branch === "main" && run?.head_sha === controlCommit,
  );
  requireEqual(candidates.length, 1, "publish recovery matching run count");
  const run = candidates[0];
  requireEqual(run.id, currentRunId, "publish recovery current run ID");
  requireEqual(run.event, "workflow_dispatch", "publish recovery run event");
  requireEqual(run.name, "Publish", "publish recovery workflow name");
  requireEqual(
    run.path,
    ".github/workflows/publish.yml",
    "publish recovery workflow path",
  );
  requireEqual(
    run.repository?.full_name,
    "cometapi-dev/cometapi-node",
    "publish recovery repository",
  );
  requireEqual(
    run.head_repository?.full_name,
    "cometapi-dev/cometapi-node",
    "publish recovery head repository",
  );
  requireEqual(
    run.actor?.login,
    PUBLISH_RECOVERY.actor,
    "publish recovery actor",
  );
  requireEqual(
    run.triggering_actor?.login,
    PUBLISH_RECOVERY.actor,
    "publish recovery triggering actor",
  );
  requireEqual(run.run_attempt, 1, "publish recovery run attempt");
  return { runAttempt: 1, runId: currentRunId };
}

function requireJob(job, { conclusion, id, name }) {
  requireEqual(job?.id, id, `${name} job ID`);
  requireEqual(
    job?.run_id,
    PUBLISH_RECOVERY.sourcePublishRunId,
    `${name} run ID`,
  );
  requireEqual(
    job?.run_attempt,
    PUBLISH_RECOVERY.sourcePublishRunAttempt,
    `${name} run attempt`,
  );
  requireEqual(job?.name, name, `${name} job name`);
  requireEqual(job?.status, "completed", `${name} job status`);
  requireEqual(job?.conclusion, conclusion, `${name} job conclusion`);
  requireEqual(
    job?.head_sha,
    PUBLISH_RECOVERY.sourcePublishCommit,
    `${name} job head SHA`,
  );
}

function requireSuccessfulStep(job, stepName) {
  const steps = Array.isArray(job?.steps) ? job.steps : [];
  const matching = steps.filter((step) => step?.name === stepName);
  requireEqual(matching.length, 1, `${stepName} step count`);
  requireEqual(matching[0].status, "completed", `${stepName} step status`);
  requireEqual(
    matching[0].conclusion,
    "success",
    `${stepName} step conclusion`,
  );
}

export function validatePublishRecoveryEvidence({
  annotations,
  artifacts,
  jobs,
  run,
}) {
  requireEqual(
    run?.id,
    PUBLISH_RECOVERY.sourcePublishRunId,
    "recovery source run ID",
  );
  requireEqual(
    run?.run_attempt,
    PUBLISH_RECOVERY.sourcePublishRunAttempt,
    "recovery source run attempt",
  );
  requireEqual(run?.name, "Publish", "recovery source workflow name");
  requireEqual(
    run?.path,
    ".github/workflows/publish.yml",
    "recovery source workflow path",
  );
  requireEqual(run?.event, "push", "recovery source event");
  requireEqual(run?.head_branch, "main", "recovery source head branch");
  requireEqual(
    run?.head_sha,
    PUBLISH_RECOVERY.sourcePublishCommit,
    "recovery source head SHA",
  );
  requireEqual(
    run?.repository?.full_name,
    "cometapi-dev/cometapi-node",
    "recovery source repository",
  );
  requireEqual(
    run?.actor?.login,
    PUBLISH_RECOVERY.actor,
    "recovery source actor",
  );
  requireEqual(
    run?.triggering_actor?.login,
    PUBLISH_RECOVERY.actor,
    "recovery source triggering actor",
  );
  requireEqual(run?.status, "completed", "recovery source status");
  requireEqual(run?.conclusion, "failure", "recovery source conclusion");

  if (!Array.isArray(jobs)) {
    fail("Release workflow recovery source jobs must be an array.");
  }
  requireEqual(jobs.length, 3, "recovery source job count");
  const verify = jobs.find((job) => job?.id === PUBLISH_RECOVERY.verifyJobId);
  const live = jobs.find((job) => job?.id === PUBLISH_RECOVERY.liveJobId);
  const publish = jobs.find(
    (job) => job?.id === PUBLISH_RECOVERY.failedPublishJobId,
  );
  requireJob(verify, {
    conclusion: "success",
    id: PUBLISH_RECOVERY.verifyJobId,
    name: "Verify the immutable release artifact",
  });
  requireSuccessfulStep(verify, "Run release checks");
  requireSuccessfulStep(verify, "Pack the exact release artifact");
  requireSuccessfulStep(
    verify,
    "Test consumers against the exact release artifact",
  );
  requireSuccessfulStep(verify, "Upload the verified release artifact");
  requireJob(live, {
    conclusion: "success",
    id: PUBLISH_RECOVERY.liveJobId,
    name: "Verify the release tag against CometAPI",
  });
  requireSuccessfulStep(live, "Run the bounded live smoke");
  requireJob(publish, {
    conclusion: "failure",
    id: PUBLISH_RECOVERY.failedPublishJobId,
    name: "Publish with npm Trusted Publishing",
  });
  requireEqual(publish?.runner_id, 0, "failed publish runner ID");
  requireEqual(publish?.steps?.length, 0, "failed publish step count");

  if (!Array.isArray(annotations)) {
    fail("Release workflow failed publish annotations must be an array.");
  }
  const branchRejections = annotations.filter(
    (annotation) =>
      annotation?.annotation_level === "failure" &&
      annotation?.message ===
        'Branch "main" is not allowed to deploy to npm due to environment protection rules.',
  );
  requireEqual(
    branchRejections.length,
    1,
    "failed publish branch-policy annotation count",
  );

  if (!Array.isArray(artifacts)) {
    fail("Release workflow recovery source artifacts must be an array.");
  }
  requireEqual(artifacts.length, 1, "recovery source artifact count");
  const artifact = artifacts[0];
  requireEqual(
    artifact?.id,
    PUBLISH_RECOVERY.artifactId,
    "recovery artifact ID",
  );
  requireEqual(
    artifact?.name,
    PUBLISH_RECOVERY.artifactName,
    "recovery artifact name",
  );
  requireEqual(
    artifact?.digest,
    PUBLISH_RECOVERY.artifactDigest,
    "recovery artifact digest",
  );
  requireEqual(artifact?.expired, false, "recovery artifact expired state");
  requireEqual(
    artifact?.workflow_run?.id,
    PUBLISH_RECOVERY.sourcePublishRunId,
    "recovery artifact run ID",
  );
  requireEqual(
    artifact?.workflow_run?.head_sha,
    PUBLISH_RECOVERY.sourcePublishCommit,
    "recovery artifact head SHA",
  );

  return {
    artifactId: PUBLISH_RECOVERY.artifactId,
    artifactName: PUBLISH_RECOVERY.artifactName,
    liveJobId: PUBLISH_RECOVERY.liveJobId,
  };
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
    operation = eventName === "workflow_dispatch" ? "prepare" : "release",
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
  if (operation !== "prepare" && operation !== "release") {
    fail("Release workflow release operation must be prepare or release.");
  }
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
    if (operation === "release") {
      requireEqual(eventName, "push", "release operation event");
      requireEqual(
        releaseExists,
        true,
        "release recovery pre-action existence",
      );
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
    if (eventName !== "workflow_dispatch" && eventName !== "push") {
      fail(
        "Release workflow preparation event must be push or workflow_dispatch.",
      );
    }
    requireEqual(operation, "prepare", "release preparation operation");
    requireEqual(
      releaseExists,
      false,
      "release preparation candidate existence",
    );
    requireEqual(runAttempt, 1, "release preparation run attempt");
    return null;
  }

  requireEqual(operation, "release", "pending release operation");
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
    return { mode: "prepare", version };
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
