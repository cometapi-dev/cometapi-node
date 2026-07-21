import { readFileSync } from "node:fs";
import { join } from "node:path";

import { readJSON, ROOT } from "./lib.mjs";
import { validateReleaseMetadata } from "./release-validation.mjs";

let releaseIsPrerelease;
let requireFinalReleaseState = false;
let requireReleasableDocs = false;
let tag;

for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--require-final") {
    requireFinalReleaseState = true;
    continue;
  }
  if (argument === "--require-releasable-docs") {
    requireReleasableDocs = true;
    continue;
  }

  if (argument !== "--release-prerelease" && argument !== "--tag") {
    throw new Error(`Unknown release validation argument: ${String(argument)}`);
  }
  const value = process.argv[index + 1];
  if (!value) {
    throw new Error(`${argument} requires a value.`);
  }
  index += 1;

  if (argument === "--tag") {
    tag = value;
    continue;
  }
  if (value !== "true" && value !== "false") {
    throw new Error("--release-prerelease must be true or false.");
  }
  releaseIsPrerelease = value === "true";
}

const releaseDocuments = requireReleasableDocs
  ? {
      agents: readFileSync(join(ROOT, "AGENTS.md"), "utf8"),
      architecture: readFileSync(join(ROOT, "ARCHITECTURE.md"), "utf8"),
      changelog: readFileSync(join(ROOT, "CHANGELOG.md"), "utf8"),
      compatibility: readFileSync(join(ROOT, "COMPATIBILITY.md"), "utf8"),
      conduct: readFileSync(join(ROOT, "CODE_OF_CONDUCT.md"), "utf8"),
      contributing: readFileSync(join(ROOT, "CONTRIBUTING.md"), "utf8"),
      license: readFileSync(join(ROOT, "LICENSE"), "utf8"),
      readme: readFileSync(join(ROOT, "README.md"), "utf8"),
      releasing: readFileSync(join(ROOT, "RELEASING.md"), "utf8"),
      roadmap: readFileSync(join(ROOT, "ROADMAP.md"), "utf8"),
      security: readFileSync(join(ROOT, "SECURITY.md"), "utf8"),
      support: readFileSync(join(ROOT, "SUPPORT.md"), "utf8"),
    }
  : undefined;

const result = validateReleaseMetadata({
  changelog: readFileSync(join(ROOT, "CHANGELOG.md"), "utf8"),
  packageLock: readJSON(join(ROOT, "package-lock.json")),
  releaseDocuments,
  releaseConfig: readJSON(join(ROOT, "release-please-config.json")),
  releaseIsPrerelease,
  releaseManifest: readJSON(join(ROOT, ".release-please-manifest.json")),
  requireDatedChangelog: requireFinalReleaseState,
  requireFinalReleaseState,
  requireReleasableDocs,
  sourceManifest: readJSON(join(ROOT, "package.json")),
  tag,
});

console.log(`version=${result.version}`);
console.log(`dist-tag=${result.distTag}`);
