import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./lib.mjs";
import {
  collectPublicPreviewViolations,
  formatPublicPreviewViolations,
} from "./release-validation.mjs";

const inputViolations = [];
const read = (name) => {
  try {
    return readFileSync(join(ROOT, name), "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    inputViolations.push(`${name} could not be read: ${detail}`);
    return undefined;
  }
};

let sourceManifest;
const packageText = read("package.json");
if (packageText !== undefined) {
  try {
    sourceManifest = JSON.parse(packageText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    inputViolations.push(`package.json could not be parsed: ${detail}`);
  }
}

const violations = collectPublicPreviewViolations({
  documents: {
    agents: read("AGENTS.md"),
    architecture: read("ARCHITECTURE.md"),
    changelog: read("CHANGELOG.md"),
    compatibility: read("COMPATIBILITY.md"),
    conduct: read("CODE_OF_CONDUCT.md"),
    contributing: read("CONTRIBUTING.md"),
    license: read("LICENSE"),
    readme: read("README.md"),
    releasing: read("RELEASING.md"),
    roadmap: read("ROADMAP.md"),
    security: read("SECURITY.md"),
    support: read("SUPPORT.md"),
  },
  sourceManifest,
});

const allViolations = [...inputViolations, ...violations];
if (allViolations.length > 0) {
  console.error(formatPublicPreviewViolations(allViolations));
  process.exitCode = 1;
} else {
  console.log("Public Preview content gate passed.");
}
