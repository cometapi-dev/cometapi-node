import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import { collectPublicPreviewGateViolations } from "../scripts/check-public-preview.mjs";
import {
  collectStandaloneGateViolations,
  collectStandaloneHistoryViolations,
  contentScanMode,
  reachableStandaloneTrees,
} from "../scripts/check-standalone-content.mjs";
import { ROOT } from "../scripts/lib.mjs";
import {
  collectStandaloneContentViolations,
  STANDALONE_CONTENT_EXCLUSIONS,
} from "../scripts/standalone-content.mjs";

function withTemporaryDirectory(callback) {
  const directory = mkdtempSync(join(tmpdir(), "cometapi-content-test-"));
  try {
    return callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
}

function gitWithInput(root, input, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input,
    stdio: "pipe",
  }).trim();
}

function initializeRepository(root) {
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "Standalone Content Test");
  git(root, "config", "user.email", "standalone-content@example.invalid");
}

function commitAll(root, message) {
  git(root, "add", "--all");
  git(root, "commit", "--message", message);
}

describe("standalone content", () => {
  it("collects independent outside-root references", () => {
    withTemporaryDirectory((root) => {
      const parentReference = ["..", "private-notes.md"].join("/");
      const absoluteReference = [
        "",
        "Users",
        "example",
        "private-notes.md",
      ].join("/");
      writeFileSync(
        join(root, "README.md"),
        `See ${parentReference} and ${absoluteReference}.\n`,
      );

      const violations = collectStandaloneContentViolations(root);
      expect(violations).toHaveLength(2);
      expect(violations.join("\n")).toMatch(/parent-relative path escapes/);
      expect(violations.join("\n")).toMatch(/absolute machine-local path/);
    });
  });

  it("reports escaping symbolic links", () => {
    withTemporaryDirectory((parent) => {
      const root = join(parent, "repository");
      mkdirSync(root);
      writeFileSync(join(parent, "outside.txt"), "private\n");
      symlinkSync(join(parent, "outside.txt"), join(root, "outside.txt"));

      expect(collectStandaloneContentViolations(root)).toEqual([
        expect.stringMatching(/symbolic link escapes the repository/),
      ]);
    });
  });

  it("reports missing symbolic-link targets", () => {
    withTemporaryDirectory((root) => {
      symlinkSync(join(root, "missing.txt"), join(root, "broken.txt"));

      expect(collectStandaloneContentViolations(root)).toEqual([
        expect.stringMatching(/symbolic link target is missing/),
      ]);
    });
  });

  it("reports private artifacts, reference directories, and sibling workspaces", () => {
    withTemporaryDirectory((root) => {
      const privateArtifact = ["SDK", "PRD.md"].join("_");
      const privateReference = ["references", "private.md"].join("/");
      const siblingWorkspace = `${["cometapi", "python"].join("-")}/README.md`;
      writeFileSync(
        join(root, "notes.md"),
        `See ${privateArtifact}, ${privateReference}, and ${siblingWorkspace}.\n`,
      );

      const violations = collectStandaloneContentViolations(root);
      expect(violations).toHaveLength(3);
      expect(
        violations.filter((violation) =>
          violation.includes("private material"),
        ),
      ).toHaveLength(2);
      expect(violations.join("\n")).toMatch(/sibling repository/);
    });
  });

  it("ignores generated and dependency directories", () => {
    withTemporaryDirectory((root) => {
      const dependencyDirectory = join(root, "node_modules", "fixture");
      mkdirSync(dependencyDirectory, { recursive: true });
      const absoluteReference = ["", "Users", "example", "secret"].join("/");
      writeFileSync(join(dependencyDirectory, "README.md"), absoluteReference);

      expect(collectStandaloneContentViolations(root)).toEqual([]);
    });
  });

  it("aggregates content and standalone violations in one Public Preview run", () => {
    withTemporaryDirectory((parent) => {
      const root = join(parent, "repository");
      cpSync(ROOT, root, {
        filter: (source) =>
          !STANDALONE_CONTENT_EXCLUSIONS.has(basename(source)),
        recursive: true,
      });

      const manifestPath = join(root, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.author = "Different Author";
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const absoluteReference = ["", "Users", "example", "notes.md"].join("/");
      writeFileSync(join(root, "outside.md"), `${absoluteReference}\n`);

      const violations = collectPublicPreviewGateViolations(root);
      expect(violations.join("\n")).toMatch(/package\.json author/);
      expect(violations.join("\n")).toMatch(
        /outside\.md: absolute machine-local path/,
      );
    });
  });

  it("scans a historical tree after its outside-root reference is deleted", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      const path = join(root, "removed.md");
      writeFileSync(path, "See ../private/plan.md.\n");
      commitAll(root, "add outside-root reference");
      const leakingCommit = git(root, "rev-parse", "HEAD");
      const leakingTree = git(root, "rev-parse", "HEAD^{tree}");
      rmSync(path);
      commitAll(root, "remove outside-root reference");

      expect(collectStandaloneHistoryViolations(root)).toEqual([
        expect.stringContaining(
          `commit=${leakingCommit} tree=${leakingTree}: removed.md: parent-relative path escapes`,
        ),
      ]);
    });
  });

  it("scans a historical tree after its private workspace path is deleted", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      const path = join(root, "removed.md");
      const siblingWorkspace = `${["cometapi", "python"].join("-")}/README.md`;
      writeFileSync(path, `See ${siblingWorkspace}.\n`);
      commitAll(root, "add sibling workspace reference");
      const leakingCommit = git(root, "rev-parse", "HEAD");
      const leakingTree = git(root, "rev-parse", "HEAD^{tree}");
      rmSync(path);
      commitAll(root, "remove sibling workspace reference");

      expect(collectStandaloneHistoryViolations(root)).toEqual([
        expect.stringContaining(
          `commit=${leakingCommit} tree=${leakingTree}: removed.md: references a private workspace or sibling repository`,
        ),
      ]);
    });
  });

  it("materializes exact trees without honoring export-ignore attributes", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      writeFileSync(join(root, ".gitattributes"), "hidden.md export-ignore\n");
      writeFileSync(join(root, "hidden.md"), "See ../private/plan.md.\n");
      commitAll(root, "add ignored outside-root reference");

      expect(collectStandaloneHistoryViolations(root).join("\n")).toMatch(
        /hidden\.md: parent-relative path escapes/,
      );
    });
  });

  it.each([
    ["case-folded", "A.md", "a.md"],
    [
      "Unicode-normalized",
      ["caf", "e\u0301.md"].join(""),
      ["caf", "\u00e9.md"].join(""),
    ],
  ])("rejects %s historical path collisions", (_name, unsafePath, safePath) => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      const outsideReference = ["..", "private", "plan.md"].join("/");
      const unsafeBlob = gitWithInput(
        root,
        `See ${outsideReference}.\n`,
        "hash-object",
        "-w",
        "--stdin",
      );
      const safeBlob = gitWithInput(
        root,
        "safe\n",
        "hash-object",
        "-w",
        "--stdin",
      );
      const entries = [
        { objectId: unsafeBlob, path: unsafePath },
        { objectId: safeBlob, path: safePath },
      ].sort((left, right) =>
        Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)),
      );
      const tree = gitWithInput(
        root,
        entries
          .map(({ objectId, path }) => `100644 blob ${objectId}\t${path}\n`)
          .join(""),
        "mktree",
      );
      const commit = git(root, "commit-tree", tree, "-m", "collision fixture");
      git(root, "update-ref", "refs/heads/main", commit);

      expect(() => collectStandaloneHistoryViolations(root)).toThrow(
        /filesystem-equivalent paths/,
      );
    });
  });

  it("includes unmerged ref trees and the detached HEAD tree once each", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      writeFileSync(join(root, "README.md"), "main\n");
      commitAll(root, "main tree");
      const mainCommit = git(root, "rev-parse", "HEAD");
      const mainTree = git(root, "rev-parse", "HEAD^{tree}");

      writeFileSync(join(root, "README.md"), "detached\n");
      git(root, "add", "README.md");
      const detachedTree = git(root, "write-tree");
      const detachedCommit = git(
        root,
        "commit-tree",
        detachedTree,
        "-p",
        mainCommit,
        "-m",
        "detached tree",
      );
      git(root, "checkout", "--detach", detachedCommit);

      git(root, "checkout", "main");
      writeFileSync(join(root, "README.md"), "side\n");
      commitAll(root, "side tree");
      const sideCommit = git(root, "rev-parse", "HEAD");
      const sideTree = git(root, "rev-parse", "HEAD^{tree}");
      git(root, "branch", "side", sideCommit);
      git(root, "reset", "--hard", mainCommit);
      git(root, "checkout", "--detach", detachedCommit);

      const trees = reachableStandaloneTrees(root);
      expect([...trees.keys()]).toEqual(
        expect.arrayContaining([mainTree, sideTree, detachedTree]),
      );
      expect([...trees.keys()].filter((tree) => tree === detachedTree)).toEqual(
        [detachedTree],
      );
    });
  });

  it("does not let replacement objects hide a historical violation", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      writeFileSync(join(root, "notes.md"), "See ../private/plan.md.\n");
      commitAll(root, "add outside-root reference");
      const originalCommit = git(root, "rev-parse", "HEAD");
      const originalTree = git(root, "rev-parse", "HEAD^{tree}");

      writeFileSync(join(root, "notes.md"), "safe\n");
      git(root, "add", "notes.md");
      const safeTree = git(root, "write-tree");
      const safeCommit = git(
        root,
        "commit-tree",
        safeTree,
        "-m",
        "safe replacement",
      );
      git(root, "replace", originalCommit, safeCommit);

      expect(collectStandaloneHistoryViolations(root)).toEqual([
        expect.stringContaining(
          `commit=${originalCommit} tree=${originalTree}: notes.md: parent-relative path escapes`,
        ),
      ]);
      expect(git(root, "rev-parse", "HEAD^{tree}")).toBe(safeTree);
    });
  });

  it("rejects shallow Git history", () => {
    withTemporaryDirectory((parent) => {
      const source = join(parent, "source");
      const shallow = join(parent, "shallow");
      mkdirSync(source);
      initializeRepository(source);
      writeFileSync(join(source, "README.md"), "safe\n");
      commitAll(source, "first");
      writeFileSync(join(source, "README.md"), "still safe\n");
      commitAll(source, "second");
      execFileSync("git", ["clone", "--depth=1", `file://${source}`, shallow], {
        stdio: "pipe",
      });

      expect(() => collectStandaloneHistoryViolations(shallow)).toThrow(
        /complete Git history; shallow repositories are rejected/,
      );
    });
  });

  it("uses file-only mode for the isolated self-containment copy", () => {
    withTemporaryDirectory((root) => {
      const outsideReference = ["..", "private", "plan.md"].join("/");
      writeFileSync(join(root, "notes.md"), `See ${outsideReference}.\n`);

      expect(contentScanMode({ COMETAPI_SELF_CONTAINMENT: "1" })).toBe("files");
      expect(collectStandaloneGateViolations(root, { mode: "files" })).toEqual([
        expect.stringMatching(/parent-relative path escapes/),
      ]);
      expect(existsSync(join(root, ".git"))).toBe(false);
    });
  });

  it("runs the command in isolated mode without requiring Git metadata", () => {
    withTemporaryDirectory((root) => {
      const script = new URL(
        "../scripts/check-standalone-content.mjs",
        import.meta.url,
      );
      writeFileSync(join(root, "README.md"), "standalone safe content\n");
      const result = spawnSync(process.execPath, [script.pathname], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, COMETAPI_SELF_CONTAINMENT: "1" },
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/isolated tracked copy/);
    });
  });
});
