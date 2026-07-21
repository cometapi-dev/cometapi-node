import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { ROOT } from "./lib.mjs";

const ignoredDirectories = new Set([
  ".artifacts",
  ".cache",
  ".git",
  "coverage",
  "dist",
  "node_modules",
]);
const textExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".yaml",
  ".yml",
]);
const forbidden = [
  /(?:^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/,
  /_authToken\s*=\s*[^$\s{][^\s]*/,
  /npm_[A-Za-z0-9]{24,}/,
];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(path);
      continue;
    }
    if (!textExtensions.has(extname(entry.name)) && entry.name !== ".npmrc") {
      continue;
    }

    const contents = readFileSync(path, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        contents,
        pattern,
        `possible credential found in ${relative(ROOT, path)}`,
      );
    }
  }
}

visit(ROOT);
console.log("Secret-pattern scan passed without printing candidate values.");
