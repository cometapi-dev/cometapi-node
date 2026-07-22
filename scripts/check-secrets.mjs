import { isUtf8 } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ROOT } from "./lib.mjs";

const ignoredDirectories = new Set([
  ".artifacts",
  ".cache",
  ".git",
  "coverage",
  "dist",
  "node_modules",
]);
const rules = [
  {
    id: "openai-style-key",
    pattern: /(?:^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/,
  },
  {
    id: "npm-auth-token-assignment",
    pattern: /_authToken\s*=\s*[^$\s{][^\s]*/,
  },
  { id: "npm-access-token", pattern: /npm_[A-Za-z0-9]{24,}/ },
];
const gitEnvironment = {
  ...process.env,
  GIT_NO_LAZY_FETCH: "1",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
};
const gitOutputLimit = 256 * 1024 * 1024;
const blobBatchSize = 64;
const gitObjectTypes = new Set(["blob", "commit", "tag", "tree"]);

function runGit(root, args, { allowFailure = false, input } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    env: gitEnvironment,
    input,
    maxBuffer: gitOutputLimit,
  });

  if (result.error) {
    throw new Error("Secret scan could not execute Git.");
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `Secret scan could not inspect Git data (${args[0]} failed).`,
    );
  }
  return result;
}

function gitText(root, args, options) {
  const output = runGit(root, args, options).stdout;
  if (!isUtf8(output)) {
    throw new Error("Secret scan cannot safely decode Git metadata as UTF-8.");
  }
  return output.toString("utf8");
}

function addMatches(contents, location, violations) {
  const text = contents.toString(isUtf8(contents) ? "utf8" : "latin1");

  for (const rule of rules) {
    if (!rule.pattern.test(text)) continue;
    let key;
    if (location.blob !== undefined) {
      key = `blob:${location.blob}:${rule.id}`;
    } else if (location.commit !== undefined) {
      key = `commit:${location.commit}:${rule.id}`;
    } else if (location.tag !== undefined) {
      key = `tag:${location.tag}:${rule.id}`;
    } else if (location.pathHash !== undefined) {
      key = `path-hash:${location.pathHash}:${rule.id}`;
    } else {
      key = `path:${location.path}:${rule.id}`;
    }
    violations.set(key, { ...location, rule: rule.id });
  }
}

function locationForPath(path) {
  const contents = Buffer.from(path, "utf8");
  const text = contents.toString("utf8");
  if (rules.some(({ pattern }) => pattern.test(text))) {
    return {
      pathHash: createHash("sha256").update(contents).digest("hex"),
    };
  }
  return { path };
}

function reportPath(path) {
  const location = locationForPath(path);
  return location.pathHash === undefined
    ? JSON.stringify(path)
    : `sha256:${location.pathHash}`;
}

function readRegularFile(path, displayPath) {
  try {
    return readFileSync(path);
  } catch {
    throw new Error(
      `Secret scan could not read path ${reportPath(displayPath)}.`,
    );
  }
}

function readSymbolicLink(path, displayPath) {
  try {
    return readlinkSync(path, { encoding: "buffer" });
  } catch {
    throw new Error(
      `Secret scan could not read symbolic link ${reportPath(displayPath)}.`,
    );
  }
}

function scanPath(path, violations) {
  const location = locationForPath(path);
  addMatches(Buffer.from(path, "utf8"), location, violations);
  return location;
}

function parseBlobBatch(output, expectedIds) {
  const blobs = new Map();
  let offset = 0;

  for (const expectedId of expectedIds) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd === -1) {
      throw new Error("Secret scan received incomplete Git blob metadata.");
    }
    const header = output.subarray(offset, headerEnd).toString("ascii");
    const match = /^([0-9a-f]+) blob ([0-9]+)$/.exec(header);
    if (match === null || match[1] !== expectedId) {
      throw new Error("Secret scan could not read a reachable Git blob.");
    }

    const size = Number.parseInt(match[2], 10);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (
      !Number.isSafeInteger(size) ||
      contentEnd >= output.length ||
      output[contentEnd] !== 0x0a
    ) {
      throw new Error("Secret scan received incomplete Git blob content.");
    }
    blobs.set(expectedId, output.subarray(contentStart, contentEnd));
    offset = contentEnd + 1;
  }

  if (offset !== output.length) {
    throw new Error("Secret scan received unexpected Git blob output.");
  }
  return blobs;
}

function readBlobs(root, objectIds, callback) {
  for (let start = 0; start < objectIds.length; start += blobBatchSize) {
    const batch = objectIds.slice(start, start + blobBatchSize);
    const result = runGit(root, ["cat-file", "--batch"], {
      input: `${batch.join("\n")}\n`,
    });
    const blobs = parseBlobBatch(result.stdout, batch);
    for (const objectId of batch) callback(objectId, blobs.get(objectId));
  }
}

function parseObjectBatch(output, expectedObjects) {
  const objects = new Map();
  let offset = 0;

  for (const expected of expectedObjects) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd === -1) {
      throw new Error("Secret scan received incomplete Git object metadata.");
    }
    const header = output.subarray(offset, headerEnd).toString("ascii");
    const match = /^([0-9a-f]+) ([a-z]+) ([0-9]+)$/.exec(header);
    if (
      match === null ||
      match[1] !== expected.objectId ||
      match[2] !== expected.type
    ) {
      throw new Error("Secret scan could not read a reachable Git object.");
    }

    const size = Number.parseInt(match[3], 10);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (
      !Number.isSafeInteger(size) ||
      contentEnd >= output.length ||
      output[contentEnd] !== 0x0a
    ) {
      throw new Error("Secret scan received incomplete Git object content.");
    }
    objects.set(expected.objectId, output.subarray(contentStart, contentEnd));
    offset = contentEnd + 1;
  }

  if (offset !== output.length) {
    throw new Error("Secret scan received unexpected Git object output.");
  }
  return objects;
}

function readObjects(root, objects, callback) {
  for (let start = 0; start < objects.length; start += blobBatchSize) {
    const batch = objects.slice(start, start + blobBatchSize);
    const result = runGit(root, ["cat-file", "--batch"], {
      input: `${batch.map(({ objectId }) => objectId).join("\n")}\n`,
    });
    const contentsByObjectId = parseObjectBatch(result.stdout, batch);
    for (const object of batch) {
      callback(object, contentsByObjectId.get(object.objectId));
    }
  }
}

function trackedEntries(root) {
  const output = gitText(root, ["ls-files", "--cached", "--stage", "-z"]);
  if (output.length === 0) return [];

  return output
    .split("\0")
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separator = entry.indexOf("\t");
      const header = entry.slice(0, separator);
      const path = entry.slice(separator + 1);
      const match = /^(\d{6}) ([0-9a-f]+) ([0-3])$/.exec(header);
      if (separator === -1 || match === null || path.length === 0) {
        throw new Error("Secret scan received malformed tracked-file data.");
      }
      if (match[3] !== "0") {
        throw new Error(
          "Secret scan cannot prove coverage while the Git index is unmerged.",
        );
      }
      return { mode: match[1], objectId: match[2], path };
    });
}

function scanTrackedFiles(root, violations) {
  const entries = trackedEntries(root).filter(
    ({ mode }) => mode.startsWith("100") || mode === "120000",
  );
  const pathsByObjectId = new Map();

  for (const entry of entries) {
    scanPath(entry.path, violations);
    const paths = pathsByObjectId.get(entry.objectId) ?? [];
    paths.push(entry.path);
    pathsByObjectId.set(entry.objectId, paths);
  }
  readBlobs(root, [...pathsByObjectId.keys()], (objectId, contents) => {
    for (const path of pathsByObjectId.get(objectId)) {
      addMatches(contents, locationForPath(path), violations);
    }
  });

  for (const entry of entries) {
    const absolutePath = join(root, entry.path);
    let status;
    try {
      status = lstatSync(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw new Error(
        `Secret scan could not inspect tracked path ${reportPath(entry.path)}.`,
      );
    }

    if (status.isFile()) {
      addMatches(
        readRegularFile(absolutePath, entry.path),
        locationForPath(entry.path),
        violations,
      );
    } else if (status.isSymbolicLink()) {
      addMatches(
        readSymbolicLink(absolutePath, entry.path),
        locationForPath(entry.path),
        violations,
      );
    } else {
      throw new Error(
        `Secret scan cannot read tracked path ${reportPath(entry.path)} as a regular file or symbolic link.`,
      );
    }
  }
}

function reachableObjects(root) {
  const head = runGit(root, ["rev-parse", "--verify", "--quiet", "HEAD"], {
    allowFailure: true,
  });
  const revisions = head.status === 0 ? ["--all", "HEAD"] : ["--all"];
  const objects = gitText(root, [
    "rev-list",
    "--objects",
    ...revisions,
    "--no-object-names",
  ])
    .trim()
    .split("\n")
    .filter((objectId) => objectId.length > 0);
  const objectsByType = Object.fromEntries(
    [...gitObjectTypes].map((type) => [type, new Set()]),
  );

  for (let start = 0; start < objects.length; start += 4096) {
    const batch = objects.slice(start, start + 4096);
    const types = gitText(
      root,
      ["cat-file", "--batch-check=%(objectname) %(objecttype)"],
      { input: `${batch.join("\n")}\n` },
    );
    const lines = types.trim().split("\n");
    if (lines.length !== batch.length) {
      throw new Error("Secret scan received incomplete Git object data.");
    }
    for (const [index, line] of lines.entries()) {
      const match = /^([0-9a-f]+) ([a-z]+)$/.exec(line);
      if (
        match === null ||
        match[1] !== batch[index] ||
        !gitObjectTypes.has(match[2])
      ) {
        throw new Error("Secret scan received malformed Git object data.");
      }
      objectsByType[match[2]].add(match[1]);
    }
  }
  return Object.fromEntries(
    Object.entries(objectsByType).map(([type, objectIds]) => [
      type,
      [...objectIds],
    ]),
  );
}

function splitMetadataObject(contents, type, objectId) {
  const separator = contents.indexOf("\n\n");
  if (separator === -1) {
    throw new Error(
      `Secret scan received malformed reachable Git ${type} ${objectId}.`,
    );
  }
  return {
    headers: contents.subarray(0, separator),
    message: contents.subarray(separator + 2),
  };
}

function commitTree(headers, objectId) {
  const firstLineEnd = headers.indexOf(0x0a);
  const firstLine = headers
    .subarray(0, firstLineEnd === -1 ? headers.length : firstLineEnd)
    .toString("ascii");
  const match = /^tree ([0-9a-f]+)$/.exec(firstLine);
  if (match === null) {
    throw new Error(
      `Secret scan received malformed reachable Git commit ${objectId}.`,
    );
  }
  return match[1];
}

function taggedTree(headers, objectId) {
  const text = headers.toString("latin1");
  const match = /^object ([0-9a-f]+)\ntype ([a-z]+)(?:\n|$)/.exec(text);
  if (match === null) {
    throw new Error(
      `Secret scan received malformed reachable Git tag ${objectId}.`,
    );
  }
  return match[2] === "tree" ? match[1] : undefined;
}

function scanTreePaths(root, treeIds, violations) {
  for (const tree of treeIds) {
    const output = runGit(root, [
      "ls-tree",
      "--full-tree",
      "-r",
      "-t",
      "-z",
      tree,
    ]).stdout;
    let offset = 0;

    while (offset < output.length) {
      const terminator = output.indexOf(0x00, offset);
      if (terminator === -1) {
        throw new Error(
          `Secret scan received malformed Git tree data for ${tree}.`,
        );
      }
      const entry = output.subarray(offset, terminator);
      const separator = entry.indexOf(0x09);
      const header = entry.subarray(0, separator).toString("ascii");
      const path = entry.subarray(separator + 1);
      if (
        separator === -1 ||
        !/^[0-7]{6} (?:blob|commit|tree) [0-9a-f]+$/.test(header) ||
        path.length === 0
      ) {
        throw new Error(
          `Secret scan received malformed Git tree data for ${tree}.`,
        );
      }
      addMatches(
        path,
        { pathHash: createHash("sha256").update(path).digest("hex") },
        violations,
      );
      offset = terminator + 1;
    }
  }
}

function scanHistory(root, violations) {
  const objects = reachableObjects(root);
  readBlobs(root, objects.blob, (blob, contents) => {
    addMatches(contents, { blob }, violations);
  });

  const rootTrees = new Set();
  const metadataObjects = [
    ...objects.commit.map((objectId) => ({ objectId, type: "commit" })),
    ...objects.tag.map((objectId) => ({ objectId, type: "tag" })),
  ];
  readObjects(root, metadataObjects, ({ objectId, type }, contents) => {
    const metadata = splitMetadataObject(contents, type, objectId);
    addMatches(metadata.message, { [type]: objectId }, violations);
    if (type === "commit") {
      rootTrees.add(commitTree(metadata.headers, objectId));
    } else {
      const tree = taggedTree(metadata.headers, objectId);
      if (tree !== undefined) rootTrees.add(tree);
    }
  });

  scanTreePaths(
    root,
    rootTrees.size > 0 ? [...rootTrees] : objects.tree,
    violations,
  );
}

function scanCopiedFiles(directory, root, violations) {
  const directoryPath = relative(root, directory) || ".";
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    throw new Error(
      `Secret scan could not read directory ${reportPath(directoryPath)}.`,
    );
  }
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      scanCopiedFiles(path, root, violations);
    } else if (entry.isFile()) {
      const displayPath = relative(root, path);
      const location = scanPath(displayPath, violations);
      addMatches(readRegularFile(path, displayPath), location, violations);
    } else if (entry.isSymbolicLink()) {
      const displayPath = relative(root, path);
      const location = scanPath(displayPath, violations);
      addMatches(readSymbolicLink(path, displayPath), location, violations);
    }
  }
}

function ensureCompleteRepository(root) {
  const repository = runGit(root, ["rev-parse", "--is-inside-work-tree"], {
    allowFailure: true,
  });
  if (
    repository.status !== 0 ||
    repository.stdout.toString("utf8").trim() !== "true"
  ) {
    throw new Error(
      "Secret scan requires a Git repository unless COMETAPI_SELF_CONTAINMENT=1.",
    );
  }
  const shallow = gitText(root, ["rev-parse", "--is-shallow-repository"]);
  if (shallow.trim() !== "false") {
    throw new Error(
      "Secret scan requires complete Git history; shallow repositories are rejected.",
    );
  }
}

export function collectSecretViolations(root, { mode = "git" } = {}) {
  const violations = new Map();
  if (mode === "files") {
    scanCopiedFiles(root, root, violations);
  } else if (mode === "git") {
    ensureCompleteRepository(root);
    scanTrackedFiles(root, violations);
    scanHistory(root, violations);
  } else {
    throw new Error(`Unknown secret scan mode: ${mode}`);
  }
  return [...violations.values()].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

export function formatSecretViolations(violations) {
  return [
    `Secret-pattern scan found ${String(violations.length)} possible credential(s):`,
    ...violations.map((violation) => {
      let location;
      if (violation.blob !== undefined) {
        location = `blob=${violation.blob}`;
      } else if (violation.commit !== undefined) {
        location = `commit=${violation.commit}`;
      } else if (violation.tag !== undefined) {
        location = `tag=${violation.tag}`;
      } else if (violation.pathHash !== undefined) {
        location = `path-sha256=${violation.pathHash}`;
      } else {
        location = `path=${JSON.stringify(violation.path)}`;
      }
      return `- rule=${violation.rule} ${location}`;
    }),
  ].join("\n");
}

export function checkSecrets(root, options) {
  const violations = collectSecretViolations(root, options);
  if (violations.length > 0) {
    throw new Error(formatSecretViolations(violations));
  }
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    checkSecrets(ROOT, {
      mode: process.env.COMETAPI_SELF_CONTAINMENT === "1" ? "files" : "git",
    });
    console.log(
      "Secret-pattern scan passed without printing candidate values.",
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Secret scan failed.",
    );
    process.exitCode = 1;
  }
}
