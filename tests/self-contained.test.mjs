import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { materializeTrackedCandidate } from "../scripts/check-self-contained.mjs";

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
}

function withRepository(callback) {
  const parent = mkdtempSync(join(tmpdir(), "cometapi-self-contained-test-"));
  const root = join(parent, "repository");
  mkdirSync(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.email", "tests@example.invalid");
  git(root, "config", "user.name", "CometAPI tests");
  writeFileSync(join(root, "tracked.txt"), "committed\n");
  git(root, "add", "tracked.txt");
  git(root, "commit", "-m", "test fixture");

  try {
    callback({ parent, root });
  } finally {
    rmSync(parent, { force: true, recursive: true });
  }
}

describe("self-contained candidate materialization", () => {
  it("copies the exact committed tree and excludes untracked files", () => {
    withRepository(({ parent, root }) => {
      writeFileSync(join(root, "untracked.txt"), "local only\n");
      const candidate = materializeTrackedCandidate(
        root,
        join(parent, "candidate-parent"),
      );

      expect(readFileSync(join(candidate, "tracked.txt"), "utf8")).toBe(
        "committed\n",
      );
      expect(existsSync(join(candidate, "untracked.txt"))).toBe(false);
      expect(existsSync(join(candidate, ".git"))).toBe(false);
    });
  });

  it("fails closed when a tracked file differs from HEAD", () => {
    withRepository(({ parent, root }) => {
      writeFileSync(join(root, "tracked.txt"), "modified\n");
      expect(() =>
        materializeTrackedCandidate(root, join(parent, "candidate-parent")),
      ).toThrow(/clean tracked worktree/);
    });
  });

  it("includes tracked files marked export-ignore", () => {
    withRepository(({ parent, root }) => {
      writeFileSync(
        join(root, ".gitattributes"),
        "omitted.txt export-ignore\n",
      );
      writeFileSync(join(root, "omitted.txt"), "tracked despite attribute\n");
      git(root, "add", ".gitattributes", "omitted.txt");
      git(root, "commit", "-m", "add export-ignored fixture");

      const candidate = materializeTrackedCandidate(
        root,
        join(parent, "candidate-parent"),
      );

      expect(readFileSync(join(candidate, "omitted.txt"), "utf8")).toBe(
        "tracked despite attribute\n",
      );
    });
  });

  it("materializes committed blob bytes without applying smudge filters", () => {
    withRepository(({ parent, root }) => {
      git(root, "config", "filter.mutate.clean", "cat");
      git(
        root,
        "config",
        "filter.mutate.smudge",
        "sed s/committed/transformed/g",
      );
      writeFileSync(
        join(root, ".gitattributes"),
        "tracked.txt filter=mutate\n",
      );
      git(root, "add", ".gitattributes");
      git(root, "commit", "-m", "add checkout filter fixture");

      const candidate = materializeTrackedCandidate(
        root,
        join(parent, "candidate-parent"),
      );

      expect(readFileSync(join(candidate, "tracked.txt"), "utf8")).toBe(
        "committed\n",
      );
    });
  });

  it("ignores replacement objects when reading HEAD", () => {
    withRepository(({ parent, root }) => {
      const originalCommit = git(root, "rev-parse", "HEAD");
      writeFileSync(join(root, "tracked.txt"), "replacement\n");
      git(root, "add", "tracked.txt");
      const replacementTree = git(root, "write-tree");
      const replacementCommit = git(
        root,
        "commit-tree",
        replacementTree,
        "-m",
        "replacement fixture",
      );
      git(root, "reset", "--hard", originalCommit);
      git(root, "replace", originalCommit, replacementCommit);

      const candidate = materializeTrackedCandidate(
        root,
        join(parent, "candidate-parent"),
      );

      expect(readFileSync(join(candidate, "tracked.txt"), "utf8")).toBe(
        "committed\n",
      );
    });
  });
});
