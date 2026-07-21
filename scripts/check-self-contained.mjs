import { cpSync } from "node:fs";
import { basename, join } from "node:path";

import {
  ROOT,
  makeTemporaryDirectory,
  removeTemporaryDirectory,
  run,
} from "./lib.mjs";
import {
  collectStandaloneContentViolations,
  STANDALONE_CONTENT_EXCLUSIONS,
} from "./standalone-content.mjs";

function shouldCopy(source) {
  return !STANDALONE_CONTENT_EXCLUSIONS.has(basename(source));
}

const temporaryParent = makeTemporaryDirectory("cometapi-standalone-");
const candidateRoot = join(temporaryParent, "cometapi-node");

try {
  cpSync(ROOT, candidateRoot, { filter: shouldCopy, recursive: true });
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
    "Standalone-copy scan, offline verification, and actionlint passed.",
  );
} finally {
  removeTemporaryDirectory(temporaryParent);
}
