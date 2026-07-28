import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import { collectReadmeExampleViolations } from "../scripts/example-validation.mjs";

const esm = "console.log('esm');\n";
const commonjs = "console.log('cjs');\n";
const readme = `# SDK

## ESM quick start

\`\`\`js
${esm}\`\`\`

## CommonJS quick start

\`\`\`javascript
${commonjs}\`\`\`
`;

describe("README example validation", () => {
  it("accepts exact canonical examples", () => {
    expect(collectReadmeExampleViolations({ readme, esm, commonjs })).toEqual(
      [],
    );
  });

  it("normalizes CRLF and one trailing newline", () => {
    expect(
      collectReadmeExampleViolations({
        readme: readme.replaceAll("\n", "\r\n"),
        esm: esm.trimEnd(),
        commonjs,
      }),
    ).toEqual([]);
  });

  it.each([
    [
      "changed code",
      readme.replace("console.log('esm')", "console.log('other')"),
    ],
    [
      "duplicate heading",
      `${readme}\n## ESM quick start\n\n\`\`\`js\n${esm}\`\`\`\n`,
    ],
    [
      "missing code",
      readme.replace(`\`\`\`javascript\n${commonjs}\`\`\``, "No code here."),
    ],
    [
      "code in the next H2",
      readme.replace(`\`\`\`js\n${esm}\`\`\``, "No code here."),
    ],
  ])("rejects %s", (_name, candidate) => {
    expect(
      collectReadmeExampleViolations({ readme: candidate, esm, commonjs }),
    ).not.toEqual([]);
  });

  it("accepts the real repository examples", () => {
    expect(
      collectReadmeExampleViolations({
        readme: readFileSync(new URL("../README.md", import.meta.url), "utf8"),
        esm: readFileSync(
          new URL("../examples/esm.mjs", import.meta.url),
          "utf8",
        ),
        commonjs: readFileSync(
          new URL("../examples/commonjs.cjs", import.meta.url),
          "utf8",
        ),
      }),
    ).toEqual([]);
  });
});
