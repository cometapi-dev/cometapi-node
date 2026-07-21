import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ROOT } from "./lib.mjs";
import {
  collectPublicPreviewViolations,
  formatPublicPreviewViolations,
} from "./release-validation.mjs";
import { collectStandaloneContentViolations } from "./standalone-content.mjs";

export function collectPublicPreviewGateViolations(root = ROOT) {
  const inputViolations = [];
  const read = (name) => {
    try {
      return readFileSync(join(root, name), "utf8");
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

  const contentViolations = collectPublicPreviewViolations({
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

  const standaloneContentViolations = [];
  try {
    standaloneContentViolations.push(
      ...collectStandaloneContentViolations(root),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    standaloneContentViolations.push(
      `standalone content could not be checked: ${detail}`,
    );
  }

  return [
    ...inputViolations,
    ...contentViolations,
    ...standaloneContentViolations,
  ];
}

function main() {
  const violations = collectPublicPreviewGateViolations();
  if (violations.length > 0) {
    console.error(formatPublicPreviewViolations(violations));
    process.exitCode = 1;
  } else {
    console.log("Public Preview content gate passed.");
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
