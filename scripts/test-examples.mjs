import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  ROOT,
  makeTemporaryDirectory,
  packCandidate,
  readJSON,
  removeTemporaryDirectory,
  run,
} from "./lib.mjs";
import { collectReadmeExampleViolations } from "./example-validation.mjs";

let supplied;
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument !== "--tarball") {
    throw new Error(`Unknown example-test argument: ${String(argument)}`);
  }
  if (supplied !== undefined) {
    throw new Error("--tarball may be supplied only once.");
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("--tarball requires a path.");
  }
  supplied = value;
  index += 1;
}
const suppliedTarball = supplied ? resolve(ROOT, supplied) : undefined;
if (suppliedTarball && !existsSync(suppliedTarball)) {
  throw new Error(`Packed artifact not found: ${suppliedTarball}`);
}

const violations = collectReadmeExampleViolations({
  readme: readFileSync(join(ROOT, "README.md"), "utf8"),
  esm: readFileSync(join(ROOT, "examples/esm.mjs"), "utf8"),
  commonjs: readFileSync(join(ROOT, "examples/commonjs.cjs"), "utf8"),
});
if (violations.length > 0) throw new Error(violations.join("\n"));

const temporaryDirectory = makeTemporaryDirectory("cometapi-examples-");
try {
  const tarball =
    suppliedTarball ??
    packCandidate(join(temporaryDirectory, "package")).tarball;
  const consumer = join(temporaryDirectory, "consumer");
  mkdirSync(consumer);
  cpSync(join(ROOT, "examples"), join(consumer, "examples"), {
    recursive: true,
  });
  cpSync(
    join(ROOT, "scripts/fixtures/mock-example-fetch.cjs"),
    join(consumer, "mock-example-fetch.cjs"),
  );
  const lockedOpenAI = readJSON(join(ROOT, "package-lock.json")).packages[
    "node_modules/openai"
  ]?.version;
  assert.ok(lockedOpenAI, "package-lock.json must lock OpenAI.");
  run("npm", ["init", "--yes"], { cwd: consumer, capture: true });
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarball,
      `openai@${lockedOpenAI}`,
    ],
    { cwd: consumer },
  );

  const dependencyPaths = run("npm", ["ls", "openai", "--all", "--parseable"], {
    capture: true,
    cwd: consumer,
  })
    .trim()
    .split("\n")
    .filter((path) => path.endsWith("node_modules/openai"));
  assert.equal(
    dependencyPaths.length,
    1,
    "Examples must resolve one OpenAI installation.",
  );
  assert.equal(
    existsSync(join(consumer, "node_modules/cometapi/node_modules/openai")),
    false,
    "The example consumer must deduplicate OpenAI.",
  );

  for (const [mode, filename, expectedOutput] of [
    [
      "esm",
      "esm.mjs",
      "Sunlight scatters in the atmosphere, making blue wavelengths dominate the daytime sky.\nComets shine.\n",
    ],
    [
      "commonjs",
      "commonjs.cjs",
      "Hello from CometAPI!\ngpt-5.6-sol\nclaude-sonnet-4-6\n",
    ],
  ]) {
    const output = run(
      process.execPath,
      [
        "--require",
        join(consumer, "mock-example-fetch.cjs"),
        join(consumer, "examples", filename),
      ],
      {
        capture: true,
        cwd: consumer,
        env: {
          COMETAPI_BASE_URL: "https://example.invalid/v1",
          COMETAPI_EXAMPLE_MODE: mode,
          COMETAPI_KEY: "mock-example-key",
          PATH: process.env.PATH ?? "",
        },
        replaceEnv: true,
      },
    );
    assert.equal(
      output,
      expectedOutput,
      `${filename} produced unexpected output.`,
    );
    console.log(`Verified ${filename} with ${basename(tarball)}.`);
  }
} finally {
  removeTemporaryDirectory(temporaryDirectory);
}
