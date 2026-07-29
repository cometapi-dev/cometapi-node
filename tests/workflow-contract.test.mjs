import { readFileSync } from "node:fs";
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
    expect(releasePlease).not.toContain("skip-github-release: true");
    expect(contents).not.toContain("token:");
    expect(contents).toMatch(/^ {2}workflow_dispatch:$/m);
    expect(releasePlease).toContain("RUN_ATTEMPT: ${{ github.run_attempt }}");
    expect(releasePlease).toContain("ref: ${{ github.sha }}");
    expect(
      matches(
        releasePlease,
        /git fetch --no-tags origin \+refs\/heads\/main:refs\/remotes\/origin\/main/g,
      ),
    ).toHaveLength(2);
    expect(releasePlease).toContain("validateMergedReleasePullRequest");
    expect(releasePlease).toContain("selectPendingReleasePullRequest");
    expect(releasePlease).toContain(
      "release-please-result-${{ github.run_id }}-${{ github.run_attempt }}",
    );
    expect(releasePlease).toContain("validateReleasePleaseActionResult");

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
      versioning: "default",
    });
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
    expect(verify).toContain("validateReleasePleaseActionResult");
    expect(verify).toContain("validateGitHubRelease");
    expect(releaseWorkflowValidation).toContain("run?.run_attempt");
    expect(releaseWorkflowValidation).toContain("result.releaseCreated");
    expect(releaseWorkflowValidation).toContain("release?.immutable");
    expect(releaseWorkflowValidation).toContain("release?.target_commitish");
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
    expect(releasePlease).toContain("pullRequest.head?.sha === branchSha");
    expect(releasePlease).toContain("validateReleasePleaseBranchState");
  });
});
