import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

function readWorkflow() {
  const source = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const document = parseDocument(source, { uniqueKeys: true });
  expect(document.errors).toEqual([]);
  return document.toJS({ maxAliasCount: 100 });
}

describe("blocking CI workflow", () => {
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
});
