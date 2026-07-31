import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  ROOT,
  makeTemporaryDirectory,
  packCandidate,
  readJSON,
  removeTemporaryDirectory,
  run,
} from "./lib.mjs";
import {
  validatePublicationNeutralReadme,
  validateReleaseMetadata,
} from "./release-validation.mjs";

const CANONICAL_AUTHOR = "CometAPI";
const CANONICAL_BUGS = {
  url: "https://github.com/cometapi-dev/cometapi-node/issues",
};
const CANONICAL_HOMEPAGE = "https://www.cometapi.com";
const CANONICAL_REPOSITORY = {
  type: "git",
  url: "git+https://github.com/cometapi-dev/cometapi-node.git",
};

function assertCanonicalIdentity(packageManifest, label) {
  assert.equal(
    packageManifest.author,
    CANONICAL_AUTHOR,
    `${label} author must match the canonical identity`,
  );
  assert.equal(
    packageManifest.homepage,
    CANONICAL_HOMEPAGE,
    `${label} homepage must match the canonical identity`,
  );
  assert.deepEqual(
    packageManifest.repository,
    CANONICAL_REPOSITORY,
    `${label} repository must match the canonical identity`,
  );
  assert.deepEqual(
    packageManifest.bugs,
    CANONICAL_BUGS,
    `${label} bugs metadata must match the canonical identity`,
  );
}

const tarballArgument = process.argv.indexOf("--tarball");
const suppliedTarball =
  tarballArgument === -1 ? undefined : process.argv[tarballArgument + 1];
if (tarballArgument !== -1 && !suppliedTarball) {
  throw new Error("--tarball requires the path to an existing packed artifact");
}
const tarball = suppliedTarball ? resolve(ROOT, suppliedTarball) : undefined;
if (tarball && !existsSync(tarball)) {
  throw new Error(`Packed artifact not found: ${tarball}`);
}
const tagArgument = process.argv.indexOf("--tag");
const suppliedTag =
  tagArgument === -1 ? undefined : process.argv[tagArgument + 1];
if (tagArgument !== -1 && !suppliedTag) {
  throw new Error("--tag requires a release tag");
}

const manifest = readJSON(join(ROOT, "package.json"));
const packageLock = readJSON(join(ROOT, "package-lock.json"));
const releaseManifest = readJSON(join(ROOT, ".release-please-manifest.json"));
const releaseConfig = readJSON(join(ROOT, "release-please-config.json"));
const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
const sourceReadme = readFileSync(join(ROOT, "README.md"), "utf8");
const releaseMetadata = validateReleaseMetadata({
  changelog,
  packageLock,
  releaseConfig,
  releaseManifest,
  sourceManifest: manifest,
  tag: suppliedTag,
});

assert.equal(manifest.name, "cometapi");
assert.equal(manifest.dependencies.openai, "^6.47.0");
assert.equal(manifest.publishConfig.access, "public");
assert.equal(manifest.publishConfig.provenance, true);
assert.equal(manifest.license, "MIT");
assert.equal(manifest.sideEffects, false);
assert.equal(manifest.exports["."].import.default, "./dist/index.js");
assert.equal(manifest.exports["."].import.types, "./dist/index.d.ts");
assert.equal(manifest.exports["."].require.default, "./dist/index.cjs");
assert.equal(manifest.exports["."].require.types, "./dist/index.d.cts");
assertCanonicalIdentity(manifest, "package.json");

for (const field of [
  "description",
  "files",
  "homepage",
  "keywords",
  "publishConfig",
]) {
  assert.ok(manifest[field], `package.json must define ${field}`);
}

const expected = [
  "LICENSE",
  "README.md",
  "dist/index.cjs",
  "dist/index.d.cts",
  "dist/index.d.ts",
  "dist/index.js",
  "package.json",
];
const temporaryDirectory = makeTemporaryDirectory("cometapi-package-");

try {
  let packageDirectory = ROOT;
  let filename;
  let size;
  let paths;
  let validatedTarball = tarball;

  if (tarball) {
    run("tar", ["-xzf", tarball, "-C", temporaryDirectory]);
    packageDirectory = join(temporaryDirectory, "package");
    filename = basename(tarball);
    size = statSync(tarball).size;
    paths = run("tar", ["-tzf", tarball], { capture: true })
      .trim()
      .split("\n")
      .filter((path) => path.startsWith("package/") && !path.endsWith("/"))
      .map((path) => path.slice("package/".length))
      .sort();
  } else {
    run("npm", ["run", "build"]);
    const dryRun = JSON.parse(
      run("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
        capture: true,
      }),
    )[0];
    assert.deepEqual(dryRun.files.map((file) => file.path).sort(), expected);

    const packed = packCandidate(temporaryDirectory);
    filename = packed.metadata.filename;
    size = packed.metadata.size;
    paths = packed.metadata.files.map((file) => file.path).sort();
    validatedTarball = packed.tarball;
    run("tar", ["-xzf", packed.tarball, "-C", temporaryDirectory]);
    packageDirectory = join(temporaryDirectory, "package");
  }

  assert.ok(validatedTarball, "package validation requires a packed artifact");
  run("npx", ["--no-install", "publint", validatedTarball]);
  run("npx", ["--no-install", "attw", validatedTarball]);

  const packedManifest = readJSON(join(packageDirectory, "package.json"));
  validateReleaseMetadata({
    artifactManifest: packedManifest,
    changelog,
    packageLock,
    releaseConfig,
    releaseManifest,
    sourceManifest: manifest,
    tag: suppliedTag,
  });
  assert.equal(packedManifest.name, "cometapi");
  assert.equal(packedManifest.version, releaseMetadata.version);
  assert.equal(packedManifest.dependencies.openai, "^6.47.0");
  assertCanonicalIdentity(packedManifest, "Packed package.json");
  assert.deepEqual(paths, expected);

  const packedReadme = readFileSync(
    join(packageDirectory, "README.md"),
    "utf8",
  );
  assert.equal(
    packedReadme,
    sourceReadme,
    "Packed README.md must exactly match the reviewed source document",
  );
  validatePublicationNeutralReadme(packedReadme);

  for (const file of ["dist/index.js", "dist/index.cjs"]) {
    const contents = readFileSync(join(packageDirectory, file), "utf8");
    assert.doesNotMatch(contents, /CometClient|COMETAPI_ACCESS_TOKEN/);
  }

  console.log(`Verified package ${filename} (${String(size)} bytes).`);
} finally {
  removeTemporaryDirectory(temporaryDirectory);
}
