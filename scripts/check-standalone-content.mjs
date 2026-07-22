import { isUtf8 } from "node:buffer";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROOT,
  makeTemporaryDirectory,
  removeTemporaryDirectory,
} from "./lib.mjs";
import {
  collectStandaloneContentViolations,
  formatStandaloneContentViolations,
} from "./standalone-content.mjs";

const gitEnvironment = {
  ...process.env,
  GIT_NO_LAZY_FETCH: "1",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
};
const gitOutputLimit = 256 * 1024 * 1024;

function runGit(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    env: gitEnvironment,
    maxBuffer: gitOutputLimit,
  });

  if (result.error) {
    throw new Error("Standalone content scan could not execute Git.");
  }
  if (result.status !== 0) {
    throw new Error(
      `Standalone content scan could not inspect Git data (${args[0]} failed).`,
    );
  }
  return result;
}

function gitText(root, args) {
  const output = runGit(root, args).stdout;
  if (!isUtf8(output)) {
    throw new Error(
      "Standalone content scan cannot safely decode Git metadata as UTF-8.",
    );
  }
  return output.toString("utf8");
}

function ensureCompleteRepository(root) {
  const repository = gitText(root, ["rev-parse", "--is-inside-work-tree"]);
  if (repository.trim() !== "true") {
    throw new Error(
      "Standalone content history scan requires a complete Git repository.",
    );
  }

  const shallow = gitText(root, ["rev-parse", "--is-shallow-repository"]);
  if (shallow.trim() !== "false") {
    throw new Error(
      "Standalone content history scan requires complete Git history; shallow repositories are rejected.",
    );
  }
}

function reachableCommitTrees(root) {
  const head = gitText(root, ["rev-parse", "--verify", "HEAD"]);
  const revisions = ["--all", head.trim()];
  const output = gitText(root, ["log", "--format=%H%x09%T", ...revisions]);
  const trees = new Map();

  for (const line of output.trim().split("\n")) {
    if (line.length === 0) continue;
    const match = /^([0-9a-f]+)\t([0-9a-f]+)$/.exec(line);
    if (match === null) {
      throw new Error(
        "Standalone content scan received malformed Git commit data.",
      );
    }
    const [, commit, tree] = match;
    if (!trees.has(tree)) trees.set(tree, commit);
  }

  if (trees.size === 0) {
    throw new Error(
      "Standalone content history scan requires at least one reachable Git commit.",
    );
  }
  return trees;
}

export function reachableStandaloneTrees(root) {
  ensureCompleteRepository(root);
  return reachableCommitTrees(root);
}

function parseTreeEntries(output, tree) {
  const entries = [];
  let offset = 0;

  while (offset < output.length) {
    const separator = output.indexOf(0x09, offset);
    const terminator = output.indexOf(0, separator + 1);
    if (separator === -1 || terminator === -1) {
      throw new Error(
        `Standalone content scan received malformed entries for tree ${tree}.`,
      );
    }

    const header = output.subarray(offset, separator).toString("ascii");
    const match = /^(100644|100755|120000) blob ([0-9a-f]+)$/.exec(header);
    const pathBytes = output.subarray(separator + 1, terminator);
    if (match === null || pathBytes.length === 0 || !isUtf8(pathBytes)) {
      throw new Error(
        `Standalone content scan cannot materialize every tracked entry in tree ${tree}.`,
      );
    }
    entries.push({
      mode: match[1],
      objectId: match[2],
      path: pathBytes.toString("utf8"),
    });
    offset = terminator + 1;
  }
  return entries;
}

function checkedDestination(root, path, tree) {
  if (path.length === 0 || isAbsolute(path)) {
    throw new Error(
      `Standalone content scan found an invalid path in tree ${tree}.`,
    );
  }
  const destination = resolve(root, path);
  const pathFromRoot = relative(root, destination);
  if (
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error(
      `Standalone content scan found an escaping path in tree ${tree}.`,
    );
  }
  return destination;
}

function assertPortableTreePaths(entries, tree) {
  const originalPrefixes = new Map();

  for (const { path } of entries) {
    const segments = path.split("/");
    for (let length = 1; length <= segments.length; length += 1) {
      const original = segments.slice(0, length).join("/");
      const portable = segments
        .slice(0, length)
        .map((segment) => segment.normalize("NFC").toLowerCase())
        .join("/");
      const prior = originalPrefixes.get(portable);
      if (prior !== undefined && prior !== original) {
        throw new Error(
          `Standalone content scan cannot safely materialize filesystem-equivalent paths in tree ${tree}.`,
        );
      }
      originalPrefixes.set(portable, original);
    }
  }
}

export function materializeStandaloneTree(root, tree, destinationRoot) {
  mkdirSync(destinationRoot, { recursive: true });
  const output = runGit(root, [
    "ls-tree",
    "-r",
    "-z",
    "--full-tree",
    tree,
  ]).stdout;
  const entries = parseTreeEntries(output, tree);
  assertPortableTreePaths(entries, tree);

  for (const { path } of entries) {
    checkedDestination(destinationRoot, path, tree);
  }
  for (const { mode, objectId, path } of entries) {
    const destination = checkedDestination(destinationRoot, path, tree);
    mkdirSync(dirname(destination), { recursive: true });
    const contents = runGit(root, ["cat-file", "blob", objectId]).stdout;

    if (mode === "120000") {
      if (!isUtf8(contents) || contents.includes(0)) {
        throw new Error(
          `Standalone content scan cannot materialize a symbolic link in tree ${tree}.`,
        );
      }
      symlinkSync(contents.toString("utf8"), destination);
    } else {
      writeFileSync(destination, contents, { flag: "wx" });
      chmodSync(destination, mode === "100755" ? 0o755 : 0o644);
    }
  }
}

export function collectStandaloneHistoryViolations(root) {
  const trees = reachableStandaloneTrees(root);
  const temporaryParent = makeTemporaryDirectory("cometapi-content-history-");
  const violations = [];

  try {
    let index = 0;
    for (const [tree, commit] of trees) {
      const candidateRoot = join(
        temporaryParent,
        `tree-${String(index).padStart(4, "0")}`,
      );
      index += 1;
      materializeStandaloneTree(root, tree, candidateRoot);
      for (const violation of collectStandaloneContentViolations(
        candidateRoot,
      )) {
        violations.push(`commit=${commit} tree=${tree}: ${violation}`);
      }
    }
  } finally {
    removeTemporaryDirectory(temporaryParent);
  }
  return violations;
}

export function contentScanMode(environment = process.env) {
  return environment.COMETAPI_SELF_CONTAINMENT === "1" ? "files" : "git";
}

export function collectStandaloneGateViolations(
  root,
  { mode = contentScanMode() } = {},
) {
  if (mode === "files") return collectStandaloneContentViolations(root);
  if (mode === "git") return collectStandaloneHistoryViolations(root);
  throw new Error(`Unknown standalone content scan mode: ${mode}`);
}

export function checkStandaloneContent(
  root = ROOT,
  { mode = contentScanMode() } = {},
) {
  const violations = collectStandaloneGateViolations(root, { mode });
  if (violations.length > 0) {
    throw new Error(formatStandaloneContentViolations(violations));
  }
}

function main() {
  const mode = contentScanMode();
  const scanRoot = mode === "files" ? process.cwd() : ROOT;
  try {
    checkStandaloneContent(scanRoot, { mode });
    console.log(
      mode === "git"
        ? "Standalone content gate passed for every reachable Git tree."
        : "Standalone content gate passed for the isolated tracked copy.",
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Standalone content scan failed.",
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
