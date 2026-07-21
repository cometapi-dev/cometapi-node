import { ROOT } from "./lib.mjs";
import {
  collectStandaloneContentViolations,
  formatStandaloneContentViolations,
} from "./standalone-content.mjs";

const violations = collectStandaloneContentViolations(ROOT);
if (violations.length > 0) {
  console.error(formatStandaloneContentViolations(violations));
  process.exitCode = 1;
} else {
  console.log("Standalone content gate passed.");
}
