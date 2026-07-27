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
    expect(verify).toContain(
      '[[ "$GITHUB_REPOSITORY" != "$EXPECTED_REPOSITORY" ]]',
    );
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

  it("keeps the token bootstrap opt-in and alpha.1-only", () => {
    const publishWorkflow = workflow("publish.yml");
    const publish = job(publishWorkflow, "publish");
    expect(publish).toContain(
      "ALPHA1_BOOTSTRAP_ENABLED: ${{ vars.NPM_ALPHA1_BOOTSTRAP_ENABLED }}",
    );
    expect(publish).toContain("secrets.NPM_ALPHA1_BOOTSTRAP_TOKEN");
    expect(publish).toContain(
      "needs.verify.outputs.version == '0.1.0-alpha.1'",
    );
    expect(publish).toContain(
      "ref: ${{ needs.verify.outputs.release-commit }}",
    );
    expect(publish).toContain("run: bash scripts/publish-artifact.sh");
    expect(
      matches(publishWorkflow, /secrets\.NPM_ALPHA1_BOOTSTRAP_TOKEN/g),
    ).toHaveLength(2);
  });

  it("limits manual publication recovery to the failed immutable alpha.1 run", () => {
    const publishWorkflow = workflow("publish.yml");
    const recoveryVerify = job(publishWorkflow, "recover-verify");
    const recoveryPublish = job(publishWorkflow, "recover-publish");

    expect(recoveryVerify).toContain("EXPECTED_TAG: v0.1.0-alpha.1");
    expect(recoveryVerify).toContain(
      'run.path !== ".github/workflows/publish.yml"',
    );
    expect(recoveryVerify).toContain("release.immutable !== true");
    expect(recoveryVerify).toContain(
      'conclusions.get("Verify the release tag against CometAPI") !== "success"',
    );
    expect(recoveryVerify).toContain(
      'artifact.name === "npm-package-0.1.0-alpha.1"',
    );
    expect(recoveryPublish).toContain("environment:\n      name: npm");
    expect(recoveryPublish).toContain("id-token: write");
    expect(recoveryPublish).toContain("run: bash scripts/publish-artifact.sh");
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
    for (const name of workflowNames) {
      expect(workflow(name)).toMatch(/^permissions:\n {2}contents: read$/m);
    }

    const ci = workflow("ci.yml");
    const liveSmoke = workflow("live-smoke.yml");
    expect(ci).not.toMatch(/^\s+[^:\n]+: write$/m);
    expect(liveSmoke).not.toMatch(/^\s+[^:\n]+: write$/m);

    const releasePlease = job(workflow("release-please.yml"), "release-please");
    expect(releasePlease).toMatch(/^ {6}contents: write$/m);
    expect(releasePlease).toMatch(/^ {6}pull-requests: write$/m);

    const publishWorkflow = workflow("publish.yml");
    expect(matches(publishWorkflow, /^\s+id-token: write$/gm)).toHaveLength(2);
    expect(job(publishWorkflow, "verify")).not.toContain("id-token: write");
    expect(job(publishWorkflow, "live-smoke")).not.toContain("id-token: write");
    expect(job(publishWorkflow, "publish")).toContain("id-token: write");
    expect(job(publishWorkflow, "recover-verify")).not.toContain(
      "id-token: write",
    );
    expect(job(publishWorkflow, "recover-publish")).toContain(
      "id-token: write",
    );
  });
});
