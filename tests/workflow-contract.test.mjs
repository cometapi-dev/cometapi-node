import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

const workflowNames = [
  "ci.yml",
  "live-smoke.yml",
  "publish.yml",
  "release-please.yml",
];
const workflows = Object.fromEntries(
  workflowNames.map((name) => [
    name,
    readFileSync(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      "utf8",
    ),
  ]),
);
const releasePleaseConfig = JSON.parse(
  readFileSync(
    new URL("../release-please-config.json", import.meta.url),
    "utf8",
  ),
);
const releaseWorkflowValidation = readFileSync(
  new URL("../scripts/release-workflow-validation.mjs", import.meta.url),
  "utf8",
);

function workflow(name) {
  const contents = workflows[name];
  if (contents === undefined) throw new Error(`Unknown workflow: ${name}`);
  return contents;
}

function job(contents, name) {
  const marker = `  ${name}:\n`;
  const start = contents.indexOf(marker);
  if (start === -1) throw new Error(`Workflow job not found: ${name}`);
  const remainder = contents.slice(start + marker.length);
  const nextJob = remainder.search(/^ {2}[a-z0-9-]+:\n/m);
  return nextJob === -1 ? remainder : remainder.slice(0, nextJob);
}

function matches(contents, pattern) {
  return [...contents.matchAll(pattern)];
}

describe("GitHub Actions workflow contract", () => {
  it("keeps live smoke and Release Please disabled unless explicitly enabled", () => {
    const liveSmoke = job(workflow("live-smoke.yml"), "smoke");
    expect(liveSmoke).toMatch(
      /^ {4}if: >-\n {6}vars\.LIVE_SMOKE_ENABLED == 'true' &&\n {6}github\.ref == 'refs\/heads\/main'$/m,
    );

    const releasePlease = job(workflow("release-please.yml"), "release-please");
    expect(releasePlease).toMatch(
      /^ {4}if: vars\.RELEASE_PLEASE_ENABLED == 'true'$/m,
    );
  });

  it("keeps supported runtimes blocking and Node.js 26 advisory", () => {
    const ci = workflow("ci.yml");
    const locked = job(ci, "locked");
    expect(locked).toMatch(
      /matrix:\n {8}node-version:\n {10}- 22\.x\n {10}- 24\.x/,
    );
    expect(locked).not.toContain("- 26.x");

    const advisory = job(ci, "current-node-advisory");
    expect(advisory).toMatch(/^ {4}continue-on-error: true$/m);
    expect(advisory).toMatch(/^ {10}node-version: 26\.x$/m);
  });

  it("runs the latest OpenAI lane for manually dispatched release-candidate CI", () => {
    const latest = job(workflow("ci.yml"), "latest-openai");
    expect(latest).toContain("github.event_name == 'workflow_dispatch'");
  });

  it("runs the Public Preview gate once in blocking CI", () => {
    expect(
      matches(workflow("ci.yml"), /^\s*run: npm run check:public-preview$/gm),
    ).toHaveLength(1);
  });

  it("restricts publication to the canonical repository and metadata", () => {
    const publish = workflow("publish.yml");
    const verify = job(publish, "verify");
    expect(verify).toContain("EXPECTED_REPOSITORY: cometapi-dev/cometapi-node");
    expect(verify).toContain(
      "EXPECTED_REPOSITORY_URL: git+https://github.com/cometapi-dev/cometapi-node.git",
    );
    expect(verify).toContain(
      "EXPECTED_BUGS_URL: https://github.com/cometapi-dev/cometapi-node/issues",
    );
    expect(verify).toContain("validateReleaseWorkflowRun");
    expect(verify).not.toContain(
      "EXPECTED_REPOSITORY: ${{ github.repository }}",
    );
  });

  it("matches the required environment reviewer configuration", () => {
    const liveSmokeWorkflow = workflow("live-smoke.yml");
    const liveSmoke = job(liveSmokeWorkflow, "smoke").replace(
      /\n\s*#\s*/g,
      " ",
    );
    expect(liveSmoke).toContain("without required reviewers");

    const publishWorkflow = workflow("publish.yml");
    expect(job(publishWorkflow, "live-smoke")).toContain(
      "without required reviewers",
    );
    expect(job(publishWorkflow, "publish")).toContain(
      "approval by the current release approver and self-review allowed",
    );
  });

  it("publishes only through OIDC and has no manual recovery path", () => {
    const publishWorkflow = workflow("publish.yml");
    const publish = job(publishWorkflow, "publish");
    expect(publish).toContain(
      "ref: ${{ needs.verify.outputs.release-commit }}",
    );
    expect(publish).toContain("run: bash scripts/publish-artifact.sh");
    expect(publishWorkflow).not.toContain("workflow_dispatch");
    expect(publishWorkflow).not.toContain("NPM_ALPHA1_BOOTSTRAP");
    expect(publishWorkflow).not.toContain("recover-verify");
    expect(publishWorkflow).not.toContain("recover-publish");
    expect(publish).toMatch(
      /package-manager-cache: false\n {10}registry-url: https:\/\/registry\.npmjs\.org/,
    );
  });

  it("pins third-party actions and disables checkout credential persistence", () => {
    for (const name of workflowNames) {
      const contents = workflow(name);
      const actionReferences = matches(
        contents,
        /^\s*uses: ([^\s#]+)(?:\s+#.*)?$/gm,
      ).map((match) => match[1]);
      expect(actionReferences.length).toBeGreaterThan(0);
      for (const reference of actionReferences) {
        if (reference.startsWith("./")) continue;
        expect(reference).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
      }

      const checkoutCount = matches(
        contents,
        /^\s*uses: actions\/checkout@[0-9a-f]{40}(?:\s+#.*)?$/gm,
      ).length;
      const disabledCredentialCount = matches(
        contents,
        /^\s*persist-credentials: false$/gm,
      ).length;
      expect(disabledCredentialCount).toBe(checkoutCount);
    }
  });

  it("keeps elevated permissions scoped to their required jobs", () => {
    for (const name of workflowNames.filter((name) => name !== "publish.yml")) {
      expect(workflow(name)).toMatch(/^permissions:\n {2}contents: read$/m);
    }
    expect(workflow("publish.yml")).toMatch(
      /^permissions:\n {2}actions: read\n {2}contents: read$/m,
    );

    const ci = workflow("ci.yml");
    const liveSmoke = workflow("live-smoke.yml");
    expect(ci).not.toMatch(/^\s+[^:\n]+: write$/m);
    expect(liveSmoke).not.toMatch(/^\s+[^:\n]+: write$/m);

    const releasePlease = job(workflow("release-please.yml"), "release-please");
    expect(releasePlease).toMatch(/^ {6}actions: read$/m);
    expect(releasePlease).toMatch(/^ {6}contents: write$/m);
    expect(releasePlease).toMatch(/^ {6}issues: write$/m);
    expect(releasePlease).toMatch(/^ {6}pull-requests: write$/m);

    const publishWorkflow = workflow("publish.yml");
    expect(matches(publishWorkflow, /^\s+id-token: write$/gm)).toHaveLength(1);
    expect(job(publishWorkflow, "verify")).not.toContain("id-token: write");
    expect(job(publishWorkflow, "live-smoke")).not.toContain("id-token: write");
    expect(job(publishWorkflow, "publish")).toContain("id-token: write");
  });

  it("uses Release Please for the reviewed patch PR and immutable release", () => {
    const contents = workflow("release-please.yml");
    const releasePlease = job(contents, "release-please");
    expect(releasePlease).toContain(
      "googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7",
    );
    expect(releasePlease).toContain(
      "skip-github-release: ${{ steps.preflight.outputs.mode == 'prepare' }}",
    );
    expect(releasePlease).toContain(
      "skip-github-pull-request: ${{ steps.preflight.outputs.mode == 'release' }}",
    );
    expect(releasePlease).toContain(
      "continue-on-error: ${{ steps.preflight.outputs.mode == 'release' }}",
    );
    expect(contents).not.toContain("token:");
    expect(contents).toMatch(/^ {2}workflow_dispatch:$/m);
    expect(contents).toContain("group: release-please-main");
    expect(releasePlease).toContain("RUN_ATTEMPT: ${{ github.run_attempt }}");
    expect(releasePlease).toContain("TRIGGERING_REF: ${{ github.ref }}");
    expect(releasePlease).toContain(
      'if [[ "$TRIGGERING_REF" != "refs/heads/main" ]]; then',
    );
    expect(releasePlease).toContain("ref: ${{ github.sha }}");
    expect(
      matches(
        releasePlease,
        /git fetch --no-tags origin \+refs\/heads\/main:refs\/remotes\/origin\/main/g,
      ),
    ).toHaveLength(4);
    expect(releasePlease).toContain("validateMergedReleasePullRequest");
    expect(releasePlease).toContain("validatePreparedReleasePullRequest");
    expect(releasePlease).toContain("selectPendingReleasePullRequest");
    expect(releasePlease).toContain("validateReleasePleaseCommitMessages");
    expect(releasePlease).toContain(
      "validateReleasePleaseMutationConfiguration",
    );
    expect(releasePlease).toContain("validateReleasePleaseRunMetadata");
    expect(releasePlease).toContain("validateReleasePresenceBeforeAction");
    expect(releasePlease).toContain("validateReleasePleaseCompletion");
    expect(releasePlease).toContain("validateTaggedReleasePullRequest");
    expect(releasePlease).toContain(
      'if [[ "$EVENT_NAME" == "workflow_dispatch" && "$RUN_ATTEMPT" != "1" ]]; then',
    );
    expect(releasePlease).not.toContain(
      "Release Please reruns are forbidden; start a new first-attempt run.",
    );
    expect(releasePlease.indexOf("npm ci --ignore-scripts")).toBeLessThan(
      releasePlease.indexOf("node scripts/validate-release.mjs"),
    );
    expect(releasePlease).toMatch(
      /if: steps\.preflight\.outputs\.mode == 'release'[\s\S]*node scripts\/validate-release\.mjs \\\n[\s\S]*--require-final \\\n[\s\S]*--require-releasable-docs/,
    );
    expect(releasePlease).toContain(
      "release-please-result-${{ github.run_id }}-${{ github.run_attempt }}",
    );
    expect(releasePlease).toContain("validateReleasePleaseActionResult");
    expect(releasePlease).toContain("schemaVersion: 2");
    expect(releasePlease).toContain("actionOutcome");
    expect(releasePlease).toContain("recovered");
    expect(releasePlease).toContain("releaseExistedBeforeAction");
    expect(releasePlease).toContain("releaseSourceAttempt");
    expect(releaseWorkflowValidation).toContain(
      "validateReleaseAttemptEvidence",
    );
    expect(releasePlease).toContain("validatePostActionPullRequestSnapshot");
    expect(releasePlease).toContain("extractReleaseNotesFromChangelog");
    expect(releasePlease).toContain("/attempts/${attempt}/jobs?per_page=100");
    expect(releasePlease).toContain("release-pulls-before-action.json");
    expect(releasePlease).toContain("autorelease%3A%20pending");
    expect(releasePlease).toContain("labels[]=autorelease: tagged");
    expect(
      releasePlease.indexOf(
        "Reconfirm the branch, candidate, and review before mutation",
      ),
    ).toBeLessThan(releasePlease.indexOf("Run Release Please"));
    expect(
      releasePlease.indexOf(
        "Reconfirm the exact release state before mutation",
      ),
    ).toBeLessThan(releasePlease.indexOf("Run Release Please"));

    expect(releasePleaseConfig["last-release-sha"]).toBe(
      "1752cbb57f11dc6dca8dd1b13f0f8d5e8b5fdfca",
    );
    expect(releasePleaseConfig.label).toBe("autorelease: pending");
    expect(releasePleaseConfig["release-label"]).toBe("autorelease: tagged");
    expect(releasePleaseConfig["separate-pull-requests"]).toBe(true);
    expect(releasePleaseConfig.packages["."]).toMatchObject({
      component: "cometapi",
      "include-component-in-tag": false,
      "pull-request-title-pattern":
        "chore${scope}: release${component} ${version}",
      "release-type": "node",
      "skip-github-release": false,
      versioning: "always-bump-patch",
    });
  });

  it("parses every inline Node workflow validator", () => {
    const blocks = matches(
      workflow("release-please.yml"),
      /node --input-type=module <<'EOF'\n([\s\S]*?)\n\s+EOF/g,
    );
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const checked = spawnSync(
        process.execPath,
        ["--input-type=module", "--check", "-"],
        { encoding: "utf8", input: block[1] },
      );
      expect(checked.stderr).toBe("");
      expect(checked.status).toBe(0);
    }
  });

  it("starts publication only from the completed Release Please workflow", () => {
    const publish = workflow("publish.yml");
    expect(publish).toMatch(
      /workflow_run:\n {4}workflows:\n {6}- Release Please\n {4}types:\n {6}- completed/,
    );
    expect(publish).not.toMatch(/^ {2}release:/m);

    const verify = job(publish, "verify");
    expect(verify).toContain(
      "github.event.workflow_run.conclusion == 'success'",
    );
    expect(verify).toContain("ref: refs/heads/main");
    expect(verify).toContain("EXPECTED_WORKFLOW: Release Please");
    expect(verify).toContain(
      "EXPECTED_WORKFLOW_PATH: .github/workflows/release-please.yml",
    );
    expect(verify).toContain("github.event.workflow_run.head_sha");
    expect(verify).toContain("github.event.workflow_run.run_attempt");
    expect(verify).toContain(
      "release-please-result-${{ github.event.workflow_run.id }}-${{ github.event.workflow_run.run_attempt }}",
    );
    expect(verify).toContain("run-id: ${{ github.event.workflow_run.id }}");
    const resultDownload = verify.slice(
      verify.indexOf("Download the exact Release Please result"),
      verify.indexOf("Reject an untrusted Release Please workflow run"),
    );
    expect(resultDownload).not.toContain("pattern:");
    expect(resultDownload).not.toContain("merge-multiple:");
    expect(resultDownload).not.toContain("release-please-result-1");
    expect(resultDownload).not.toContain("github.run_attempt");
    expect(verify).toContain("validateReleasePleaseActionResult");
    expect(verify).toContain("validateGitHubRelease");
    expect(verify).toContain("runAttempt: run.runAttempt");
    expect(verify).toContain("runId: run.runId");
    expect(releaseWorkflowValidation).toContain("run?.run_attempt");
    expect(releaseWorkflowValidation).toContain(
      'requireEqual(result.schemaVersion, 2, "result schema version")',
    );
    expect(releaseWorkflowValidation).toContain("result.actionOutcome");
    expect(releaseWorkflowValidation).toContain("result.recovered");
    expect(releaseWorkflowValidation).toContain(
      "result.releaseExistedBeforeAction",
    );
    expect(releaseWorkflowValidation).toContain("release?.immutable");
    expect(releaseWorkflowValidation).toContain("release?.target_commitish");

    expect(verify).toContain(
      "artifact-name: ${{ steps.artifact-name.outputs.name }}",
    );
    expect(verify).toContain(
      "npm-package-${{ steps.version.outputs.version }}-${{ github.run_id }}-${{ github.run_attempt }}",
    );
    expect(job(publish, "publish")).toContain(
      "name: ${{ needs.verify.outputs.artifact-name }}",
    );
  });

  it("rejects an unrelated divergent Release Please branch", () => {
    const releasePlease = job(workflow("release-please.yml"), "release-please");
    expect(releasePlease).toContain(
      "RELEASE_BRANCH: release-please--branches--main--components--cometapi",
    );
    expect(releasePlease).toContain(
      'git merge-base --is-ancestor "$release_ref" refs/remotes/origin/main',
    );
    expect(releasePlease).toContain("branch_version=");
    expect(releasePlease).toContain("manifest_version=");
    expect(releasePlease).toContain("pullRequest.headSha === branchSha");
    expect(releasePlease).toContain("validateReleasePleaseBranchState");
    expect(releasePlease).toContain(
      "pulls?state=closed&base=main&per_page=100",
    );
    expect(
      matches(releasePlease, /pulls\?state=all&base=main&per_page=100/g).length,
    ).toBeGreaterThanOrEqual(2);
    expect(releasePlease).toContain("validateOpenReleasePullRequestCollisions");
    expect(releasePlease).not.toContain(
      "pulls?state=closed&head=cometapi-dev%3A${RELEASE_BRANCH}",
    );
  });
});
