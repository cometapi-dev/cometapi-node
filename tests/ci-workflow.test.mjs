import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

function readWorkflow(name = "ci.yml") {
  const source = readFileSync(
    new URL(`../.github/workflows/${name}`, import.meta.url),
    "utf8",
  );
  const document = parseDocument(source, { uniqueKeys: true });
  expect(document.errors).toEqual([]);
  return document.toJS({ maxAliasCount: 100 });
}

describe("blocking CI workflow", () => {
  it("installs dependencies before dependency-backed workflow gates", () => {
    const workflowLint = readWorkflow().jobs?.["workflow-lint"];
    expect(workflowLint).toBeDefined();
    const previewInstall = workflowLint.steps.findIndex(
      (step) => step.run === "npm ci",
    );
    const previewGate = workflowLint.steps.findIndex(
      (step) => step.run === "npm run check:public-preview",
    );
    expect(workflowLint.steps[previewInstall]).toEqual({
      name: "Install locked dependencies",
      run: "npm ci",
    });
    expect(workflowLint.steps[previewGate]).toEqual({
      name: "Validate Public Preview content and identity",
      run: "npm run check:public-preview",
    });
    expect(previewGate).toBeGreaterThan(previewInstall);

    const releaseVerify = readWorkflow("publish.yml").jobs?.verify;
    expect(releaseVerify).toBeDefined();
    const trustGate = releaseVerify.steps.findIndex(
      (step) => step.id === "trust",
    );
    const validationInstall = releaseVerify.steps.findIndex(
      (step) => step.run === "npm ci --ignore-scripts",
    );
    const releaseGate = releaseVerify.steps.findIndex(
      (step) =>
        typeof step.run === "string" &&
        step.run.includes("node scripts/validate-release.mjs"),
    );
    const fullInstall = releaseVerify.steps.findIndex(
      (step, index) => index > releaseGate && step.run === "npm ci",
    );
    expect(Object.keys(releaseVerify.steps[trustGate]).sort()).toEqual([
      "env",
      "id",
      "name",
      "run",
      "shell",
    ]);
    expect(releaseVerify.steps[trustGate]).toMatchObject({
      id: "trust",
      name: "Reject an untrusted release target",
      shell: "bash",
    });
    expect(releaseVerify.steps[validationInstall]).toEqual({
      name: "Install validation dependencies without lifecycle scripts",
      run: "npm ci --ignore-scripts",
    });
    expect(validationInstall).toBeGreaterThan(trustGate);
    expect(releaseVerify.steps[releaseGate]).toEqual({
      env: {
        RELEASE_IS_PRERELEASE: "${{ github.event.release.prerelease }}",
        RELEASE_TAG: "${{ github.event.release.tag_name }}",
      },
      id: "version",
      name: "Verify release metadata and derive the npm dist-tag",
      run: [
        "set -euo pipefail",
        "node scripts/validate-release.mjs \\",
        '  --tag "$RELEASE_TAG" \\',
        '  --release-prerelease "$RELEASE_IS_PRERELEASE" \\',
        "  --require-final \\",
        '  --require-releasable-docs >> "$GITHUB_OUTPUT"',
        "",
      ].join("\n"),
      shell: "bash",
    });
    expect(releaseGate).toBeGreaterThan(validationInstall);
    expect(releaseVerify.steps[fullInstall]).toEqual({
      name: "Install locked dependencies",
      run: "npm ci",
    });
    expect(fullInstall).toBeGreaterThan(releaseGate);
  });

  it("runs the live-smoke contract in the locked Node.js 22 and 24 job", () => {
    const workflow = readWorkflow();
    const locked = workflow.jobs?.locked;

    expect(locked).toBeDefined();
    expect(Object.keys(locked).sort()).toEqual([
      "name",
      "runs-on",
      "steps",
      "strategy",
      "timeout-minutes",
    ]);
    expect(Object.keys(locked.strategy).sort()).toEqual([
      "fail-fast",
      "matrix",
    ]);
    expect(Object.keys(locked.strategy.matrix)).toEqual(["node-version"]);
    expect(locked.strategy?.matrix?.["node-version"]).toEqual(["22.x", "24.x"]);

    const liveContractSteps = locked.steps.filter(
      (step) => step.run === "npm run test:live-contract",
    );
    expect(liveContractSteps).toHaveLength(1);
    expect(Object.keys(liveContractSteps[0]).sort()).toEqual(["name", "run"]);
    expect(liveContractSteps[0]).toMatchObject({
      name: "Verify live-smoke semantic checks with mocked transport",
      run: "npm run test:live-contract",
    });
  });

  it("round-trips one packed artifact across separate jobs", () => {
    const jobs = readWorkflow().jobs;
    const pack = jobs?.["artifact-pack"];
    const download = jobs?.["artifact-download"];

    expect(pack?.outputs).toEqual({
      sha256: "${{ steps.pack.outputs.sha256 }}",
    });
    expect(download?.needs).toEqual(["artifact-pack"]);
    expect(pack.steps.some((step) => step.run?.includes("npm pack"))).toBe(
      true,
    );
    expect(
      pack.steps.some((step) =>
        step.uses?.startsWith("actions/upload-artifact@"),
      ),
    ).toBe(true);
    expect(
      download.steps.some((step) =>
        step.uses?.startsWith("actions/download-artifact@"),
      ),
    ).toBe(true);
    expect(download.steps.at(-1).run).toContain("sha256sum --check --strict");
  });
});
