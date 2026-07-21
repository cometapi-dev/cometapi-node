import assert from "node:assert/strict";
import { cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  ROOT,
  makeTemporaryDirectory,
  packCandidate,
  readJSON,
  removeTemporaryDirectory,
  run,
} from "./lib.mjs";

const argumentIndex = process.argv.indexOf("--lane");
const requestedLane =
  argumentIndex === -1 ? undefined : process.argv[argumentIndex + 1];
const allowedLanes = ["minimum", "locked", "latest"];

if (requestedLane && !allowedLanes.includes(requestedLane)) {
  throw new Error(`Unknown compatibility lane: ${requestedLane}`);
}

const lock = readJSON(join(ROOT, "package-lock.json"));
const lockedVersion = lock.packages["node_modules/openai"]?.version;
assert.ok(
  lockedVersion,
  "package-lock.json must contain the locked OpenAI version",
);

const specifications = {
  minimum: "6.47.0",
  locked: lockedVersion,
  latest: "^6.47.0",
};
const lanes = requestedLane ? [requestedLane] : allowedLanes;
const temporaryDirectory = makeTemporaryDirectory("cometapi-compat-");

try {
  const packageDirectory = join(temporaryDirectory, "package");
  const { tarball } = packCandidate(packageDirectory);

  for (const lane of lanes) {
    const fixtureDirectory = join(temporaryDirectory, lane);
    cpSync(join(ROOT, "fixtures", "openai-host"), fixtureDirectory, {
      recursive: true,
    });
    const manifestPath = join(fixtureDirectory, "package.json");
    const manifest = readJSON(manifestPath);
    manifest.dependencies = {
      cometapi: `file:${tarball}`,
      openai: specifications[lane],
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: fixtureDirectory,
    });
    const dependencyTree = JSON.parse(
      run("npm", ["ls", "openai", "--all", "--json"], {
        capture: true,
        cwd: fixtureDirectory,
      }),
    );
    const installedVersion = dependencyTree.dependencies?.openai?.version;
    assert.ok(installedVersion, "npm ls must report the host OpenAI version");
    const dependencyPaths = run(
      "npm",
      ["ls", "openai", "--all", "--parseable"],
      { capture: true, cwd: fixtureDirectory },
    )
      .trim()
      .split("\n")
      .filter((path) => path.endsWith("node_modules/openai"));

    assert.equal(dependencyPaths.length, 1);
    if (lane === "minimum") assert.equal(installedVersion, "6.47.0");
    if (lane === "locked") assert.equal(installedVersion, lockedVersion);
    if (lane === "latest") assert.equal(installedVersion.split(".")[0], "6");

    run("npm", ["test"], { cwd: fixtureDirectory });
    console.log(`${lane}: verified OpenAI ${installedVersion}`);
  }
} finally {
  removeTemporaryDirectory(temporaryDirectory);
}
