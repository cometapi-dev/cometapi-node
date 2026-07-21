import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import { collectStandaloneContentViolations } from "../scripts/standalone-content.mjs";

function withTemporaryDirectory(callback) {
  const directory = mkdtempSync(join(tmpdir(), "cometapi-content-test-"));
  try {
    return callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
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

  it("ignores generated and dependency directories", () => {
    withTemporaryDirectory((root) => {
      const dependencyDirectory = join(root, "node_modules", "fixture");
      mkdirSync(dependencyDirectory, { recursive: true });
      const absoluteReference = ["", "Users", "example", "secret"].join("/");
      writeFileSync(join(dependencyDirectory, "README.md"), absoluteReference);

      expect(collectStandaloneContentViolations(root)).toEqual([]);
    });
  });

  it("is included in the Public Preview aggregate gate", () => {
    const gate = readFileSync(
      new URL("../scripts/check-public-preview.mjs", import.meta.url),
      "utf8",
    );
    expect(gate).toContain("collectStandaloneContentViolations(ROOT)");
    expect(gate).toContain("...standaloneContentViolations");
  });
});
