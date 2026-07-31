import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

import { getFileInfo } from "prettier";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  classifyReleasePleaseHandoff,
  classifyPushReleasePresence,
  extractReleaseNotesFromChangelog,
  snapshotReleasePleaseRuns,
  validatePreparedReleasePullRequest,
  validateGitHubRelease,
  validateMergedReleasePullRequest,
  validateOpenReleasePullRequestCollisions,
  validatePostActionPullRequestSnapshot,
  validateNpmEnvironmentState,
  validatePublishWorkflowContract,
  validatePublishWorkflowDispatchTrigger,
  validatePublishedRegistryState,
  validateRegistryProvenance,
  validateRegistryProvenanceInvocation,
  validateRegistryStateBeforePublish,
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
const PUBLISH_WORKFLOW = parse(
  readFileSync(
    new URL("../.github/workflows/publish.yml", import.meta.url),
    "utf8",
  ),
);

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

describe("Release Please publication handoff", () => {
  function handoffFixture({ uploadConclusion = "success" } = {}) {
    const artifactName = `release-please-result-${RUN_ID}-1`;
    return {
      artifacts:
        uploadConclusion === "success"
          ? [
              {
                expired: false,
                name: artifactName,
                workflow_run: { id: RUN_ID },
              },
            ]
          : [],
      jobs: [
        {
          conclusion: "success",
          name: "Prepare a reviewed release pull request or GitHub release",
          run_attempt: 1,
          run_id: RUN_ID,
          status: "completed",
          steps: [
            {
              conclusion: uploadConclusion,
              name: "Upload the exact Release Please result",
              status: "completed",
            },
          ],
        },
      ],
      runAttempt: 1,
      runId: RUN_ID,
    };
  }

  it("dispatches only a release run with its exact result artifact", () => {
    expect(classifyReleasePleaseHandoff(handoffFixture())).toEqual({
      artifactName: `release-please-result-${RUN_ID}-1`,
      hasResult: true,
    });
  });

  it("treats a successful preparation run as a release-inert handoff", () => {
    expect(
      classifyReleasePleaseHandoff(
        handoffFixture({ uploadConclusion: "skipped" }),
      ),
    ).toEqual({
      artifactName: `release-please-result-${RUN_ID}-1`,
      hasResult: false,
    });
  });

  it.each([
    ["missing release artifact", (value) => value.artifacts.splice(0)],
    [
      "duplicate release artifact",
      (value) => value.artifacts.push(value.artifacts[0]),
    ],
    [
      "expired release artifact",
      (value) => (value.artifacts[0].expired = true),
    ],
    [
      "preparation artifact",
      (value) => {
        value.jobs[0].steps[0].conclusion = "skipped";
      },
    ],
    [
      "failed upload step",
      (value) => (value.jobs[0].steps[0].conclusion = "failure"),
    ],
  ])("rejects %s", (_name, mutate) => {
    const fixture = handoffFixture();
    mutate(fixture);
    expect(() => classifyReleasePleaseHandoff(fixture)).toThrow(
      /release workflow/i,
    );
  });
});

describe("Release Please run-set freeze", () => {
  function runFixture({
    id = RUN_ID,
    runAttempt = 1,
    status = "completed",
  } = {}) {
    return {
      conclusion: status === "completed" ? "success" : null,
      event: "push",
      head_sha: RELEASE_SHA,
      id,
      name: "Release Please",
      path: ".github/workflows/release-please.yml",
      repository: { full_name: REPOSITORY },
      run_attempt: runAttempt,
      status,
    };
  }

  it("creates one deterministic snapshot only from completed runs", () => {
    const older = runFixture({ id: RUN_ID - 1 });
    const current = runFixture();
    expect(snapshotReleasePleaseRuns([current, older])).toBe(
      snapshotReleasePleaseRuns([older, current]),
    );
  });

  it("changes the snapshot when an old run is rerun", () => {
    expect(snapshotReleasePleaseRuns([runFixture()])).not.toBe(
      snapshotReleasePleaseRuns([runFixture({ runAttempt: 2 })]),
    );
  });

  it.each([
    ["active run", [runFixture({ status: "in_progress" })]],
    ["duplicate run", [runFixture(), runFixture()]],
  ])("rejects an %s", (_name, runs) => {
    expect(() => snapshotReleasePleaseRuns(runs)).toThrow(/release workflow/i);
  });
});

describe("Publish tag dispatch trigger", () => {
  function tagTrigger(overrides = {}) {
    return {
      actor: "github-actions[bot]",
      controlCommit: RELEASE_SHA,
      eventName: "workflow_dispatch",
      eventRef: "refs/tags/v0.1.1",
      eventSha: RELEASE_SHA,
      operation: "release",
      releaseCommit: RELEASE_SHA,
      releaseTag: "v0.1.1",
      sourceReleaseCommit: RELEASE_SHA,
      sourceRunAttempt: 1,
      sourceRunId: RUN_ID,
      triggeringActor: "github-actions[bot]",
      workflowRunAttempt: 1,
      workflowSha: RELEASE_SHA,
      ...overrides,
    };
  }

  it("accepts a bot handoff bound to the exact stable tag", () => {
    expect(validatePublishWorkflowDispatchTrigger(tagTrigger())).toEqual({
      releaseCommit: RELEASE_SHA,
      releaseRunAttempt: 1,
      releaseRunId: RUN_ID,
      releaseTag: "v0.1.1",
    });
  });

  it.each([
    ["actor", { actor: "tensornull" }],
    ["triggering actor", { triggeringActor: "tensornull" }],
    ["event", { eventName: "push" }],
    ["operation", { operation: "unexpected" }],
    ["ref", { eventRef: "refs/heads/main" }],
    ["event SHA", { eventSha: BRANCH_SHA }],
    ["workflow SHA", { workflowSha: BRANCH_SHA }],
    ["control commit", { controlCommit: BRANCH_SHA }],
    ["source commit", { sourceReleaseCommit: BRANCH_SHA }],
    ["tag", { releaseTag: "v0.2.0", eventRef: "refs/tags/v0.2.0" }],
    ["stable boundary", { releaseTag: "v0.1.0", eventRef: "refs/tags/v0.1.0" }],
    ["source run", { sourceRunId: 0 }],
    ["source attempt", { sourceRunAttempt: 0 }],
    ["run attempt", { workflowRunAttempt: 0 }],
  ])("rejects tag handoff drift in %s", (_name, overrides) => {
    expect(() =>
      validatePublishWorkflowDispatchTrigger(tagTrigger(overrides)),
    ).toThrow(/release workflow/i);
  });

  it("allows an idempotent rerun of the same tag handoff", () => {
    expect(
      validatePublishWorkflowDispatchTrigger(
        tagTrigger({ workflowRunAttempt: 2 }),
      ),
    ).toMatchObject({ releaseRunId: RUN_ID });
  });
});

describe("Publish workflow dispatch contract", () => {
  function workflowContract(mutate) {
    const workflow = JSON.parse(JSON.stringify(PUBLISH_WORKFLOW));
    mutate?.(workflow);
    return workflow;
  }

  it("requires the permanent tag-handoff inputs", () => {
    expect(validatePublishWorkflowContract(workflowContract())).toEqual({
      supportsTagDispatch: true,
    });
  });

  it.each([
    [
      "optional control input",
      (workflow) => {
        workflow.on.workflow_dispatch.inputs.control_commit.required = false;
      },
    ],
    [
      "workflow_run trigger",
      (workflow) => {
        workflow.on.workflow_run.workflows = ["CI"];
      },
    ],
    [
      "cancellable publish concurrency",
      (workflow) => {
        workflow.concurrency["cancel-in-progress"] = true;
      },
    ],
    [
      "extra workflow dispatch input",
      (workflow) => {
        workflow.on.workflow_dispatch.inputs.untrusted = {
          required: false,
          type: "string",
        };
      },
    ],
    [
      "handoff environment",
      (workflow) => {
        workflow.jobs.handoff.environment = "npm";
      },
    ],
    [
      "extra actions writer",
      (workflow) => {
        workflow.jobs.verify.permissions = { actions: "write" };
      },
    ],
    [
      "explicit verify permissions",
      (workflow) => {
        workflow.jobs.verify.permissions = { contents: "read" };
      },
    ],
    [
      "explicit live-smoke permissions",
      (workflow) => {
        workflow.jobs["live-smoke"].permissions = { contents: "write" };
      },
    ],
    [
      "extra default permission",
      (workflow) => {
        workflow.permissions.checks = "read";
      },
    ],
    [
      "extra publish permission",
      (workflow) => {
        workflow.jobs.publish.permissions.checks = "read";
      },
    ],
    [
      "missing Release Please run snapshot",
      (workflow) => {
        delete workflow.jobs.verify.outputs["release-please-snapshot"];
      },
    ],
    [
      "unfrozen Release Please run snapshot",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) =>
            name === "Reconfirm protected state immediately before publication",
        );
        step.env.RELEASE_PLEASE_SNAPSHOT = "untrusted";
      },
    ],
    [
      "late protected-state reconfirmation",
      (workflow) => {
        const steps = workflow.jobs.publish.steps;
        const reconfirmIndex = steps.findIndex(
          ({ name }) =>
            name === "Reconfirm protected state immediately before publication",
        );
        const [reconfirm] = steps.splice(reconfirmIndex, 1);
        const publishIndex = steps.findIndex(
          ({ name }) => name === "Publish the exact artifact with provenance",
        );
        steps.splice(publishIndex + 1, 0, reconfirm);
      },
    ],
    [
      "skipped protected-state reconfirmation",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) =>
            name === "Reconfirm protected state immediately before publication",
        );
        step.if = "${{ false }}";
      },
    ],
    [
      "ignored protected-state reconfirmation failure",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) =>
            name === "Reconfirm protected state immediately before publication",
        );
        step["continue-on-error"] = true;
      },
    ],
    [
      "neutralized protected-state reconfirmation failures",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) =>
            name === "Reconfirm protected state immediately before publication",
        );
        step.run = step.run
          .replace("set -euo pipefail", "set +e")
          .replaceAll("exit 1", "true");
      },
    ],
    [
      "different uploaded artifact",
      (workflow) => {
        const step = workflow.jobs.verify.steps.find(
          ({ name }) => name === "Upload the verified release artifact",
        );
        step.with.path = "release-artifacts/*.tgz";
      },
    ],
    [
      "live-smoke dependency",
      (workflow) => {
        workflow.jobs["live-smoke"].needs = ["handoff", "verify"];
      },
    ],
    [
      "elevated live-smoke permissions",
      (workflow) => {
        workflow.jobs["live-smoke"].permissions = { contents: "write" };
      },
    ],
    [
      "missing bounded live smoke",
      (workflow) => {
        const step = workflow.jobs["live-smoke"].steps.find(
          ({ name }) => name === "Run the bounded live smoke",
        );
        step.run = "true";
      },
    ],
    [
      "tag dispatch gate",
      (workflow) => {
        workflow.jobs.verify.if = workflow.jobs.verify.if.replace(
          "github.sha == inputs.release_commit",
          "true",
        );
      },
    ],
    [
      "unguarded tag dispatch",
      (workflow) => {
        workflow.jobs.verify.if += " || true";
      },
    ],
    [
      "main dispatch alternative",
      (workflow) => {
        workflow.jobs.verify.if += " || github.ref == 'refs/heads/main'";
      },
    ],
    [
      "unguarded handoff",
      (workflow) => {
        workflow.jobs.handoff.if += " || true";
      },
    ],
    [
      "missing runtime dispatch validation",
      (workflow) => {
        workflow.jobs.verify.steps = workflow.jobs.verify.steps.filter(
          ({ name }) => name !== "Validate the exact workflow dispatch",
        );
      },
    ],
    [
      "untrusted runtime dispatch ref",
      (workflow) => {
        const step = workflow.jobs.verify.steps.find(
          ({ name }) => name === "Validate the exact workflow dispatch",
        );
        step.env.EVENT_REF = "refs/heads/main";
      },
    ],
    [
      "bypassed runtime dispatch validation",
      (workflow) => {
        const step = workflow.jobs.verify.steps.find(
          ({ name }) => name === "Validate the exact workflow dispatch",
        );
        step.run = "true";
      },
    ],
    [
      "skipped runtime dispatch validation",
      (workflow) => {
        const step = workflow.jobs.verify.steps.find(
          ({ name }) => name === "Validate the exact workflow dispatch",
        );
        step.if = "${{ false }}";
      },
    ],
    [
      "ignored runtime dispatch validation failure",
      (workflow) => {
        const step = workflow.jobs.verify.steps.find(
          ({ name }) => name === "Validate the exact workflow dispatch",
        );
        step["continue-on-error"] = true;
      },
    ],
    [
      "redirected runtime dispatch validation",
      (workflow) => {
        const step = workflow.jobs.verify.steps.find(
          ({ name }) => name === "Validate the exact workflow dispatch",
        );
        step["working-directory"] = "untrusted";
      },
    ],
    [
      "untrusted source release commit",
      (workflow) => {
        workflow.jobs.verify.env.SOURCE_RELEASE_COMMIT = "untrusted";
      },
    ],
    [
      "handoff dispatch ref",
      (workflow) => {
        const step = workflow.jobs.handoff.steps.find(
          ({ name }) => name === "Dispatch the exact immutable tag",
        );
        step.run = step.run.replace('-f ref="$RELEASE_TAG"', '-f ref="main"');
      },
    ],
    [
      "handoff run discovery",
      (workflow) => {
        const step = workflow.jobs.handoff.steps.find(
          ({ name }) => name === "Dispatch the exact immutable tag",
        );
        step.run = step.run.replace(
          "tag-dispatch-runs-before.json",
          "untrusted-before.json",
        );
      },
    ],
    [
      "handoff waits for the queued tag run",
      (workflow) => {
        const step = workflow.jobs.handoff.steps.find(
          ({ name }) => name === "Dispatch the exact immutable tag",
        );
        step.run +=
          '\ngh api "repos/${GITHUB_REPOSITORY}/actions/runs/${publish_run_id}/jobs"';
      },
    ],
    [
      "ignored handoff contract validation failure",
      (workflow) => {
        const step = workflow.jobs.handoff.steps.find(
          ({ name }) =>
            name === "Validate the exact release and tag dispatch contract",
        );
        step["continue-on-error"] = true;
      },
    ],
    [
      "preparation handoff gate",
      (workflow) => {
        const step = workflow.jobs.handoff.steps.find(
          ({ name }) => name === "Dispatch the exact immutable tag",
        );
        delete step.if;
      },
    ],
    [
      "publication command",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) => name === "Publish the exact artifact with provenance",
        );
        step.run = "npm publish";
      },
    ],
    [
      "unpaginated environment policies",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) =>
            name === "Reconfirm protected state immediately before publication",
        );
        step.run = step.run.replace(
          'gh api --paginate --slurp \\\n  "repos/${GITHUB_REPOSITORY}/environments/npm/deployment-branch-policies?per_page=100"',
          'gh api "repos/${GITHUB_REPOSITORY}/environments/npm/deployment-branch-policies"',
        );
      },
    ],
    [
      "missing registry verification token",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) => name === "Verify the public registry artifact",
        );
        delete step.env.GH_TOKEN;
      },
    ],
    [
      "skipped registry verification",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) => name === "Verify the public registry artifact",
        );
        step.if = "${{ false }}";
      },
    ],
    [
      "ignored registry verification failure",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) => name === "Verify the public registry artifact",
        );
        step["continue-on-error"] = true;
      },
    ],
    [
      "unbounded attestation fetch",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) => name === "Verify the public registry artifact",
        );
        step.run = step.run.replace(
          "bash scripts/fetch-attestations.sh",
          'curl "$attestations_url" > "$attestations_file"',
        );
      },
    ],
    [
      "missing post-attestation registry readback",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) => name === "Verify the public registry artifact",
        );
        step.run = step.run.replace("validatePublishedRegistryState", "");
      },
    ],
    [
      "missing existing-version replay expectation",
      (workflow) => {
        const step = workflow.jobs.publish.steps.find(
          ({ name }) => name === "Publish the exact artifact with provenance",
        );
        delete step.env.EXPECT_EXISTING;
      },
    ],
    [
      "normal live-smoke condition",
      (workflow) => {
        const step = workflow.jobs["live-smoke"].steps.find(
          ({ name }) => name === "Run the bounded live smoke",
        );
        step.if = "always()";
      },
    ],
    [
      "conditional live-smoke setup",
      (workflow) => {
        const step = workflow.jobs["live-smoke"].steps.find(
          ({ name }) => name === "Set up Node.js 24",
        );
        step.if = "always()";
      },
    ],
    [
      "normal live-smoke command",
      (workflow) => {
        const step = workflow.jobs["live-smoke"].steps.find(
          ({ name }) => name === "Run the bounded live smoke",
        );
        step.run = "true";
      },
    ],
    [
      "conditional artifact pack",
      (workflow) => {
        const step = workflow.jobs.verify.steps.find(
          ({ name }) => name === "Pack the exact release artifact",
        );
        step.if = "always()";
      },
    ],
    [
      "publication order",
      (workflow) => {
        const steps = workflow.jobs.publish.steps;
        const publishIndex = steps.findIndex(
          ({ name }) => name === "Publish the exact artifact with provenance",
        );
        const verifyIndex = steps.findIndex(
          ({ name }) => name === "Verify the public registry artifact",
        );
        [steps[publishIndex], steps[verifyIndex]] = [
          steps[verifyIndex],
          steps[publishIndex],
        ];
      },
    ],
  ])("rejects %s", (_name, mutate) => {
    expect(() =>
      validatePublishWorkflowContract(workflowContract(mutate)),
    ).toThrow(/release workflow/i);
  });
});

describe("npm publication state", () => {
  function environmentFixture() {
    return {
      can_admins_bypass: false,
      deployment_branch_policy: {
        custom_branch_policies: true,
        protected_branches: false,
      },
      id: 18800205839,
      name: "npm",
      protection_rules: [
        {
          prevent_self_review: false,
          reviewers: [
            {
              reviewer: { id: 129579691, login: "tensornull" },
              type: "User",
            },
          ],
          type: "required_reviewers",
        },
        { type: "branch_policy" },
      ],
    };
  }
  const tagPolicy = { id: 55718965, name: "v*", type: "tag" };
  const mainPolicy = { id: 60000000, name: "main", type: "branch" };

  it("accepts only tag policy for a normal release", () => {
    expect(
      validateNpmEnvironmentState({
        environment: environmentFixture(),
        expectedPolicyIds: { "tag:v*": 55718965 },
        operation: "release",
        policies: [tagPolicy],
      }),
    ).toEqual({ policies: ["tag:v*"] });
  });

  it("rejects a replacement for the permanent tag policy", () => {
    expect(() =>
      validateNpmEnvironmentState({
        environment: environmentFixture(),
        expectedPolicyIds: { "tag:v*": 55718966 },
        operation: "release",
        policies: [tagPolicy],
      }),
    ).toThrow(/policy ID/i);
  });

  it.each([
    [
      "admin bypass",
      {
        environment: { ...environmentFixture(), can_admins_bypass: true },
        policies: [tagPolicy],
      },
    ],
    [
      "reviewer",
      {
        environment: {
          ...environmentFixture(),
          protection_rules: [{ type: "branch_policy" }],
        },
        policies: [tagPolicy],
      },
    ],
    [
      "extra branch",
      { environment: environmentFixture(), policies: [tagPolicy, mainPolicy] },
    ],
  ])("rejects normal-release environment drift in %s", (_name, fixture) => {
    expect(() =>
      validateNpmEnvironmentState({
        operation: "release",
        ...fixture,
      }),
    ).toThrow(/release workflow/i);
  });

  it("accepts the unpublished candidate and preserves next", () => {
    expect(
      validateRegistryStateBeforePublish({
        exactVersion: null,
        latestVersion: "0.1.0",
        nextVersion: "0.1.0-alpha.3",
        version: "0.1.1",
      }),
    ).toMatchObject({ previousVersion: "0.1.0" });
  });

  it("accepts an idempotent replay only at the same exact version", () => {
    expect(
      validateRegistryStateBeforePublish({
        exactVersion: "0.1.1",
        latestVersion: "0.1.1",
        nextVersion: "0.1.0-alpha.3",
        version: "0.1.1",
      }),
    ).toMatchObject({ exactVersion: "0.1.1" });
  });

  function publishedRegistryFixture() {
    return {
      attestationUrl:
        "https://registry.npmjs.org/-/npm/v1/attestations/cometapi@0.1.2",
      dist: {
        attestations: {
          provenance: { predicateType: "https://slsa.dev/provenance/v1" },
          url: "https://registry.npmjs.org/-/npm/v1/attestations/cometapi@0.1.2",
        },
        integrity: "sha512-exact",
      },
      exactVersion: "0.1.2",
      expectedIntegrity: "sha512-exact",
      nextVersion: "0.1.0-alpha.3",
      taggedVersion: "0.1.2",
      version: "0.1.2",
    };
  }

  it("revalidates immutable and mutable registry state after attestation convergence", () => {
    expect(
      validatePublishedRegistryState(publishedRegistryFixture()),
    ).toMatchObject({
      exactVersion: "0.1.2",
      nextVersion: "0.1.0-alpha.3",
      taggedVersion: "0.1.2",
    });
  });

  it.each([
    ["exact version", (state) => (state.exactVersion = "0.1.1")],
    ["dist-tag", (state) => (state.taggedVersion = "0.1.1")],
    ["next", (state) => (state.nextVersion = "0.1.0-alpha.4")],
    ["integrity", (state) => (state.dist.integrity = "sha512-different")],
    ["attestation URL identity", (state) => (state.attestationUrl += "-other")],
    [
      "attestation URL",
      (state) => (state.dist.attestations.url += "-different"),
    ],
    [
      "provenance predicate",
      (state) =>
        (state.dist.attestations.provenance.predicateType = "unexpected"),
    ],
  ])("rejects post-attestation registry drift in %s", (_name, mutate) => {
    const state = publishedRegistryFixture();
    mutate(state);
    expect(() => validatePublishedRegistryState(state)).toThrow(
      /release workflow/i,
    );
  });

  it.each([
    [
      "wrong latest",
      {
        exactVersion: null,
        latestVersion: "0.1.1",
        nextVersion: "0.1.0-alpha.3",
        version: "0.1.1",
      },
    ],
    [
      "changed next",
      {
        exactVersion: null,
        latestVersion: "0.1.0",
        nextVersion: "0.1.0-alpha.4",
        version: "0.1.1",
      },
    ],
    [
      "wrong exact",
      {
        exactVersion: "0.1.2",
        latestVersion: "0.1.0",
        nextVersion: "0.1.0-alpha.3",
        version: "0.1.1",
      },
    ],
    [
      "0.2 release",
      {
        exactVersion: null,
        latestVersion: "0.1.1",
        nextVersion: "0.1.0-alpha.3",
        version: "0.2.0",
      },
    ],
  ])("rejects registry drift in %s", (_name, fixture) => {
    expect(() => validateRegistryStateBeforePublish(fixture)).toThrow(
      /release workflow/i,
    );
  });

  const provenanceDigest = "c".repeat(128);

  function provenanceFixture({
    commit = RELEASE_SHA,
    mutate,
    runAttempt = 1,
    runId = RUN_ID,
    workflowRef = "refs/tags/v0.1.1",
  } = {}) {
    const statement = {
      _type: "https://in-toto.io/Statement/v1",
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [
        {
          digest: { sha512: provenanceDigest },
          name: "pkg:npm/cometapi@0.1.1",
        },
      ],
      predicate: {
        buildDefinition: {
          buildType:
            "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
          externalParameters: {
            workflow: {
              path: ".github/workflows/publish.yml",
              ref: workflowRef,
              repository: "https://github.com/cometapi-dev/cometapi-node",
            },
          },
          internalParameters: {
            github: {
              event_name: "workflow_dispatch",
              repository_id: "1307188651",
              repository_owner_id: "225111184",
            },
          },
          resolvedDependencies: [
            {
              digest: { gitCommit: commit },
              uri: `git+https://github.com/cometapi-dev/cometapi-node@${workflowRef}`,
            },
          ],
        },
        runDetails: {
          builder: { id: "https://github.com/actions/runner/github-hosted" },
          metadata: {
            invocationId: `https://github.com/cometapi-dev/cometapi-node/actions/runs/${runId}/attempts/${runAttempt}`,
          },
        },
      },
    };
    mutate?.(statement);
    return {
      attestations: {
        attestations: [
          {
            bundle: {
              dsseEnvelope: {
                payload: Buffer.from(JSON.stringify(statement)).toString(
                  "base64",
                ),
              },
            },
            predicateType: "https://slsa.dev/provenance/v1",
          },
        ],
      },
      commit,
      runAttempt,
      runId,
      sha512: provenanceDigest,
      version: "0.1.1",
      workflowRef,
    };
  }

  it("binds normal provenance to the immutable tag and release commit", () => {
    expect(validateRegistryProvenance(provenanceFixture())).toEqual({
      commit: RELEASE_SHA,
      provenanceRunAttempt: 1,
      provenanceRunId: RUN_ID,
      version: "0.1.1",
      workflowRef: "refs/tags/v0.1.1",
    });
  });

  it("rejects provenance from main", () => {
    expect(() =>
      validateRegistryProvenance(
        provenanceFixture({
          commit: BRANCH_SHA,
          workflowRef: "refs/heads/main",
        }),
      ),
    ).toThrow(/stable 0\.1\.x tag/i);
  });

  it.each([
    [
      "workflow path",
      (statement) => {
        statement.predicate.buildDefinition.externalParameters.workflow.path =
          "/.github/workflows/other.yml";
      },
    ],
    [
      "workflow ref",
      (statement) => {
        statement.predicate.buildDefinition.externalParameters.workflow.ref =
          "refs/heads/dev";
      },
    ],
    [
      "source commit",
      (statement) => {
        statement.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit =
          BRANCH_SHA;
      },
    ],
    [
      "event",
      (statement) => {
        statement.predicate.buildDefinition.internalParameters.github.event_name =
          "push";
      },
    ],
    [
      "subject digest",
      (statement) => {
        statement.subject[0].digest.sha512 = "d".repeat(128);
      },
    ],
    [
      "invocation",
      (statement) => {
        statement.predicate.runDetails.metadata.invocationId = `https://github.com/other/repository/actions/runs/${RUN_ID}/attempts/2`;
      },
    ],
  ])("rejects provenance drift in %s", (_name, mutate) => {
    expect(() =>
      validateRegistryProvenance(provenanceFixture({ mutate })),
    ).toThrow(/release workflow/i);
  });

  function provenanceInvocation(overrides = {}) {
    const run = {
      conclusion: "failure",
      event: "workflow_dispatch",
      head_branch: "v0.1.1",
      head_sha: RELEASE_SHA,
      id: RUN_ID,
      name: "Publish",
      path: ".github/workflows/publish.yml",
      repository: { full_name: REPOSITORY },
      run_attempt: 1,
      status: "completed",
    };
    const jobs = [
      {
        head_sha: RELEASE_SHA,
        name: "Publish with npm Trusted Publishing",
        run_attempt: 1,
        run_id: RUN_ID,
        runner_id: 42,
        steps: [
          {
            conclusion: "success",
            name: "Publish the exact artifact with provenance",
            status: "completed",
          },
        ],
      },
    ];
    return {
      commit: RELEASE_SHA,
      jobs,
      run,
      runAttempt: 1,
      runId: RUN_ID,
      workflowRef: "refs/tags/v0.1.1",
      ...overrides,
    };
  }

  it("accepts a prior failed run only when its npm publish step succeeded", () => {
    expect(
      validateRegistryProvenanceInvocation(provenanceInvocation()),
    ).toEqual({
      commit: RELEASE_SHA,
      runAttempt: 1,
      runId: RUN_ID,
      workflowRef: "refs/tags/v0.1.1",
    });
  });

  it("accepts the current in-progress run after its publish step succeeds", () => {
    const fixture = provenanceInvocation();
    fixture.run.status = "in_progress";
    fixture.run.conclusion = null;
    expect(validateRegistryProvenanceInvocation(fixture)).toMatchObject({
      runId: RUN_ID,
    });
  });

  it("rejects a provenance invocation from main", () => {
    const fixture = provenanceInvocation({ workflowRef: "refs/heads/main" });
    fixture.run.head_branch = "main";
    expect(() => validateRegistryProvenanceInvocation(fixture)).toThrow(
      /stable 0\.1\.x tag/i,
    );
  });

  it.each([
    ["run attempt", (fixture) => (fixture.run.run_attempt = 2)],
    ["workflow", (fixture) => (fixture.run.path = ".github/workflows/ci.yml")],
    ["ref", (fixture) => (fixture.run.head_branch = "dev")],
    ["commit", (fixture) => (fixture.run.head_sha = BRANCH_SHA)],
    ["runner", (fixture) => (fixture.jobs[0].runner_id = 0)],
    [
      "publish step",
      (fixture) => (fixture.jobs[0].steps[0].conclusion = "failure"),
    ],
  ])("rejects provenance invocation drift in %s", (_name, mutate) => {
    const fixture = provenanceInvocation();
    mutate(fixture);
    expect(() => validateRegistryProvenanceInvocation(fixture)).toThrow(
      /release workflow/i,
    );
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

  it("prepares a source-only push whose current version remains published", () => {
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
    ).toEqual({ mode: "prepare", version: "0.1.0" });
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

  it("prepares a package metadata change without a premature version bump", () => {
    expect(
      classifyPushReleasePresence({
        currentRelease: publishedCurrentRelease(),
        currentTagCommit: RELEASE_SHA,
        headCommit: BRANCH_SHA,
        manifestVersion: "0.1.0",
        packageChanged: true,
        previousVersion: "0.1.0",
        version: "0.1.0",
      }),
    ).toEqual({ mode: "prepare", version: "0.1.0" });
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

  it("allows an ordinary source fix push to prepare a release PR", () => {
    expect(
      selectPendingReleasePullRequest([], {
        eventName: "push",
        operation: "prepare",
        releaseBranch: RELEASE_BRANCH,
        releaseCommit: RELEASE_SHA,
        releaseExists: false,
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
