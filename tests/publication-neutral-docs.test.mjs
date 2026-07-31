import { describe, expect, it } from "vitest";

import {
  collectMutablePublishedVersionClaims,
  validatePublicationNeutralReadme,
} from "../scripts/release-validation.mjs";

describe("publication-neutral release documents", () => {
  it.each([
    "Stable release: 0.1.2.",
    "The current npm release is `0.1.2`.",
    "`0.1.2` is the latest stable version.",
    "npm currently publishes cometapi 0.1.2.",
    "Stable `0.1.2` is available from npm.",
    "Status: `0.1.2` stable maintenance released.",
    "Current milestone: stable 0.1.2.",
    "npm latest remains 0.1.2.",
    "latest=0.1.2 and next=0.1.0-alpha.3.",
    "The `0.1.2` repair is in progress.",
    "0.1.2 is approved for npm publication.",
    "| Version | Status |\n| --- | --- |\n| `0.1.2` | Current |",
    "The newest distribution is **9.8.7**.",
    "The current npm release is 8.7.6 and CI passed.",
  ])("rejects a mutable exact-version claim: %s", (claim) => {
    expect(
      collectMutablePublishedVersionClaims({ "README.md": claim }),
    ).not.toEqual([]);
  });

  it.each([
    "Stable 0.1.x maintenance releases are available from npm.",
    "Stable 0.1.2 completed on 2026-07-30.",
    "At the 0.1.2 closeout, npm's latest dist-tag resolved to 0.1.2.",
    "The immutable v0.1.2 tag resolves to release commit 710c5649.",
    "Artifact cometapi-0.1.2.tgz has SHA-256 deadbeef.",
    "For stable 0.1.2, CI run 30515861246 passed.",
    "Release 0.2.0 provider adapters are planned.",
    "The minimum supported OpenAI version is 6.47.0.",
    "Node.js 22.14.0 or later is required for Trusted Publishing.",
    "Release Please 17.6.0 generated the historical release.",
    "```text\nThe current npm release is 0.1.2.\n```",
    "<!-- The current npm release is 0.1.2. -->",
    "[Release evidence](https://github.com/cometapi-dev/cometapi-node/releases/tag/v0.1.2)",
  ])("allows capability, dependency, or immutable evidence: %s", (claim) => {
    expect(
      collectMutablePublishedVersionClaims({ "RELEASING.md": claim }),
    ).toEqual([]);
  });

  it("reports the document and source line", () => {
    expect(
      collectMutablePublishedVersionClaims({
        "AGENTS.md": "# Agent rules\n\nCurrent npm release: 0.1.2.\n",
      }),
    ).toEqual([
      expect.stringMatching(
        /^AGENTS\.md:3: contains a mutable exact-version publication claim/,
      ),
    ]);
  });

  it.each([
    "npm install cometapi@0.1.2",
    "https://www.npmjs.com/package/cometapi/v/0.1.2",
    "0.1.2 is approved for npm publication.",
    "0.1.2 remains unpublished.",
    "npm latest remains 0.1.1.",
    "The 0.1.2 repair is in progress.",
    "The immutable v0.1.2 tag is retained as historical evidence.",
  ])("rejects README release-state coupling: %s", (claim) => {
    expect(() =>
      validatePublicationNeutralReadme(
        `# CometAPI SDK\n\nStable 0.1.x maintenance releases are available from npm.\n\n## Installation\n\n\`\`\`bash\nnpm install cometapi\n\`\`\`\n\nSee https://www.npmjs.com/package/cometapi for current registry state.\n\n${claim}\n`,
      ),
    ).toThrow(/README\.md/);
  });

  it("accepts an unpinned install and unversioned registry link", () => {
    expect(() =>
      validatePublicationNeutralReadme(`# CometAPI SDK

Stable 0.1.x maintenance releases are available from npm.

## Installation

\`\`\`bash
npm install cometapi
\`\`\`

See https://www.npmjs.com/package/cometapi for current registry state.
`),
    ).not.toThrow();
  });
});
