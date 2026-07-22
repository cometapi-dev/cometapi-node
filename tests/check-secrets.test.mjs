import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

import {
  checkSecrets,
  collectSecretViolations,
  formatSecretViolations,
} from "../scripts/check-secrets.mjs";

function withTemporaryDirectory(callback) {
  const directory = mkdtempSync(join(tmpdir(), "cometapi-secret-test-"));
  try {
    return callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function initializeRepository(root) {
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.name", "Secret Gate Test"]);
  git(root, ["config", "user.email", "secret-gate@example.com"]);
}

function commitAll(root, message) {
  git(root, ["add", "--all"]);
  git(root, ["commit", "--message", message]);
}

const openAISecret = () => ["sk", "a".repeat(24)].join("-");
const npmSecret = () => ["npm", "b".repeat(24)].join("_");
const authTokenAssignment = () =>
  ["//registry.example/:_authToken", "literal-token-value"].join(" = ");

describe("secret-pattern scan", () => {
  it("scans tracked shell, extensionless, environment, and link content", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      writeFileSync(join(root, "deploy.sh"), "echo safe\n");
      writeFileSync(join(root, "Dockerfile"), "FROM scratch\n");
      writeFileSync(join(root, ".env"), "SAFE=true\n");
      symlinkSync("Dockerfile", join(root, "credential-link"));
      commitAll(root, "add safe fixtures");

      writeFileSync(join(root, "deploy.sh"), `${openAISecret()}\n`);
      writeFileSync(join(root, "Dockerfile"), `${npmSecret()}\n`);
      writeFileSync(join(root, ".env"), `${authTokenAssignment()}\n`);
      rmSync(join(root, "credential-link"));
      symlinkSync(openAISecret(), join(root, "credential-link"));

      const violations = collectSecretViolations(root);
      const currentPaths = violations
        .filter(({ path }) => path !== undefined)
        .map(({ path }) => path);

      expect(currentPaths).toEqual(
        expect.arrayContaining([
          ".env",
          "Dockerfile",
          "credential-link",
          "deploy.sh",
        ]),
      );
    });
  });

  it("finds a secret that was deleted from the current tree", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      const path = join(root, "removed.sh");
      writeFileSync(
        path,
        Buffer.concat([Buffer.from([0xff]), Buffer.from(openAISecret())]),
      );
      commitAll(root, "add credential");
      const leakedBlob = git(root, ["rev-parse", "HEAD:removed.sh"]);
      rmSync(path);
      commitAll(root, "remove credential");

      const violations = collectSecretViolations(root);
      expect(violations).toContainEqual({
        blob: leakedBlob,
        rule: "openai-style-key",
      });
      expect(
        violations.some(({ path: candidate }) => candidate === "removed.sh"),
      ).toBe(false);
    });
  });

  it("finds a secret in a reachable commit message without printing it", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      const secret = openAISecret();
      writeFileSync(join(root, "README"), "safe\n");
      commitAll(root, `record ${secret}`);
      const commit = git(root, ["rev-parse", "HEAD"]);

      const violations = collectSecretViolations(root);
      const output = formatSecretViolations(violations);
      expect(violations).toContainEqual({
        commit,
        rule: "openai-style-key",
      });
      expect(output).toContain(`commit=${commit}`);
      expect(output).not.toContain(secret);
      expect(() => checkSecrets(root)).toThrowError(
        expect.not.stringContaining(secret),
      );
    });
  });

  it("finds a secret in a reachable annotated tag message without printing it", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      const secret = npmSecret();
      writeFileSync(join(root, "README"), "safe\n");
      commitAll(root, "add safe fixture");
      git(root, ["tag", "--annotate", "credential-test", "--message", secret]);
      const tag = git(root, ["rev-parse", "refs/tags/credential-test"]);

      const violations = collectSecretViolations(root);
      const output = formatSecretViolations(violations);
      expect(violations).toContainEqual({
        tag,
        rule: "npm-access-token",
      });
      expect(output).toContain(`tag=${tag}`);
      expect(output).not.toContain(secret);
      expect(() => checkSecrets(root)).toThrowError(
        expect.not.stringContaining(secret),
      );
    });
  });

  it("finds a secret in a deleted historical path without printing it", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      const secret = npmSecret();
      const unsafePath = `history/${secret}.txt`;
      mkdirSync(join(root, "history"));
      writeFileSync(join(root, unsafePath), "safe\n");
      commitAll(root, "add historical fixture");
      rmSync(join(root, unsafePath));
      commitAll(root, "remove historical fixture");
      const pathHash = createHash("sha256")
        .update(Buffer.from(unsafePath, "utf8"))
        .digest("hex");

      const violations = collectSecretViolations(root);
      const output = formatSecretViolations(violations);
      expect(violations).toContainEqual({
        pathHash,
        rule: "npm-access-token",
      });
      expect(output).toContain(`path-sha256=${pathHash}`);
      expect(output).not.toContain(secret);
      expect(output).not.toContain(unsafePath);
      expect(() => checkSecrets(root)).toThrowError(
        expect.not.stringContaining(secret),
      );
    });
  });

  it("does not let replacement objects hide the original history", () => {
    withTemporaryDirectory((root) => {
      initializeRepository(root);
      writeFileSync(join(root, "credential.txt"), `${openAISecret()}\n`);
      commitAll(root, "add credential");
      const originalCommit = git(root, ["rev-parse", "HEAD"]);
      const originalBlob = git(root, ["rev-parse", "HEAD:credential.txt"]);

      writeFileSync(join(root, "credential.txt"), "safe\n");
      git(root, ["add", "credential.txt"]);
      const safeTree = git(root, ["write-tree"]);
      const replacementCommit = git(root, [
        "commit-tree",
        safeTree,
        "-m",
        "safe replacement",
      ]);
      git(root, ["replace", originalCommit, replacementCommit]);

      expect(collectSecretViolations(root)).toContainEqual({
        blob: originalBlob,
        rule: "openai-style-key",
      });
    });
  });

  it("reports rules and locations without exposing matched values", () => {
    withTemporaryDirectory((root) => {
      const secret = openAISecret();
      writeFileSync(join(root, ".env"), `${secret}\n`);

      const violations = collectSecretViolations(root, { mode: "files" });
      const output = formatSecretViolations(violations);
      expect(output).toContain("rule=openai-style-key");
      expect(output).toContain('path=".env"');
      expect(output).not.toContain(secret);
      expect(() => checkSecrets(root, { mode: "files" })).toThrowError(
        expect.not.stringContaining(secret),
      );
    });
  });

  it("scans credential-like path names without printing them", () => {
    withTemporaryDirectory((root) => {
      const secret = npmSecret();
      const unsafePath = `${secret}.txt`;
      writeFileSync(join(root, unsafePath), "safe\n");

      const violations = collectSecretViolations(root, { mode: "files" });
      const output = formatSecretViolations(violations);
      expect(violations).toEqual([
        {
          pathHash: expect.stringMatching(/^[0-9a-f]{64}$/),
          rule: "npm-access-token",
        },
      ]);
      expect(output).toContain("path-sha256=");
      expect(output).not.toContain(secret);
      expect(output).not.toContain(unsafePath);
    });
  });

  it("fails closed for shallow repositories", () => {
    withTemporaryDirectory((parent) => {
      const source = join(parent, "source");
      const shallow = join(parent, "shallow");
      mkdirSync(source);
      initializeRepository(source);
      writeFileSync(join(source, "README"), "first\n");
      commitAll(source, "first");
      writeFileSync(join(source, "README"), "second\n");
      commitAll(source, "second");
      git(parent, ["clone", "--depth=1", `file://${source}`, shallow]);

      expect(() => collectSecretViolations(shallow)).toThrow(/shallow/i);
    });
  });

  it("requires Git by default and supports explicit copied-file mode", () => {
    withTemporaryDirectory((root) => {
      writeFileSync(join(root, "release.env"), `${npmSecret()}\n`);

      expect(() => collectSecretViolations(root)).toThrow(
        /requires a Git repository/,
      );
      expect(collectSecretViolations(root, { mode: "files" })).toEqual([
        {
          path: "release.env",
          rule: "npm-access-token",
        },
      ]);
    });
  });

  it("fetches full CI history only where the complete scan runs", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    );
    const locked = workflow.slice(
      workflow.indexOf("  locked:\n"),
      workflow.indexOf("  minimum-openai:\n"),
    );

    expect(workflow.match(/fetch-depth: 0/g)).toHaveLength(1);
    expect(locked).toContain("fetch-depth: 0");
    expect(locked).toContain("run: npm run test:secrets");
  });
});
