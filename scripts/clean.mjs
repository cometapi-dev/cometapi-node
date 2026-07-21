import { rmSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./lib.mjs";

for (const directory of [".artifacts", "coverage", "dist"]) {
  rmSync(join(ROOT, directory), { force: true, recursive: true });
}
