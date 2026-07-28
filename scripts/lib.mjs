import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    env: options.replaceEnv ? options.env : { ...process.env, ...options.env },
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${String(result.status)}`,
    );
  }

  return result.stdout ?? "";
}

export function makeTemporaryDirectory(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function removeTemporaryDirectory(path) {
  rmSync(path, { force: true, recursive: true });
}

export function packCandidate(destination) {
  mkdirSync(destination, { recursive: true });
  run("npm", ["run", "build"]);
  const output = run(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", destination],
    { capture: true },
  );
  const result = JSON.parse(output);
  const packed = result[0];

  if (!packed?.filename) {
    throw new Error("npm pack did not report a tarball filename");
  }

  return { metadata: packed, tarball: join(destination, packed.filename) };
}
