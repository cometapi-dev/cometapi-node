import { isUtf8 } from "node:buffer";
import {
  cpSync,
  existsSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  ROOT,
  makeTemporaryDirectory,
  removeTemporaryDirectory,
  run,
} from "./lib.mjs";

const excluded = new Set([
  ".artifacts",
  ".cache",
  ".DS_Store",
  ".git",
  "coverage",
  "dist",
  "node_modules",
]);
const parentReferencePattern =
  /(?:^|[\s`"'(=:[{])((?:\.\.[\\/])+[A-Za-z0-9@%_+.,~\\/-]+)/gm;
const absoluteLocalPathPatterns = [
  /(?:^|[\s`"'(=:[{])((?:file:\/\/\/(?:Users|home|private|root|Volumes|workspaces?)|\/(?:Users|home|private|root|Volumes|workspaces?))\/[A-Za-z0-9@%_+.,~/-]+)/gm,
  /(?:^|[\s`"'(=:[{])((?:~\/|\$HOME\/|\$\{HOME\}\/)[A-Za-z0-9@%_+.,~/-]+)/gm,
  /(?:^|[\s`"'(=:[{])([A-Za-z]:[\\/][^\s`"')\]}>;,]+)/gm,
  /(?:^|[\s`"'(=:[{])(\\\\[A-Za-z0-9._-]+[\\/][^\s`"')\]}>;,]+)/gm,
];
const privateArtifactPattern = /\b(?:SDK_PRD\.md|references\/)/g;
const privateWorkspacePathPattern =
  /\b(?:cometapi-worksapce|cometapi-(?:python|go|cli)|comet-api-(?:backend|frontend|next))[\\/][A-Za-z0-9@%_+.~/-]{2,}/g;
const privateReferencesDirectory = ["references", ""].join("/");

function shouldCopy(source) {
  return !excluded.has(basename(source));
}

function isInside(root, path) {
  const pathFromRoot = relative(root, path);
  return (
    pathFromRoot === "" ||
    (!isAbsolute(pathFromRoot) &&
      pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(`..${sep}`))
  );
}

function scanTextFile(path, candidateRoot, violations) {
  const bytes = readFileSync(path);
  if (bytes.includes(0) || !isUtf8(bytes)) return;

  const contents = bytes.toString("utf8");
  const displayPath = relative(candidateRoot, path);

  for (const match of contents.matchAll(parentReferencePattern)) {
    const reference = match[1];
    const resolvedReference = resolve(
      dirname(path),
      reference.replaceAll("\\", "/"),
    );
    if (!isInside(candidateRoot, resolvedReference)) {
      violations.push(
        `${displayPath}: parent-relative path escapes the repository (${reference})`,
      );
    }
  }

  for (const pattern of absoluteLocalPathPatterns) {
    for (const match of contents.matchAll(pattern)) {
      violations.push(
        `${displayPath}: absolute machine-local path is not standalone (${match[1]})`,
      );
    }
  }

  for (const match of contents.matchAll(privateArtifactPattern)) {
    const reference = match[0];
    const rootEntry = reference.startsWith(privateReferencesDirectory)
      ? "references"
      : reference;
    if (!existsSync(join(candidateRoot, rootEntry))) {
      violations.push(
        `${displayPath}: references non-repository private material (${reference})`,
      );
    }
  }

  for (const match of contents.matchAll(privateWorkspacePathPattern)) {
    const reference = match[0];
    const rootEntry = reference.split(/[\\/]/, 1)[0];
    if (!existsSync(join(candidateRoot, rootEntry))) {
      violations.push(
        `${displayPath}: references a private workspace or sibling repository (${reference})`,
      );
    }
  }
}

function scan(directory, candidateRoot, violations) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(path, candidateRoot, violations);
      continue;
    }
    if (entry.isSymbolicLink()) {
      const target = readlinkSync(path);
      const resolvedTarget = resolve(dirname(path), target);
      if (!isInside(candidateRoot, resolvedTarget)) {
        violations.push(
          `${relative(candidateRoot, path)}: symbolic link escapes the repository (${target})`,
        );
        continue;
      }
      if (!existsSync(resolvedTarget)) {
        violations.push(
          `${relative(candidateRoot, path)}: symbolic link target is missing (${target})`,
        );
        continue;
      }
      if (statSync(path).isDirectory()) continue;
    }
    scanTextFile(path, candidateRoot, violations);
  }
}

const temporaryParent = makeTemporaryDirectory("cometapi-standalone-");
const candidateRoot = join(temporaryParent, "cometapi-node");

try {
  cpSync(ROOT, candidateRoot, { filter: shouldCopy, recursive: true });
  const violations = [];
  scan(candidateRoot, candidateRoot, violations);
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
