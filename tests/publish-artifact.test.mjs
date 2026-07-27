import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
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
  return { artifacts, bin, log, root };
}

function runPublish({
  distTag = "next",
  nodeAuthToken = "",
  npmToken = "",
  version = "0.1.0-alpha.2",
} = {}) {
  const { bin, log, root } = fixture();
  const result = spawnSync("bash", [script], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      ARTIFACT_DIRECTORY: "artifacts",
      DIST_TAG: distTag,
      NODE_AUTH_TOKEN: nodeAuthToken,
      NPM_CALL_LOG: log,
      NPM_TOKEN: npmToken,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      VERSION: version,
    },
  });
  return {
    log: existsSync(log) ? readFileSync(log, "utf8") : "",
    result,
    root,
  };
}

describe("publish artifact authentication", () => {
  it("uses Trusted Publishing with the absolute artifact path", () => {
    const { log, result, root } = runPublish();
    expect(result.status, result.stderr).toBe(0);
    expect(log).toMatch(/^\npublish .* --provenance --tag next\n$/);
    expect(log).toContain(
      `publish ${join(realpathSync(root), "artifacts", "cometapi.tgz")} --access public --provenance --tag next`,
    );
  });

  it.each([
    ["NODE_AUTH_TOKEN", { nodeAuthToken: "opaque" }],
    ["NPM_TOKEN", { npmToken: "opaque" }],
  ])("rejects the %s registry credential", (_name, options) => {
    const { log, result } = runPublish(options);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "publication must use npm Trusted Publishing",
    );
    expect(log).toBe("");
  });
});
