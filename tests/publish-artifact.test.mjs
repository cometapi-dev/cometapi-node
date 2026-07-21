import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("../scripts/publish-artifact.sh", import.meta.url),
);
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cometapi-publish-test-"));
  temporaryDirectories.push(root);
  const artifacts = join(root, "artifacts");
  const bin = join(root, "bin");
  const log = join(root, "npm-call.log");
  mkdirSync(artifacts);
  mkdirSync(bin);
  writeFileSync(join(artifacts, "cometapi.tgz"), "artifact\n");
  const npm = join(bin, "npm");
  writeFileSync(
    npm,
    [
      "#!/usr/bin/env bash",
      'if [[ "$1" == "view" ]]; then',
      '  echo "npm error code E404" >&2',
      "  exit 1",
      "fi",
      'if [[ "$1" == "publish" ]]; then',
      '  printf "%s\\n" "${NODE_AUTH_TOKEN:+token-present}" > "$NPM_CALL_LOG"',
      '  printf "%s\\n" "$*" >> "$NPM_CALL_LOG"',
      "  exit 0",
      "fi",
      'echo "unexpected npm command: $*" >&2',
      "exit 2",
      "",
    ].join("\n"),
  );
  chmodSync(npm, 0o755);
  return { artifacts, bin, log };
}

function runPublish({
  bootstrapEnabled = "",
  distTag = "next",
  token = "",
  version = "0.1.0-alpha.1",
} = {}) {
  const { artifacts, bin, log } = fixture();
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      ALPHA1_BOOTSTRAP_ENABLED: bootstrapEnabled,
      ARTIFACT_DIRECTORY: artifacts,
      DIST_TAG: distTag,
      NODE_AUTH_TOKEN: token,
      NPM_CALL_LOG: log,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      VERSION: version,
    },
  });
  return {
    log: existsSync(log) ? readFileSync(log, "utf8") : "",
    result,
  };
}

describe("publish artifact authentication", () => {
  it("uses Trusted Publishing without injecting a registry token by default", () => {
    const { log, result } = runPublish({ version: "0.1.0-alpha.2" });
    expect(result.status, result.stderr).toBe(0);
    expect(log).toMatch(/^\npublish .* --provenance --tag next\n$/);
  });

  it("allows the protected token bootstrap for alpha.1 on next", () => {
    const { log, result } = runPublish({
      bootstrapEnabled: "true",
      token: "opaque",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(log).toMatch(
      /^token-present\npublish .* --provenance --tag next\n$/,
    );
  });

  it.each([
    ["another version", { bootstrapEnabled: "true", version: "0.1.0-alpha.2" }],
    ["another dist-tag", { bootstrapEnabled: "true", distTag: "latest" }],
    ["a missing token", { bootstrapEnabled: "true" }],
  ])("rejects bootstrap mode for %s", (_name, options) => {
    const { log, result } = runPublish(options);
    expect(result.status).not.toBe(0);
    expect(log).toBe("");
  });
});
