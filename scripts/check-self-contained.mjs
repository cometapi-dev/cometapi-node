import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROOT,
  makeTemporaryDirectory,
  removeTemporaryDirectory,
  run,
} from "./lib.mjs";
import { collectStandaloneContentViolations } from "./standalone-content.mjs";
import { materializeStandaloneTree } from "./check-standalone-content.mjs";

export function materializeTrackedCandidate(root, temporaryParent) {
  const gitEnvironment = {
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
  };
  const trackedStatus = run(
    "git",
    ["--no-replace-objects", "status", "--short", "--untracked-files=no"],
    { capture: true, cwd: root, env: gitEnvironment },
  ).trim();
  if (trackedStatus) {
    throw new Error(
      "The self-containment gate requires a clean tracked worktree so it can verify the exact HEAD tree.",
    );
  }

  const candidateRoot = join(temporaryParent, "cometapi-node");
  const headTree = run(
    "git",
    ["--no-replace-objects", "rev-parse", "--verify", "HEAD^{tree}"],
    { capture: true, cwd: root, env: gitEnvironment },
  ).trim();
  if (!/^[0-9a-f]+$/.test(headTree)) {
    throw new Error(
      "The self-containment gate could not resolve the HEAD tree.",
    );
  }
  materializeStandaloneTree(root, headTree, candidateRoot);
  return candidateRoot;
}

export function checkSelfContained(root = ROOT) {
  const temporaryParent = makeTemporaryDirectory("cometapi-standalone-");

  try {
    const candidateRoot = materializeTrackedCandidate(root, temporaryParent);
    const violations = collectStandaloneContentViolations(candidateRoot);
    if (violations.length > 0) {
      throw new Error(
        `Standalone repository scan found ${String(violations.length)} outside-root reference(s):\n- ${violations.join("\n- ")}`,
      );
    }
    run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: candidateRoot });
    run("npm", ["run", "verify:offline"], {
      cwd: candidateRoot,
      env: { COMETAPI_SELF_CONTAINMENT: "1" },
    });
    run("npm", ["run", "actionlint"], {
      cwd: candidateRoot,
      env: { COMETAPI_SELF_CONTAINMENT: "1" },
    });
    console.log(
      "Exact tracked HEAD copy, standalone scan, offline verification, and actionlint passed.",
    );
  } finally {
    removeTemporaryDirectory(temporaryParent);
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  checkSelfContained();
}
