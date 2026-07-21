import { isUtf8 } from "node:buffer";
import {
  existsSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const STANDALONE_CONTENT_EXCLUSIONS = new Set([
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
    if (entry.isDirectory() && STANDALONE_CONTENT_EXCLUSIONS.has(entry.name)) {
      continue;
    }
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

export function collectStandaloneContentViolations(candidateRoot) {
  const violations = [];
  scan(candidateRoot, candidateRoot, violations);
  return violations;
}

export function formatStandaloneContentViolations(violations) {
  return [
    `Standalone content gate found ${String(violations.length)} violation(s):`,
    ...violations.map((violation) => `- ${violation}`),
  ].join("\n");
}
