const NUMERIC_IDENTIFIER = "(?:0|[1-9]\\d*)";
const NON_NUMERIC_IDENTIFIER = "(?:\\d*[A-Za-z-][0-9A-Za-z-]*)";
const PRERELEASE_IDENTIFIER = `(?:${NUMERIC_IDENTIFIER}|${NON_NUMERIC_IDENTIFIER})`;
const BUILD_IDENTIFIER = "(?:[0-9A-Za-z-]+)";
const SEMVER_PATTERN = new RegExp(
  `^(${NUMERIC_IDENTIFIER})\\.(${NUMERIC_IDENTIFIER})\\.(${NUMERIC_IDENTIFIER})` +
    `(?:-(${PRERELEASE_IDENTIFIER}(?:\\.${PRERELEASE_IDENTIFIER})*))?` +
    `(?:\\+(${BUILD_IDENTIFIER}(?:\\.${BUILD_IDENTIFIER})*))?$`,
);

export const SUPPORTED_NODE_ENGINES = "^22.0.0 || ^24.0.0";

export const CANONICAL_IDENTITY = Object.freeze({
  author: "CometAPI",
  bugsUrl: "https://github.com/cometapi-dev/cometapi-node/issues",
  copyright: "Copyright (c) 2026 CometAPI",
  homepage: "https://www.cometapi.com",
  packageName: "cometapi",
  repositoryUrl: "git+https://github.com/cometapi-dev/cometapi-node.git",
  securityUrl:
    "https://github.com/cometapi-dev/cometapi-node/security/advisories/new",
  supportEmail: "support@cometapi.com",
});

const OWNER_PLACEHOLDER_PATTERN =
  /\b(?:pending owner(?: action| approval)?|placeholder|tbd|todo|your name)\b/i;
const CONTACT_PATTERN =
  /(?:mailto:)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https:\/\/github\.com\/[^/\s)]+\/[^/\s)]+\/(?:discussions|issues|security)(?:\/[^\s)]+)?/gi;
const RESERVED_CONTACT_PATTERN =
  /(?:^|[.@/])(?:example|invalid|localhost|placeholder|tbd|todo)(?:[./:@]|$)/i;
const STALE_PUBLICATION_PATTERNS = [
  /\bregistry alpha ready for owner action\b/i,
  /\b(?:has\s+)?not been published\b/i,
  /\bnot published\b/i,
  /\bnot yet published\b/i,
  /\bunpublished (?:pre-?release )?candidate\b/i,
  /\bunreleased candidate\b/i,
  /\blocal(?:ly)? verified\b/i,
  /\blocal candidate\b/i,
  /\bnot supported from npm\b/i,
  /\bno npm version is currently represented\b/i,
  /\bafter the owner publishes\b/i,
];
const STALE_CHANGELOG_PATTERNS = [
  /\bregistry alpha candidate scope\b/i,
  /\bnpm publication:\s*not performed\b/i,
  /\bgithub actions execution:\s*not yet verified\b/i,
  /\btrusted live smoke:\s*not yet (?:authorized or )?verified\b/i,
  /\bnpm ownership and trusted publisher:\s*pending owner action\b/i,
  /\bpublic install and provenance:\s*not available\b/i,
  /\bheading remains unreleased\b/i,
];
const PREPARATION_NARRATIVE_PATTERNS = [
  /\bregistry alpha ready for owner action\b/i,
  /\bpending owner action\b/i,
  /\bimplementation agent\b/i,
  /\bhandoff report\b/i,
  /\blocal evidence snapshot\b/i,
  /\b(?:internal|planning|parent) workspace\b/i,
  /\bformer parent workspace\b/i,
  /\blocal candidate\b/i,
  /SDK_PRD\.md/i,
  /cometapi-worksapce/i,
  /\b(?:Claude|Codex)\b/i,
];

export function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseSemanticVersion(version) {
  if (typeof version !== "string") {
    throw new Error("package.json version must be a string.");
  }

  const match = SEMVER_PATTERN.exec(version);
  if (!match) {
    throw new Error(`package.json version is not strict SemVer: ${version}`);
  }

  return {
    build: match[5],
    isPrerelease: match[4] !== undefined,
    prerelease: match[4],
    version,
  };
}

export function distTagForVersion(version) {
  return parseSemanticVersion(version).isPrerelease ? "next" : "latest";
}

function assertVersion(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(
      `${label} version ${String(actual)} does not match ${expected}.`,
    );
  }
}

function assertName(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(
      `${label} name ${String(actual)} does not match ${String(expected)}.`,
    );
  }
}

function assertSupportedNodeEngines(manifest, label) {
  const range = manifest?.engines?.node;
  if (range !== SUPPORTED_NODE_ENGINES) {
    throw new Error(
      `${label} engines.node must equal ${SUPPORTED_NODE_ENGINES}; received ${String(range)}.`,
    );
  }

  const majors = range.split(/\s*\|\|\s*/).map((clause) => {
    const match = /^\^(0|[1-9]\d*)\.0\.0$/.exec(clause);
    if (!match) {
      throw new Error(
        `${label} engines.node contains an unsupported range: ${clause}.`,
      );
    }
    return Number(match[1]);
  });
  if (majors.length !== 2 || majors[0] !== 22 || majors[1] !== 24) {
    throw new Error(
      `${label} engines.node must support exactly Node.js 22 and 24.`,
    );
  }
}

function assertNoStaticDistTag(manifest, label) {
  if (Object.hasOwn(manifest?.publishConfig ?? {}, "tag")) {
    throw new Error(
      `${label} publishConfig.tag must be absent; the release version selects the dist-tag.`,
    );
  }
}

function validateChangelog(changelog, version, requireDatedChangelog) {
  const escapedVersion = escapeRegularExpression(version);
  const headingPattern = new RegExp(`^## \\[${escapedVersion}\\](.*)$`, "gm");
  const headings = [...changelog.matchAll(headingPattern)];
  if (headings.length !== 1) {
    throw new Error(
      `CHANGELOG.md must contain exactly one heading for ${version}; found ${String(headings.length)}.`,
    );
  }

  const suffix = headings[0][1];
  const suffixMatch = /^ - (Unreleased|\d{4}-\d{2}-\d{2})$/.exec(suffix);
  if (!suffixMatch) {
    throw new Error(
      `CHANGELOG.md heading for ${version} must be Unreleased or use a YYYY-MM-DD date.`,
    );
  }
  if (requireDatedChangelog && suffixMatch[1] === "Unreleased") {
    throw new Error(
      `CHANGELOG.md must date ${version} and remove its Unreleased suffix.`,
    );
  }
}

function assertDocumentText(documents, field, filename) {
  const text = documents?.[field];
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error(
      `${filename} must exist and contain release-ready content.`,
    );
  }
  return text;
}

function assertNoOwnerPlaceholder(text, filename) {
  if (OWNER_PLACEHOLDER_PATTERN.test(text)) {
    throw new Error(
      `${filename} still contains unresolved public identity information.`,
    );
  }
}

function assertNoStalePublicationState(text, filename) {
  if (STALE_PUBLICATION_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error(
      `${filename} still contains a preparation-only publication status.`,
    );
  }
}

function assertCanonicalContact(text, filename) {
  assertNoOwnerPlaceholder(text, filename);
  const contacts = text.match(CONTACT_PATTERN) ?? [];
  if (
    contacts.length === 0 ||
    contacts.every((contact) => RESERVED_CONTACT_PATTERN.test(contact))
  ) {
    throw new Error(
      `${filename} must contain an owner-supplied canonical contact.`,
    );
  }
}

const PUBLIC_DOCUMENTS = [
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

function collectViolation(violations, validation) {
  try {
    validation();
  } catch (error) {
    violations.push(error instanceof Error ? error.message : String(error));
  }
}

function requireExact(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label} must equal ${expected}; received ${String(actual)}.`,
    );
  }
}

export function collectPublicPreviewViolations({
  documents = {},
  sourceManifest,
} = {}) {
  const violations = [];
  const documentText = new Map();

  for (const [field, filename] of PUBLIC_DOCUMENTS) {
    collectViolation(violations, () => {
      documentText.set(field, assertDocumentText(documents, field, filename));
    });
  }

  collectViolation(violations, () =>
    requireExact(
      sourceManifest?.name,
      CANONICAL_IDENTITY.packageName,
      "package.json name",
    ),
  );
  collectViolation(violations, () =>
    requireExact(
      sourceManifest?.author,
      CANONICAL_IDENTITY.author,
      "package.json author",
    ),
  );
  collectViolation(violations, () =>
    requireExact(
      sourceManifest?.homepage,
      CANONICAL_IDENTITY.homepage,
      "package.json homepage",
    ),
  );
  collectViolation(violations, () =>
    requireExact(
      sourceManifest?.repository?.type,
      "git",
      "package.json repository.type",
    ),
  );
  collectViolation(violations, () =>
    requireExact(
      sourceManifest?.repository?.url,
      CANONICAL_IDENTITY.repositoryUrl,
      "package.json repository.url",
    ),
  );
  collectViolation(violations, () =>
    requireExact(
      sourceManifest?.bugs?.url,
      CANONICAL_IDENTITY.bugsUrl,
      "package.json bugs.url",
    ),
  );

  const license = documentText.get("license");
  if (license !== undefined) {
    collectViolation(violations, () =>
      assertNoOwnerPlaceholder(license, "LICENSE"),
    );
    collectViolation(violations, () => {
      if (!license.includes(CANONICAL_IDENTITY.copyright)) {
        throw new Error(
          `LICENSE must contain ${CANONICAL_IDENTITY.copyright}.`,
        );
      }
    });
  }

  for (const [field, filename] of [
    ["conduct", "CODE_OF_CONDUCT.md"],
    ["security", "SECURITY.md"],
    ["support", "SUPPORT.md"],
  ]) {
    const text = documentText.get(field);
    if (text === undefined) continue;
    collectViolation(violations, () =>
      assertNoOwnerPlaceholder(text, filename),
    );
  }

  for (const [field, filename, expected] of [
    ["conduct", "CODE_OF_CONDUCT.md", CANONICAL_IDENTITY.supportEmail],
    ["security", "SECURITY.md", CANONICAL_IDENTITY.securityUrl],
    ["support", "SUPPORT.md", CANONICAL_IDENTITY.supportEmail],
    ["support", "SUPPORT.md", CANONICAL_IDENTITY.bugsUrl],
  ]) {
    const text = documentText.get(field);
    if (text === undefined) continue;
    collectViolation(violations, () => {
      if (!text.includes(expected)) {
        throw new Error(`${filename} must contain ${expected}.`);
      }
    });
  }

  for (const [field, filename] of PUBLIC_DOCUMENTS) {
    const text = documentText.get(field);
    if (text === undefined) continue;
    collectViolation(violations, () => {
      if (
        PREPARATION_NARRATIVE_PATTERNS.some((pattern) => pattern.test(text))
      ) {
        throw new Error(`${filename} contains preparation-only narrative.`);
      }
    });
  }

  return violations;
}

export function formatPublicPreviewViolations(violations) {
  return [
    `Public Preview content gate found ${String(violations.length)} violation(s):`,
    ...violations.map((violation) => `- ${violation}`),
  ].join("\n");
}

export function validatePublicPreviewDocuments(input) {
  const violations = collectPublicPreviewViolations(input);
  if (violations.length > 0) {
    throw new Error(formatPublicPreviewViolations(violations));
  }
}

function releaseChangelogSection(changelog, version) {
  const headingPattern = new RegExp(
    `^## \\[${escapeRegularExpression(version)}\\].*$`,
    "m",
  );
  const heading = headingPattern.exec(changelog);
  if (!heading) {
    throw new Error(`CHANGELOG.md has no release section for ${version}.`);
  }
  const remainder = changelog.slice(heading.index + heading[0].length);
  const nextHeading = /^## /m.exec(remainder);
  return nextHeading ? remainder.slice(0, nextHeading.index) : remainder;
}

export function validateReleasableDocuments({ changelog, documents, version }) {
  const license = assertDocumentText(documents, "license", "LICENSE");
  assertNoOwnerPlaceholder(license, "LICENSE");
  if (!/copyright\s+(?:\(c\)|©)?\s*\d{4}(?:-\d{4})?\s+\S+/i.test(license)) {
    throw new Error(
      "LICENSE must contain an owner-supplied copyright year and holder.",
    );
  }

  const readme = assertDocumentText(documents, "readme", "README.md");
  assertNoOwnerPlaceholder(readme, "README.md");
  assertNoStalePublicationState(readme, "README.md");
  const approvalPattern = new RegExp(
    `\\b${escapeRegularExpression(version)}\\s+is\\s+approved\\s+for\\s+npm\\s+publication\\b`,
    "i",
  );
  if (!approvalPattern.test(readme)) {
    throw new Error(
      "README.md must explicitly state '<version> is approved for npm publication' before tagging.",
    );
  }

  const security = assertDocumentText(documents, "security", "SECURITY.md");
  assertCanonicalContact(security, "SECURITY.md");
  assertNoStalePublicationState(security, "SECURITY.md");

  const support = assertDocumentText(documents, "support", "SUPPORT.md");
  assertCanonicalContact(support, "SUPPORT.md");
  assertNoStalePublicationState(support, "SUPPORT.md");

  const releaseSection = releaseChangelogSection(changelog, version);
  if (
    OWNER_PLACEHOLDER_PATTERN.test(releaseSection) ||
    STALE_CHANGELOG_PATTERNS.some((pattern) => pattern.test(releaseSection))
  ) {
    throw new Error(
      `CHANGELOG.md section for ${version} still contains candidate-only release evidence.`,
    );
  }
}

function validateReleasePleaseState({
  releaseConfig,
  releaseManifest,
  requireFinalReleaseState,
  version,
}) {
  const packageConfig = releaseConfig?.packages?.["."] ?? {};
  const manifestVersion = releaseManifest?.["."];
  const hasBootstrapVersion = Object.hasOwn(packageConfig, "release-as");
  const bootstrapVersion = packageConfig["release-as"];

  if (manifestVersion !== undefined) {
    assertVersion("Release Please manifest", manifestVersion, version);
  }
  if (hasBootstrapVersion) {
    assertVersion("Release Please bootstrap", bootstrapVersion, version);
  }

  if (requireFinalReleaseState) {
    if (manifestVersion !== version) {
      throw new Error(
        "Release Please manifest must record the release version before publication.",
      );
    }
    if (hasBootstrapVersion) {
      throw new Error(
        "The one-time Release Please release-as setting must be removed before publication.",
      );
    }
  } else if (manifestVersion !== version && bootstrapVersion !== version) {
    throw new Error(
      "Release Please must track the source version or explicitly bootstrap it with release-as.",
    );
  }
}

export function validateReleaseMetadata({
  artifactManifest,
  changelog,
  packageLock,
  releaseDocuments,
  releaseConfig,
  releaseIsPrerelease,
  releaseManifest,
  requireDatedChangelog = false,
  requireFinalReleaseState = false,
  requireReleasableDocs = false,
  sourceManifest,
  tag,
}) {
  const parsedVersion = parseSemanticVersion(sourceManifest?.version);
  const { isPrerelease, version } = parsedVersion;
  const name = sourceManifest?.name;
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("package.json name must be a non-empty string.");
  }

  if (tag !== undefined && tag !== `v${version}`) {
    throw new Error(
      `Release tag ${tag} does not match package version v${version}.`,
    );
  }

  if (
    releaseIsPrerelease !== undefined &&
    releaseIsPrerelease !== isPrerelease
  ) {
    throw new Error(
      isPrerelease
        ? "A prerelease package must use a GitHub prerelease."
        : "A stable package cannot use a GitHub prerelease.",
    );
  }

  assertSupportedNodeEngines(sourceManifest, "package.json");
  assertNoStaticDistTag(sourceManifest, "package.json");
  assertName("package-lock.json", packageLock?.name, name);
  assertName(
    'package-lock.json packages[""]',
    packageLock?.packages?.[""]?.name,
    name,
  );
  assertVersion("package-lock.json", packageLock?.version, version);
  assertVersion(
    'package-lock.json packages[""]',
    packageLock?.packages?.[""]?.version,
    version,
  );
  assertSupportedNodeEngines(
    packageLock?.packages?.[""],
    'package-lock.json packages[""]',
  );

  if (artifactManifest !== undefined) {
    assertVersion("Packed artifact", artifactManifest?.version, version);
    assertSupportedNodeEngines(artifactManifest, "Packed artifact");
    assertNoStaticDistTag(artifactManifest, "Packed artifact");
  }

  validateChangelog(changelog, version, requireDatedChangelog);
  validateReleasePleaseState({
    releaseConfig,
    releaseManifest,
    requireFinalReleaseState,
    version,
  });
  if (requireReleasableDocs) {
    validatePublicPreviewDocuments({
      documents: releaseDocuments,
      sourceManifest,
    });
    validateReleasableDocuments({
      changelog,
      documents: releaseDocuments,
      version,
    });
  }

  return {
    distTag: isPrerelease ? "next" : "latest",
    isPrerelease,
    version,
  };
}
