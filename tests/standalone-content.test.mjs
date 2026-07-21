import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { describe, expect, it } from "vitest";

import { collectPublicPreviewGateViolations } from "../scripts/check-public-preview.mjs";
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
});
