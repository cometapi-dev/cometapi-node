import assert from "node:assert/strict";
import { cpSync, existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  ROOT,
  makeTemporaryDirectory,
  packCandidate,
  readJSON,
  removeTemporaryDirectory,
  run,
} from "./lib.mjs";

const temporaryDirectory = makeTemporaryDirectory("cometapi-fixtures-");
const tarballArgument = process.argv.indexOf("--tarball");
const suppliedTarball =
  tarballArgument === -1 ? undefined : process.argv[tarballArgument + 1];

if (tarballArgument !== -1 && !suppliedTarball) {
  throw new Error("--tarball requires the path to an existing packed artifact");
}

const lock = readJSON(join(ROOT, "package-lock.json"));
const lockedOpenAIVersion = lock.packages["node_modules/openai"]?.version;
assert.ok(lockedOpenAIVersion, "package-lock.json must lock OpenAI");
for (const fixture of ["esm", "commonjs", "openai-host"]) {
  const manifest = readJSON(join(ROOT, "fixtures", fixture, "package.json"));
  assert.equal(
    manifest.dependencies?.openai,
    lockedOpenAIVersion,
    `${fixture} must pin the locked OpenAI version`,
  );
}

try {
  const tarball =
    (suppliedTarball ? resolve(ROOT, suppliedTarball) : undefined) ??
    packCandidate(join(temporaryDirectory, "package")).tarball;

  for (const fixture of ["esm", "commonjs", "openai-host"]) {
    const fixtureDirectory = join(temporaryDirectory, fixture);
    cpSync(join(ROOT, "fixtures", fixture), fixtureDirectory, {
      recursive: true,
    });
    run(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
      { cwd: fixtureDirectory },
    );

    if (fixture === "openai-host") {
      const nestedOpenAI = join(
        fixtureDirectory,
        "node_modules",
        "cometapi",
        "node_modules",
        "openai",
      );
      assert.equal(
        existsSync(nestedOpenAI),
        false,
        "the packed SDK must deduplicate the host's compatible OpenAI dependency",
      );
      const dependencyPaths = run(
        "npm",
        ["ls", "openai", "--all", "--parseable"],
        { capture: true, cwd: fixtureDirectory },
      )
        .trim()
        .split("\n")
        .filter((path) => path.endsWith("node_modules/openai"));
      assert.equal(dependencyPaths.length, 1);
    }

    run("npm", ["test"], { cwd: fixtureDirectory });
    console.log(`Verified ${fixture} fixture with ${basename(tarball)}.`);
  }
} finally {
  removeTemporaryDirectory(temporaryDirectory);
}
