import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CANONICAL_IDENTITY,
  collectPublicPreviewViolations,
  distTagForVersion,
  escapeRegularExpression,
  SUPPORTED_NODE_ENGINES,
  SUPPORTED_OPENAI_RANGE,
  validatePublicPreviewDocuments,
  validateReleaseMetadata,
  visibleMarkdownText,
} from "../scripts/release-validation.mjs";

const PUBLIC_DOCUMENT_FILES = [
  ["agents", "AGENTS.md"],
  ["architecture", "ARCHITECTURE.md"],
  ["changelog", "CHANGELOG.md"],
  ["compatibility", "COMPATIBILITY.md"],
  ["conduct", "CODE_OF_CONDUCT.md"],
  ["contributing", "CONTRIBUTING.md"],
  ["license", "LICENSE"],
  ["readme", "README.md"],
  ["releasing", "RELEASING.md"],
  ["roadmap", "ROADMAP.md"],
  ["security", "SECURITY.md"],
  ["support", "SUPPORT.md"],
];

function repositoryPublicPreviewFixture() {
  return {
    documents: Object.fromEntries(
      PUBLIC_DOCUMENT_FILES.map(([field, filename]) => [
        field,
        readFileSync(new URL(`../${filename}`, import.meta.url), "utf8"),
      ]),
    ),
    sourceManifest: JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ),
  };
}

function fixture(version = "0.1.0-alpha.1") {
  const isPrerelease = version.includes("-");
  const sourceManifest = {
    author: "CometAPI",
    bugs: {
      url: "https://github.com/cometapi-dev/cometapi-node/issues",
    },
    dependencies: { openai: SUPPORTED_OPENAI_RANGE },
    engines: { node: SUPPORTED_NODE_ENGINES },
    homepage: "https://www.cometapi.com",
    keywords: ["cometapi", "typescript", "nodejs"],
    name: "cometapi",
    publishConfig: { access: "public", provenance: true },
    repository: {
      type: "git",
      url: "git+https://github.com/cometapi-dev/cometapi-node.git",
    },
    version,
  };
  return {
    artifactManifest: {
      ...sourceManifest,
      engines: { ...sourceManifest.engines },
      publishConfig: { ...sourceManifest.publishConfig },
    },
    changelog: `# Changelog\n\n## [${version}] - Unreleased\n`,
    packageLock: {
      name: "cometapi",
      packages: {
        "": {
          engines: { node: SUPPORTED_NODE_ENGINES },
          name: "cometapi",
          version,
        },
      },
      version,
    },
    releaseDocuments: {
      agents:
        "# CometAPI SDK Agent Instructions\n\nThis repository has a standalone engineering contract.\n",
      architecture:
        "# Architecture\n\nThe SDK reuses the official OpenAI client.\n\n## 0.1 boundary\n\nOnly the documented operations are supported.\n",
      changelog: `# Changelog\n\nAll notable changes are recorded here.\n\n## [${version}] - Unreleased\n`,
      compatibility:
        "# Compatibility\n\nThis document records tested support.\n\n## Supported protocol surface\n\nOnly contract-tested operations are supported.\n",
      conduct:
        "# Code of Conduct\n\nContributors must participate respectfully.\n\n## Reporting and enforcement\n\nReport privately to support@cometapi.com.\n",
      contributing:
        "# Contributing\n\nContributions must include tests.\n\n## Development setup\n\nInstall from the lock file before running checks.\n",
      license:
        'MIT License\n\nCopyright (c) 2026 CometAPI\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software, to use the Software subject to the MIT conditions.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.\n',
      readme: `# CometAPI SDK\n\n${isPrerelease ? "**Pre-release:** the SDK is under active development." : "**Stable:** the SDK is supported for the documented 0.1 surface."} ${version} is approved for npm publication.\n\n## Supported 0.1 surface\n\n- \`chat.completions.create\`, streaming and non-streaming\n- \`responses.create\`, streaming and non-streaming\n- \`models.list\`\n`,
      releasing:
        "# Releasing\n\nRelease status is evidence-based.\n\n## Authorization boundary\n\nRemote publication requires maintainer authorization.\n",
      roadmap:
        "# CometAPI SDK Roadmap\n\nThis roadmap defines the release sequence.\n\n## Public Preview\n\nThe preview requires public documentation and offline CI.\n",
      security:
        "# Security Policy\n\nNever disclose credentials publicly.\n\n## Reporting a vulnerability\n\nReport vulnerabilities at https://github.com/cometapi-dev/cometapi-node/security/advisories/new.\n",
      support:
        "# Support\n\nSupport covers the tested SDK surface.\n\n## Getting help\n\nEmail support@cometapi.com or use https://github.com/cometapi-dev/cometapi-node/issues.\n",
    },
    releaseConfig: {
      packages: {
        ".": isPrerelease
          ? {
              "release-type": "node",
              versioning: "prerelease",
              prerelease: true,
              "prerelease-type": "alpha",
              "changelog-path": "CHANGELOG.md",
              "include-component-in-tag": false,
              "include-v-in-tag": true,
              "include-v-in-release-name": true,
            }
          : {
              "release-type": "node",
              versioning: "always-bump-patch",
              prerelease: false,
              component: "cometapi",
              "skip-github-release": false,
              "changelog-path": "CHANGELOG.md",
              "include-component-in-tag": false,
              "include-v-in-tag": true,
              "include-v-in-release-name": true,
              "pull-request-title-pattern":
                "chore${scope}: release${component} ${version}",
            },
      },
      ...(isPrerelease
        ? {}
        : {
            label: "autorelease: pending",
            "release-label": "autorelease: tagged",
            "separate-pull-requests": true,
          }),
    },
    releaseManifest: { ".": version },
    sourceManifest,
  };
}

describe("Public Preview content", () => {
  it("accepts canonical identity and durable repository documents", () => {
    const values = fixture();
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).not.toThrow();
  });

  it("accepts the real repository documents and package metadata", () => {
    expect(
      collectPublicPreviewViolations(repositoryPublicPreviewFixture()),
    ).toEqual([]);
  });

  it.each(PUBLIC_DOCUMENT_FILES)(
    "rejects single-character %s content",
    (field, filename) => {
      const values = fixture();
      values.releaseDocuments[field] = "x";
      expect(
        collectPublicPreviewViolations({
          documents: values.releaseDocuments,
          sourceManifest: values.sourceManifest,
        }).join("\n"),
      ).toMatch(new RegExp(filename.replaceAll(".", "\\.")));
    },
  );

  it.each([
    [
      "top-level pre-release label",
      (readme) => readme.replace("**Pre-release:**", "Status:"),
      /pre-release near the top/,
    ],
    [
      "pre-release label only in a link target",
      (readme) =>
        readme.replace(
          "**Pre-release:**",
          "[Status](https://example.invalid/pre-release)",
        ),
      /pre-release near the top/,
    ],
    [
      "chat.completions.create",
      (readme) => readme.replace("chat.completions.create", "chat.create"),
      /exact operation chat\.completions\.create/,
    ],
    [
      "responses.create",
      (readme) => readme.replace("responses.create", "responses.retrieve"),
      /exact operation responses\.create/,
    ],
    [
      "models.list",
      (readme) => readme.replace("models.list", "models.retrieve"),
      /exact operation models\.list/,
    ],
    [
      "models.list in the supported section",
      (readme) =>
        `${readme.replace("- `models.list`\n", "")}\n## Example\n\nCall \`models.list\`.\n`,
      /exact operation models\.list/,
    ],
    [
      "models.list only in a link target",
      (readme) =>
        readme.replace(
          "- `models.list`",
          "- [Model reference](https://example.invalid/models.list)",
        ),
      /exact operation models\.list/,
    ],
    [
      "Chat Completions streaming mode",
      (readme) =>
        readme.replace(
          "`chat.completions.create`, streaming and non-streaming",
          "`chat.completions.create`, non-streaming",
        ),
      /chat\.completions\.create as streaming and non-streaming/,
    ],
    [
      "Responses non-streaming mode",
      (readme) =>
        readme.replace(
          "`responses.create`, streaming and non-streaming",
          "`responses.create`, streaming",
        ),
      /responses\.create as streaming and non-streaming/,
    ],
    [
      "a distinct streaming mode",
      (readme) =>
        readme.replace(
          "`responses.create`, streaming and non-streaming",
          "`responses.create`, non-streaming and nonstreaming",
        ),
      /responses\.create as streaming and non-streaming/,
    ],
  ])("rejects a README without %s", (_name, mutate, message) => {
    const values = fixture();
    values.releaseDocuments.readme = mutate(values.releaseDocuments.readme);
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(message);
  });

  it.each([
    ["permission grant", /Permission is hereby granted[^\n]+\n\n/],
    ["warranty disclaimer", /THE SOFTWARE IS PROVIDED[^\n]+\n/],
  ])("rejects an MIT license without its %s", (_name, clause) => {
    const values = fixture();
    values.releaseDocuments.license = values.releaseDocuments.license.replace(
      clause,
      "",
    );
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(/LICENSE must contain the MIT/);
  });

  it.each([
    ["architecture", "## 0.1 boundary", "## Design notes"],
    ["compatibility", "## Supported protocol surface", "## Notes"],
    ["conduct", "## Reporting and enforcement", "## Contact"],
    ["contributing", "## Development setup", "## Workflow"],
    ["releasing", "## Authorization boundary", "## Process"],
    ["roadmap", "## Public Preview", "## Current work"],
    ["security", "## Reporting a vulnerability", "## Contact"],
    ["support", "## Getting help", "## Contact"],
  ])("rejects %s without its key contract section", (field, heading, other) => {
    const values = fixture();
    values.releaseDocuments[field] = values.releaseDocuments[field].replace(
      heading,
      other,
    );
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(new RegExp(field === "conduct" ? "CODE_OF_CONDUCT" : field, "i"));
  });

  it("rejects an empty key contract section", () => {
    const values = fixture();
    values.releaseDocuments.architecture =
      "# Architecture\n\nThe SDK reuses the official client.\n\n## 0.1 boundary\n";
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(/ARCHITECTURE\.md.*substantive contract content/);
  });

  it("does not count README requirements hidden in HTML comments", () => {
    const values = fixture();
    values.releaseDocuments.readme = `# CometAPI SDK\n\n<!--\n${values.releaseDocuments.readme}\n-->\n`;
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(/pre-release near the top/);
  });

  it.each(["`", "~"])(
    "does not count Architecture requirements in %s fenced code",
    (character) => {
      const values = fixture();
      const fence = character.repeat(3);
      values.releaseDocuments.architecture = `# Architecture\n\n${fence}markdown\n## 0.1 boundary\n\nOnly the documented operations are supported.\n${fence}\n`;
      expect(() =>
        validatePublicPreviewDocuments({
          documents: values.releaseDocuments,
          sourceManifest: values.sourceManifest,
        }),
      ).toThrow(/ARCHITECTURE\.md.*0\.1 boundary/);
    },
  );

  it("does not count a required section in a CR-only fenced block", () => {
    const values = fixture();
    values.releaseDocuments.architecture =
      "# Architecture\r\r```markdown\r## 0.1 boundary\r\rOnly the documented operations are supported.\r```\r";
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(/ARCHITECTURE\.md.*0\.1 boundary/);
  });

  it("does not turn a comment-prefixed line into a heading", () => {
    const values = fixture();
    values.releaseDocuments.architecture =
      "# Architecture\n\nThe SDK reuses the official client.\n\n<!-- -->## 0.1 boundary\n\nOnly the documented operations are supported.\n";
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(/ARCHITECTURE\.md.*0\.1 boundary/);
  });

  it("keeps visible text around inline and multiline comments", () => {
    expect(
      visibleMarkdownText(
        "Before <!-- hidden --> after\nStart <!-- hidden\nstill hidden --> end",
      ),
    ).toBe("Before  after\nStart  end");
  });

  it("accepts a canonical contact supplied as a Markdown link target", () => {
    const values = fixture();
    values.releaseDocuments.security = `# Security Policy\n\nNever disclose credentials publicly.\n\n## Reporting a vulnerability\n\n[Open a private security advisory](${CANONICAL_IDENTITY.securityUrl}).\n`;
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).not.toThrow();
  });

  it.each([
    [
      "TypeScript keyword",
      (manifest) => {
        manifest.keywords = manifest.keywords.filter(
          (keyword) => keyword !== "typescript",
        );
      },
      /keywords must contain typescript/,
    ],
    [
      "Node.js keyword",
      (manifest) => {
        manifest.keywords = manifest.keywords.filter(
          (keyword) => keyword !== "nodejs",
        );
      },
      /keywords must contain nodejs/,
    ],
    [
      "Node.js runtime range",
      (manifest) => {
        manifest.engines.node = ">=22";
      },
      /engines\.node/,
    ],
    [
      "OpenAI runtime dependency range",
      (manifest) => {
        manifest.dependencies.openai = "^7.0.0";
      },
      /dependencies\.openai/,
    ],
  ])(
    "rejects package metadata without the %s contract",
    (_name, mutate, message) => {
      const values = fixture();
      mutate(values.sourceManifest);
      expect(() =>
        validatePublicPreviewDocuments({
          documents: values.releaseDocuments,
          sourceManifest: values.sourceManifest,
        }),
      ).toThrow(message);
    },
  );

  it("rejects handoff narrative", () => {
    const values = fixture();
    values.releaseDocuments.roadmap =
      "# Roadmap\n\nRegistry Alpha ready for owner action.\n";
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(/preparation-only narrative/);
  });

  it("collects every independent violation before failing", () => {
    const values = fixture();
    values.sourceManifest.author = "Different Author";
    values.sourceManifest.repository.url =
      "git+https://github.com/different/repository.git";
    values.releaseDocuments.license =
      "MIT License\n\nCopyright holder: pending owner action.\n";
    values.releaseDocuments.conduct = "No contact is listed.\n";
    values.releaseDocuments.security = "No reporting URL is listed.\n";

    const violations = collectPublicPreviewViolations({
      documents: values.releaseDocuments,
      sourceManifest: values.sourceManifest,
    });

    expect(violations.length).toBeGreaterThanOrEqual(5);
    expect(violations.join("\n")).toMatch(/package\.json author/);
    expect(violations.join("\n")).toMatch(/package\.json repository\.url/);
    expect(violations.join("\n")).toMatch(/LICENSE/);
    expect(violations.join("\n")).toMatch(/CODE_OF_CONDUCT\.md/);
    expect(violations.join("\n")).toMatch(/SECURITY\.md/);
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(/found \d+ violation/);
  });

  it.each([
    ["package name", (values) => (values.sourceManifest.name = "other")],
    ["author", (values) => (values.sourceManifest.author = "Other")],
    [
      "homepage",
      (values) => (values.sourceManifest.homepage = "https://example.com"),
    ],
    [
      "repository type",
      (values) => (values.sourceManifest.repository.type = "svn"),
    ],
    [
      "repository URL",
      (values) =>
        (values.sourceManifest.repository.url =
          "https://github.com/cometapi-dev/cometapi-node.git"),
    ],
    [
      "bugs URL",
      (values) =>
        (values.sourceManifest.bugs.url =
          "https://github.com/cometapi-dev/cometapi-node/discussions"),
    ],
  ])("rejects noncanonical %s metadata", (_name, mutate) => {
    const values = fixture();
    mutate(values);
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(/package\.json/);
  });
});

describe("release metadata validation", () => {
  it.each([
    ["0.1.0-alpha.1", "next", true],
    ["0.1.0-alpha.2", "next", true],
    ["0.1.0", "latest", false],
  ])(
    "derives %s metadata without a required tag",
    (version, distTag, isPrerelease) => {
      const result = validateReleaseMetadata(fixture(version));
      expect(result).toEqual({ distTag, isPrerelease, version });
      expect(distTagForVersion(version)).toBe(distTag);
    },
  );

  it.each([
    ["0.1.0-alpha.1", true, "next"],
    ["0.1.0-alpha.2", true, "next"],
    ["0.1.0", false, "latest"],
  ])(
    "validates final release state for %s",
    (version, releaseIsPrerelease, distTag) => {
      const values = fixture(version);
      values.changelog = `## [${version}] - 2026-07-17\n`;
      expect(
        validateReleaseMetadata({
          ...values,
          releaseIsPrerelease,
          requireDatedChangelog: true,
          requireFinalReleaseState: true,
          requireReleasableDocs: true,
          tag: `v${version}`,
        }),
      ).toEqual({ distTag, isPrerelease: releaseIsPrerelease, version });
    },
  );

  it("validates an optional tag against the source manifest", () => {
    const values = fixture("0.1.0-alpha.2");
    expect(
      validateReleaseMetadata({ ...values, tag: "v0.1.0-alpha.2" }),
    ).toMatchObject({ version: "0.1.0-alpha.2" });
    expect(() =>
      validateReleaseMetadata({ ...values, tag: "v0.1.0-alpha.1" }),
    ).toThrow(/tag .* does not match/i);
  });

  it("accepts stable promotion before the package version changes", () => {
    const values = fixture("0.1.0-alpha.3");
    values.releaseConfig.packages["."] = {
      "release-type": "node",
      versioning: "prerelease",
      prerelease: false,
      "skip-github-release": true,
      "changelog-path": "CHANGELOG.md",
      "include-component-in-tag": false,
      "include-v-in-tag": true,
      "include-v-in-release-name": true,
    };
    expect(validateReleaseMetadata(values)).toMatchObject({
      version: "0.1.0-alpha.3",
    });
    expect(() =>
      validateReleaseMetadata({ ...values, requireFinalReleaseState: true }),
    ).toThrow(/stable-promotion/);
  });

  it("requires the README channel label to match a stable package", () => {
    const values = fixture("0.1.0");
    values.releaseDocuments.readme = values.releaseDocuments.readme.replace(
      "**Stable:**",
      "**Pre-release:**",
    );
    expect(() =>
      validatePublicPreviewDocuments({
        documents: values.releaseDocuments,
        sourceManifest: values.sourceManifest,
      }),
    ).toThrow(/stable package as a pre-release/);
  });

  it.each([
    [
      "stable promotion missing skip",
      (config) => delete config["skip-github-release"],
    ],
    [
      "stable promotion with prerelease type",
      (config) => (config["prerelease-type"] = "alpha"),
    ],
    ["stable promotion with draft", (config) => (config.draft = true)],
  ])("rejects %s configuration", (_name, mutate) => {
    const values = fixture("0.1.0-alpha.3");
    values.releaseConfig.packages["."] = {
      "release-type": "node",
      versioning: "prerelease",
      prerelease: false,
      "skip-github-release": true,
      "changelog-path": "CHANGELOG.md",
      "include-component-in-tag": false,
      "include-v-in-tag": true,
      "include-v-in-release-name": true,
    };
    mutate(values.releaseConfig.packages["."]);
    expect(() => validateReleaseMetadata(values)).toThrow(/Release Please/);
  });

  it.each([
    [
      "Release Please linked H3",
      "### [0.1.0](https://github.com/cometapi-dev/cometapi-node/compare/v0.1.0-alpha.3...v0.1.0) (2026-07-28)\n\n### Bug Fixes\n\n* prepare stable\n",
    ],
    [
      "Release Please plain H2",
      "## 0.1.0 (2026-07-28)\n\n### Bug Fixes\n\n* prepare stable\n",
    ],
  ])("accepts %s changelog output", (_name, changelog) => {
    const values = fixture("0.1.0");
    expect(() =>
      validateReleaseMetadata({
        ...values,
        changelog,
        requireDatedChangelog: true,
      }),
    ).not.toThrow();
  });

  it("rejects duplicate versions across changelog formats", () => {
    const values = fixture("0.1.0");
    values.changelog =
      "## [0.1.0] - 2026-07-28\n\n### [0.1.0](https://example.invalid) (2026-07-28)\n";
    expect(() => validateReleaseMetadata(values)).toThrow(/found 2/);
  });

  it("scans Release Please H3 subsections up to the next version", () => {
    const values = fixture("0.1.0");
    values.changelog =
      "### [0.1.0](https://example.invalid) (2026-07-28)\n\n### Bug Fixes\n\nnpm publication: not performed.\n\n## [0.1.0-alpha.3] - 2026-07-27\n\nReleased.\n";
    expect(() =>
      validateReleaseMetadata({
        ...values,
        requireDatedChangelog: true,
        requireReleasableDocs: true,
      }),
    ).toThrow(/CHANGELOG/);
  });

  it("does not let a nested semver heading truncate a release section", () => {
    const values = fixture("0.1.0");
    values.changelog =
      "## [0.1.0] - 2026-07-28\n\n### 9.9.9 (2026-07-28)\n\nnpm publication: not performed.\n\n## [0.1.0-alpha.3] - 2026-07-27\n";
    expect(() =>
      validateReleaseMetadata({
        ...values,
        requireReleasableDocs: true,
      }),
    ).toThrow(/CHANGELOG/);
  });

  it.each([
    ["include-v-in-tag", false],
    ["include-component-in-tag", true],
    ["changelog-path", "OTHER.md"],
    ["skip-changelog", true],
  ])("rejects a release-critical %s override", (field, value) => {
    const values = fixture("0.1.0");
    values.releaseConfig.packages["."][field] = value;
    expect(() => validateReleaseMetadata(values)).toThrow(/Release Please/);
  });

  it.each(["0.2.0", "1.0.0"])(
    "rejects stable version %s outside the 0.1.0 promotion",
    (version) => {
      const values = fixture(version);
      expect(() => validateReleaseMetadata(values)).toThrow(/within 0\.1\.x/);
    },
  );

  it("accepts a normal stable 0.1.1 patch release state", () => {
    const values = fixture("0.1.1");
    values.releaseConfig = {
      label: "autorelease: pending",
      "release-label": "autorelease: tagged",
      "separate-pull-requests": true,
      packages: {
        ".": {
          "changelog-path": "CHANGELOG.md",
          component: "cometapi",
          "include-component-in-tag": false,
          "include-v-in-release-name": true,
          "include-v-in-tag": true,
          prerelease: false,
          "pull-request-title-pattern":
            "chore${scope}: release${component} ${version}",
          "release-type": "node",
          "skip-github-release": false,
          versioning: "always-bump-patch",
        },
      },
    };
    values.releaseManifest = { ".": "0.1.1" };

    expect(validateReleaseMetadata(values)).toMatchObject({
      isPrerelease: false,
      version: "0.1.1",
    });
  });

  it.each([
    ["component", (config) => delete config.packages["."].component],
    [
      "patch-only versioning",
      (config) => (config.packages["."].versioning = "default"),
    ],
    [
      "GitHub release",
      (config) => (config.packages["."]["skip-github-release"] = true),
    ],
    [
      "separate pull requests",
      (config) => delete config["separate-pull-requests"],
    ],
    [
      "release PR title",
      (config) => delete config.packages["."]["pull-request-title-pattern"],
    ],
    ["pending label", (config) => delete config.label],
    ["release label", (config) => delete config["release-label"]],
  ])("rejects stable maintenance without %s configuration", (_name, mutate) => {
    const values = fixture("0.1.1");
    values.releaseConfig = {
      label: "autorelease: pending",
      "release-label": "autorelease: tagged",
      "separate-pull-requests": true,
      packages: {
        ".": {
          "changelog-path": "CHANGELOG.md",
          component: "cometapi",
          "include-component-in-tag": false,
          "include-v-in-release-name": true,
          "include-v-in-tag": true,
          prerelease: false,
          "pull-request-title-pattern":
            "chore${scope}: release${component} ${version}",
          "release-type": "node",
          "skip-github-release": false,
          versioning: "always-bump-patch",
        },
      },
    };
    values.releaseManifest = { ".": "0.1.1" };
    mutate(values.releaseConfig);

    expect(() => validateReleaseMetadata(values)).toThrow(/Release Please/);
  });

  it("allows the exact one-cycle stable boundary only before 0.1.1", () => {
    const values = fixture("0.1.1");
    values.releaseConfig = {
      label: "autorelease: pending",
      "last-release-sha": "1752cbb57f11dc6dca8dd1b13f0f8d5e8b5fdfca",
      "release-label": "autorelease: tagged",
      "separate-pull-requests": true,
      packages: {
        ".": {
          "changelog-path": "CHANGELOG.md",
          component: "cometapi",
          "include-component-in-tag": false,
          "include-v-in-release-name": true,
          "include-v-in-tag": true,
          prerelease: false,
          "pull-request-title-pattern":
            "chore${scope}: release${component} ${version}",
          "release-type": "node",
          "skip-github-release": false,
          versioning: "always-bump-patch",
        },
      },
    };
    values.releaseManifest = { ".": "0.1.1" };

    expect(() => validateReleaseMetadata(values)).toThrow(/last-release-sha/);
  });

  it("rejects additional Release Please packages", () => {
    const values = fixture("0.1.0");
    values.releaseConfig.packages.other = {
      ...values.releaseConfig.packages["."],
    };
    values.releaseManifest.other = "0.1.0";
    expect(() => validateReleaseMetadata(values)).toThrow(
      /single root package/,
    );
  });

  it("rejects prerelease-only support policy for stable publication", () => {
    const values = fixture("0.1.0");
    values.changelog = "## [0.1.0] - 2026-07-28\n";
    values.releaseDocuments.support +=
      "Response times are not guaranteed for prereleases.\n";
    expect(() =>
      validateReleaseMetadata({
        ...values,
        requireDatedChangelog: true,
        requireReleasableDocs: true,
      }),
    ).toThrow(/SUPPORT\.md.*prerelease-only/);
  });

  it("escapes every regular-expression metacharacter in versions", () => {
    expect(escapeRegularExpression("1.2.3-alpha+build.1")).toBe(
      "1\\.2\\.3-alpha\\+build\\.1",
    );
    const values = fixture("1.2.3-alpha+build.1");
    values.changelog = "## [1x2x3-alpha+buildx1] - Unreleased\n";
    expect(() => validateReleaseMetadata(values)).toThrow(/CHANGELOG/);
  });

  it("accepts a matching one-time bootstrap when the manifest is empty", () => {
    const values = fixture();
    values.releaseManifest = {};
    values.releaseConfig.packages["."]["release-as"] =
      values.sourceManifest.version;
    expect(validateReleaseMetadata(values)).toMatchObject({
      version: values.sourceManifest.version,
    });
  });

  it.each([
    [
      "artifact",
      (values) => {
        values.artifactManifest.version = "0.1.0-alpha.2";
      },
      /Packed artifact version/,
    ],
    [
      "lock root name",
      (values) => {
        values.packageLock.name = "not-cometapi";
      },
      /package-lock\.json name/,
    ],
    [
      "lock package name",
      (values) => {
        values.packageLock.packages[""].name = "not-cometapi";
      },
      /packages\[""\] name/,
    ],
    [
      "lock root",
      (values) => {
        values.packageLock.version = "0.1.0-alpha.2";
      },
      /package-lock\.json version/,
    ],
    [
      "lock package",
      (values) => {
        values.packageLock.packages[""].version = "0.1.0-alpha.2";
      },
      /packages\[""\] version/,
    ],
    [
      "release manifest",
      (values) => {
        values.releaseManifest["."] = "0.1.0-alpha.2";
      },
      /Release Please manifest version/,
    ],
    [
      "bootstrap",
      (values) => {
        values.releaseManifest = {};
        values.releaseConfig.packages["."]["release-as"] = "0.1.0-alpha.2";
      },
      /Release Please bootstrap version/,
    ],
  ])("rejects a %s metadata mismatch", (_name, mutate, message) => {
    const values = fixture();
    mutate(values);
    expect(() => validateReleaseMetadata(values)).toThrow(message);
  });

  it("rejects release state without a matching manifest or bootstrap", () => {
    const values = fixture();
    values.releaseManifest = {};
    expect(() => validateReleaseMetadata(values)).toThrow(
      /track the source version or explicitly bootstrap/,
    );
  });

  it("requires final release state to remove bootstrap and date the changelog", () => {
    const bootstrap = fixture();
    bootstrap.releaseConfig.packages["."]["release-as"] =
      bootstrap.sourceManifest.version;
    bootstrap.changelog = "## [0.1.0-alpha.1] - 2026-07-17\n";
    expect(() =>
      validateReleaseMetadata({
        ...bootstrap,
        requireDatedChangelog: true,
        requireFinalReleaseState: true,
      }),
    ).toThrow(/release-as setting must be removed/);

    const unreleased = fixture();
    expect(() =>
      validateReleaseMetadata({
        ...unreleased,
        requireDatedChangelog: true,
        requireFinalReleaseState: true,
      }),
    ).toThrow(/must date/);
  });

  it.each([
    ["missing", "## [0.1.0-alpha.2] - Unreleased\n", /found 0/],
    [
      "duplicate",
      "## [0.1.0-alpha.1] - Unreleased\n## [0.1.0-alpha.1] - 2026-07-17\n",
      /found 2/,
    ],
    ["malformed", "## [0.1.0-alpha.1] - Pending\n", /found 0/],
  ])("rejects a %s changelog heading", (_name, changelog, message) => {
    expect(() => validateReleaseMetadata({ ...fixture(), changelog })).toThrow(
      message,
    );
  });

  it.each([
    ["0.1.0-alpha.1", false, /prerelease package/],
    ["0.1.0", true, /stable package/],
  ])(
    "rejects a GitHub prerelease mismatch for %s",
    (version, releaseIsPrerelease, message) => {
      expect(() =>
        validateReleaseMetadata({
          ...fixture(version),
          releaseIsPrerelease,
        }),
      ).toThrow(message);
    },
  );

  it.each([
    ["source", (values) => values.sourceManifest],
    ["lock", (values) => values.packageLock.packages[""]],
    ["artifact", (values) => values.artifactManifest],
  ])("rejects unsupported %s Node.js runtime metadata", (_name, select) => {
    const values = fixture();
    select(values).engines.node = "^22.0.0 || ^24.0.0 || ^26.0.0";
    expect(() => validateReleaseMetadata(values)).toThrow(/engines\.node/);
  });

  it("rejects static dist-tag metadata from source or artifact manifests", () => {
    const source = fixture();
    source.sourceManifest.publishConfig.tag = "next";
    expect(() => validateReleaseMetadata(source)).toThrow(/publishConfig\.tag/);

    const artifact = fixture();
    artifact.artifactManifest.publishConfig.tag = "next";
    expect(() => validateReleaseMetadata(artifact)).toThrow(
      /publishConfig\.tag/,
    );
  });

  it.each([
    [
      "missing release documents",
      (values) => {
        values.releaseDocuments = undefined;
      },
      /LICENSE/,
    ],
    [
      "pending LICENSE holder",
      (values) => {
        values.releaseDocuments.license =
          "MIT License\n\nCopyright holder: pending owner action.\n";
      },
      /LICENSE/,
    ],
    [
      "missing LICENSE identity",
      (values) => {
        values.releaseDocuments.license = "MIT License\n";
      },
      /LICENSE/,
    ],
    [
      "stale README status",
      (values) => {
        values.releaseDocuments.readme = `${values.sourceManifest.version} is approved for npm publication. The package has not been published.\n`;
      },
      /README/,
    ],
    [
      "missing README approval",
      (values) => {
        values.releaseDocuments.readme =
          "CometAPI SDK release documentation.\n";
      },
      /README/,
    ],
    [
      "pending security contact",
      (values) => {
        values.releaseDocuments.security =
          "The security contact is pending owner action.\n";
      },
      /SECURITY/,
    ],
    [
      "reserved security contact",
      (values) => {
        values.releaseDocuments.security =
          "Report vulnerabilities to security@example.invalid.\n";
      },
      /SECURITY/,
    ],
    [
      "stale security status",
      (values) => {
        values.releaseDocuments.security =
          "Report vulnerabilities at https://github.com/cometapi-dev/cometapi-node/security/advisories/new. This is an unpublished prerelease candidate.\n";
      },
      /SECURITY/,
    ],
    [
      "missing support contact",
      (values) => {
        values.releaseDocuments.support = "Use the support process.\n";
      },
      /SUPPORT/,
    ],
    [
      "stale support status",
      (values) => {
        values.releaseDocuments.support =
          "Email support@cometapi.com or use https://github.com/cometapi-dev/cometapi-node/issues. The package is not yet published.\n";
      },
      /SUPPORT/,
    ],
    [
      "candidate-only changelog evidence",
      (values) => {
        values.changelog = `## [${values.sourceManifest.version}] - 2026-07-17\n\nnpm publication: not performed.\n`;
      },
      /CHANGELOG/,
    ],
  ])("rejects %s before publication", (_name, mutate, message) => {
    const values = fixture();
    values.changelog = "## [0.1.0-alpha.1] - 2026-07-17\n";
    mutate(values);
    expect(() =>
      validateReleaseMetadata({
        ...values,
        requireDatedChangelog: true,
        requireFinalReleaseState: true,
        requireReleasableDocs: true,
      }),
    ).toThrow(message);
  });

  it("does not require releasable documents for local candidate validation", () => {
    const values = fixture();
    values.releaseDocuments = {
      license: "Copyright holder: pending owner action.\n",
      readme: "This package has not been published.\n",
      security: "Security contact pending owner action.\n",
      support: "Support contact pending owner action.\n",
    };
    expect(validateReleaseMetadata(values)).toMatchObject({
      version: values.sourceManifest.version,
    });
  });

  it("does not accept a release approval hidden in a comment", () => {
    const values = fixture();
    values.changelog = `## [${values.sourceManifest.version}] - 2026-07-17\n`;
    values.releaseDocuments.readme = `# CometAPI SDK\n\n<!-- ${values.sourceManifest.version} is approved for npm publication. -->\n`;
    expect(() =>
      validateReleaseMetadata({
        ...values,
        requireDatedChangelog: true,
        requireFinalReleaseState: true,
        requireReleasableDocs: true,
      }),
    ).toThrow(/README/);
  });

  it.each([
    [
      "README",
      (values) => {
        values.releaseDocuments.readme = `# CometAPI SDK\r\r\`\`\`text\r${values.sourceManifest.version} is approved for npm publication.\r\`\`\`\r`;
      },
    ],
    [
      "SECURITY",
      (values) => {
        values.releaseDocuments.security =
          "# Security Policy\r\r```text\rsecurity@cometapi.com\r```\r";
      },
    ],
    [
      "SUPPORT",
      (values) => {
        values.releaseDocuments.support =
          "# Support\r\r```text\rsupport@cometapi.com\r```\r";
      },
    ],
  ])("does not accept %s evidence in a CR-only code fence", (label, mutate) => {
    const values = fixture();
    values.changelog = `## [${values.sourceManifest.version}] - 2026-07-17\n`;
    mutate(values);
    expect(() =>
      validateReleaseMetadata({
        ...values,
        requireDatedChangelog: true,
        requireFinalReleaseState: true,
        requireReleasableDocs: true,
      }),
    ).toThrow(new RegExp(label));
  });

  it("does not turn a comment-prefixed changelog line into a heading", () => {
    const values = fixture();
    values.changelog = `# Changelog\n\n<!-- -->## [${values.sourceManifest.version}] - 2026-07-17\n`;
    expect(() =>
      validateReleaseMetadata({
        ...values,
        requireDatedChangelog: true,
      }),
    ).toThrow(/CHANGELOG\.md must contain exactly one heading/);
  });

  it("keeps the releasable-document gate in the publish workflow", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/publish.yml", import.meta.url),
      "utf8",
    );
    expect(workflow).toMatch(
      /validate-release\.mjs[\s\S]*--require-final[\s\\]*--require-releasable-docs/,
    );
  });

  it.each(["1.0", "1.0.0-alpha.01", "01.0.0", "v1.0.0"])(
    "rejects malformed semantic version %s",
    (version) => {
      expect(() => validateReleaseMetadata(fixture(version))).toThrow(
        /strict SemVer/,
      );
    },
  );
});
