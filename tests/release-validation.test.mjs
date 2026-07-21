import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  collectPublicPreviewViolations,
  distTagForVersion,
  escapeRegularExpression,
  SUPPORTED_NODE_ENGINES,
  validatePublicPreviewDocuments,
  validateReleaseMetadata,
} from "../scripts/release-validation.mjs";

function fixture(version = "0.1.0-alpha.1") {
  const sourceManifest = {
    author: "CometAPI",
    bugs: {
      url: "https://github.com/cometapi-dev/cometapi-node/issues",
    },
    engines: { node: SUPPORTED_NODE_ENGINES },
    homepage: "https://www.cometapi.com",
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
      agents: "# Engineering contract\n",
      architecture: "# Architecture\n",
      changelog: `# Changelog\n\n## [${version}] - Unreleased\n`,
      compatibility: "# Compatibility\n",
      conduct: "Report privately to support@cometapi.com.\n",
      contributing: "# Contributing\n",
      license: "MIT License\n\nCopyright (c) 2026 CometAPI\n",
      readme: `${version} is approved for npm publication.\n`,
      releasing: "# Releasing\n",
      roadmap: "# Roadmap\n",
      security:
        "Report vulnerabilities at https://github.com/cometapi-dev/cometapi-node/security/advisories/new.\n",
      support:
        "Email support@cometapi.com or use https://github.com/cometapi-dev/cometapi-node/issues.\n",
    },
    releaseConfig: { packages: { ".": {} } },
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
    ["malformed", "## [0.1.0-alpha.1] - Pending\n", /must be Unreleased/],
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
