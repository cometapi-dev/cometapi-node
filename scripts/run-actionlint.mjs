import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { arch, platform } from "node:os";
import { delimiter, join } from "node:path";

import { ROOT, run } from "./lib.mjs";

const ACTIONLINT_VERSION = readFileSync(
  join(ROOT, ".github", "actionlint-version"),
  "utf8",
).trim();
if (!/^\d+\.\d+\.\d+$/.test(ACTIONLINT_VERSION)) {
  throw new Error(".github/actionlint-version must contain an exact version");
}

function isOnPath(name) {
  if (name.includes("/")) return existsSync(name);
  return (process.env.PATH ?? "")
    .split(delimiter)
    .some((directory) => existsSync(join(directory, name)));
}

function releaseAsset() {
  const operatingSystem = platform();
  const architecture = arch();
  const suffix =
    operatingSystem === "darwin"
      ? architecture === "arm64"
        ? "darwin_arm64"
        : architecture === "x64"
          ? "darwin_amd64"
          : undefined
      : operatingSystem === "linux"
        ? architecture === "arm64"
          ? "linux_arm64"
          : architecture === "x64"
            ? "linux_amd64"
            : undefined
        : undefined;

  if (!suffix) {
    throw new Error(
      `Automatic actionlint installation is unavailable for ${operatingSystem}/${architecture}. Install ${ACTIONLINT_VERSION} and set ACTIONLINT_BIN.`,
    );
  }
  return `actionlint_${ACTIONLINT_VERSION}_${suffix}.tar.gz`;
}

async function installPinnedActionlint() {
  const asset = releaseAsset();
  const cacheDirectory = join(ROOT, ".cache", "actionlint", ACTIONLINT_VERSION);
  const executable = join(cacheDirectory, "actionlint");
  if (existsSync(executable)) return executable;

  const checksums = readFileSync(
    join(ROOT, ".github", "actionlint-checksums.txt"),
    "utf8",
  );
  const checksumLine = checksums
    .split("\n")
    .find((line) => line.endsWith(`  ${asset}`));
  if (!checksumLine)
    throw new Error(`No pinned checksum is recorded for ${asset}`);
  const expectedChecksum = checksumLine.split(/\s+/)[0];
  const url = `https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${asset}`;
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(
      `Unable to download actionlint ${ACTIONLINT_VERSION}: HTTP ${String(response.status)}`,
    );
  }
  const archive = Buffer.from(await response.arrayBuffer());
  const actualChecksum = createHash("sha256").update(archive).digest("hex");
  if (actualChecksum !== expectedChecksum) {
    throw new Error(
      "Downloaded actionlint archive failed checksum verification",
    );
  }

  mkdirSync(cacheDirectory, { recursive: true });
  const archivePath = join(cacheDirectory, asset);
  writeFileSync(archivePath, archive);
  run("tar", ["-xzf", archivePath, "-C", cacheDirectory, "actionlint"]);
  chmodSync(executable, 0o755);
  return executable;
}

let executable = process.env.ACTIONLINT_BIN;
if (!executable) {
  executable = isOnPath("actionlint")
    ? "actionlint"
    : await installPinnedActionlint();
}
if (!isOnPath(executable)) {
  throw new Error(`actionlint executable not found: ${executable}`);
}

const version = run(executable, ["-version"], { capture: true }).trim();
if (!version.includes(ACTIONLINT_VERSION)) {
  throw new Error(
    `Expected actionlint ${ACTIONLINT_VERSION}, but found ${version || "an unknown version"}.`,
  );
}

const workflowDirectory = join(ROOT, ".github", "workflows");
const workflows = readdirSync(workflowDirectory)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .map((file) => join(workflowDirectory, file));

if (workflows.length !== 4) {
  throw new Error(
    `Expected exactly four workflows, found ${String(workflows.length)}.`,
  );
}

run(executable, ["-color", ...workflows]);
console.log(`Validated ${String(workflows.length)} workflows with ${version}.`);
