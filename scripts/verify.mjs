import { run } from "./lib.mjs";

const offlineOnly = process.argv.includes("--offline");
const offlineChecks = [
  "format:check",
  "lint",
  "typecheck",
  "test",
  "test:secrets",
  "check:public-preview",
  "test:package",
  "test:live-contract",
  "test:fixtures",
];

for (const check of offlineChecks) {
  run("npm", ["run", check]);
}

run("npm", ["run", "test:compat", "--", "--lane", "locked"]);

if (!offlineOnly) {
  run("npm", ["run", "test:compat"]);
  run("npm", ["run", "actionlint"]);
  run("npm", ["run", "check:self-contained"]);
}
