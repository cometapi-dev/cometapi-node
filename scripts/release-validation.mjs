import { fromMarkdown } from "mdast-util-from-markdown";

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
export const SUPPORTED_OPENAI_RANGE = "^6.47.0";

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
const MARKDOWN_BLOCK_CONTAINERS = new Set([
  "blockquote",
  "list",
  "listItem",
  "root",
]);

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

function markdownNodeText(node, { includeLinkTargets = false } = {}) {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (node.type === "break") return "\n";
  if (
    node.type === "code" ||
    node.type === "definition" ||
    node.type === "html" ||
    node.type === "image" ||
    node.type === "imageReference" ||
    node.type === "thematicBreak"
  ) {
    return "";
  }

  const separator = MARKDOWN_BLOCK_CONTAINERS.has(node.type) ? "\n" : "";
  const text = Array.isArray(node.children)
    ? node.children
        .map((child) => markdownNodeText(child, { includeLinkTargets }))
        .join(separator)
    : "";
  if (node.type === "link" && includeLinkTargets) {
    return `${text} ${node.url}`.trim();
  }
  return text;
}

function parseMarkdownDocument(text) {
  const root = fromMarkdown(text);
  const headings = [];
  for (const [nodeIndex, node] of root.children.entries()) {
    if (node.type !== "heading") continue;
    headings.push({
      level: node.depth,
      nodeIndex,
      title: markdownNodeText(node).trim(),
    });
  }
  return {
    headings,
    referenceText: markdownNodeText(root, { includeLinkTargets: true }),
    root,
    text: markdownNodeText(root),
  };
}

export function visibleMarkdownText(text) {
  return parseMarkdownDocument(text).text;
}

function validateChangelog(changelog, version, requireDatedChangelog) {
  const escapedVersion = escapeRegularExpression(version);
  const headingPattern = new RegExp(`^\\[${escapedVersion}\\](.*)$`);
  const headings = markdownHeadings(parseMarkdownDocument(changelog)).filter(
    ({ level, title }) => level === 2 && headingPattern.test(title),
  );
  if (headings.length !== 1) {
    throw new Error(
      `CHANGELOG.md must contain exactly one heading for ${version}; found ${String(headings.length)}.`,
    );
  }

  const suffix = headingPattern.exec(headings[0].title)[1];
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

const DOCUMENT_HEADING_REQUIREMENTS = [
  [
    "agents",
    "AGENTS.md",
    [
      [
        /\b(?:agent instructions|engineering contract)\b/i,
        "an agent instructions title",
      ],
    ],
  ],
  [
    "architecture",
    "ARCHITECTURE.md",
    [
      [/^architecture$/i, "an Architecture title"],
      [/^0\.1 boundary$/i, "a 0.1 boundary section"],
    ],
  ],
  ["changelog", "CHANGELOG.md", [[/^changelog$/i, "a Changelog title"]]],
  [
    "compatibility",
    "COMPATIBILITY.md",
    [
      [/^compatibility$/i, "a Compatibility title"],
      [/^supported protocol surface$/i, "a supported protocol surface section"],
    ],
  ],
  [
    "conduct",
    "CODE_OF_CONDUCT.md",
    [
      [/^code of conduct$/i, "a Code of Conduct title"],
      [
        /^reporting(?: and enforcement)?$/i,
        "a reporting and enforcement section",
      ],
    ],
  ],
  [
    "contributing",
    "CONTRIBUTING.md",
    [
      [/^contributing$/i, "a Contributing title"],
      [
        /^(?:development setup|required checks)$/i,
        "a development setup or required checks section",
      ],
    ],
  ],
  [
    "releasing",
    "RELEASING.md",
    [
      [/^releasing$/i, "a Releasing title"],
      [/^authorization boundary$/i, "an authorization boundary section"],
    ],
  ],
  [
    "roadmap",
    "ROADMAP.md",
    [
      [/\broadmap$/i, "a Roadmap title"],
      [/^public preview$/i, "a Public Preview section"],
    ],
  ],
  [
    "security",
    "SECURITY.md",
    [
      [/^security policy$/i, "a Security Policy title"],
      [/^reporting a vulnerability$/i, "a vulnerability reporting section"],
    ],
  ],
  [
    "support",
    "SUPPORT.md",
    [
      [/^support$/i, "a Support title"],
      [/^getting help$/i, "a getting help section"],
    ],
  ],
];

const MIT_LICENSE_REQUIREMENTS = [
  [/^MIT License\s*$/im, "the MIT License title"],
  [
    /permission\s+is\s+hereby\s+granted,\s+free\s+of\s+charge,\s+to\s+any\s+person\s+obtaining\s+a\s+copy/i,
    "the MIT permission grant",
  ],
  [
    /the\s+software\s+is\s+provided\s+["']AS IS["']/i,
    'the MIT "AS IS" warranty disclaimer',
  ],
];

const README_OPERATIONS = [
  "chat.completions.create",
  "responses.create",
  "models.list",
];
const README_STREAMING_OPERATIONS = README_OPERATIONS.slice(0, 2);

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

function markdownHeadings(document) {
  return document.headings;
}

function hasMarkdownHeading(document, titlePattern) {
  return markdownHeadings(document).some(({ title }) =>
    titlePattern.test(title),
  );
}

function findMarkdownSection(document, titlePattern) {
  const headings = markdownHeadings(document);
  const headingIndex = headings.findIndex(({ title }) =>
    titlePattern.test(title),
  );
  if (headingIndex === -1) return undefined;

  const heading = headings[headingIndex];
  const nextHeading = headings
    .slice(headingIndex + 1)
    .find(({ level }) => level <= heading.level);
  const nodes = document.root.children.slice(
    heading.nodeIndex + 1,
    nextHeading?.nodeIndex,
  );
  return {
    nodes,
    text: nodes.map((node) => markdownNodeText(node)).join("\n"),
  };
}

function containsSubstantiveProse(text) {
  const prose = text.replace(/^\s{0,3}#{1,6}[ \t]+.*$/gm, "");
  return (prose.match(/[A-Za-z][A-Za-z'-]+/g) ?? []).length >= 3;
}

function markdownStatements(nodes) {
  const statements = [];
  const visit = (node) => {
    if (node.type === "code" || node.type === "html") return;
    if (node.type === "paragraph") {
      statements.push(markdownNodeText(node));
      return;
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return statements;
}

function containsExactOperation(text, operation) {
  const operationPattern = new RegExp(
    `(?:^|[^A-Za-z0-9_$.])${escapeRegularExpression(operation)}(?![A-Za-z0-9_$.])`,
  );
  return operationPattern.test(text);
}

function containsStreamingModes(text) {
  const nonStreamingPattern = /\bnon(?:-|\s)?streaming\b/i;
  return (
    nonStreamingPattern.test(text) &&
    /\bstreaming\b/i.test(text.replace(/\bnon(?:-|\s)?streaming\b/gi, ""))
  );
}

function containsOperationModes(section, operation) {
  return markdownStatements(section.nodes).some(
    (statement) =>
      containsExactOperation(statement, operation) &&
      containsStreamingModes(statement),
  );
}

function assertManifestKeyword(manifest, keyword) {
  const keywords = manifest?.keywords;
  if (
    !Array.isArray(keywords) ||
    !keywords.some(
      (value) => typeof value === "string" && value.toLowerCase() === keyword,
    )
  ) {
    throw new Error(`package.json keywords must contain ${keyword}.`);
  }
}

export function collectPublicPreviewViolations({
  documents = {},
  sourceManifest,
} = {}) {
  const violations = [];
  const markdownDocuments = new Map();
  const documentReferences = new Map();
  const documentText = new Map();

  for (const [field, filename] of PUBLIC_DOCUMENTS) {
    collectViolation(violations, () => {
      const text = assertDocumentText(documents, field, filename);
      if (filename.endsWith(".md")) {
        const document = parseMarkdownDocument(text);
        markdownDocuments.set(field, document);
        documentReferences.set(field, document.referenceText);
        documentText.set(field, document.text);
      } else {
        documentReferences.set(field, text);
        documentText.set(field, text);
      }
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
  for (const keyword of ["typescript", "nodejs"]) {
    collectViolation(violations, () =>
      assertManifestKeyword(sourceManifest, keyword),
    );
  }
  collectViolation(violations, () =>
    assertSupportedNodeEngines(sourceManifest, "package.json"),
  );
  collectViolation(violations, () =>
    requireExact(
      sourceManifest?.dependencies?.openai,
      SUPPORTED_OPENAI_RANGE,
      "package.json dependencies.openai",
    ),
  );

  for (const [field, filename, requirements] of DOCUMENT_HEADING_REQUIREMENTS) {
    const document = markdownDocuments.get(field);
    if (document === undefined) continue;
    for (const [
      requirementIndex,
      [titlePattern, description],
    ] of requirements.entries()) {
      collectViolation(violations, () => {
        if (!hasMarkdownHeading(document, titlePattern)) {
          throw new Error(`${filename} must contain ${description}.`);
        }
        if (
          requirementIndex > 0 &&
          !containsSubstantiveProse(
            findMarkdownSection(document, titlePattern)?.text ?? "",
          )
        ) {
          throw new Error(
            `${filename} must give ${description} substantive contract content.`,
          );
        }
      });
    }
  }

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
    for (const [pattern, description] of MIT_LICENSE_REQUIREMENTS) {
      collectViolation(violations, () => {
        if (!pattern.test(license)) {
          throw new Error(`LICENSE must contain ${description}.`);
        }
      });
    }
  }

  const readmeDocument = markdownDocuments.get("readme");
  if (readmeDocument !== undefined) {
    const firstSection = markdownHeadings(readmeDocument).find(
      ({ level, nodeIndex }) => nodeIndex > 0 && level >= 2,
    );
    const preamble = readmeDocument.root.children
      .slice(0, firstSection?.nodeIndex)
      .map((node) => markdownNodeText(node))
      .join("\n");
    collectViolation(violations, () => {
      if (!/\bpre(?:-|\s)?release\b/i.test(preamble)) {
        throw new Error(
          "README.md must label the project as a pre-release near the top of the document.",
        );
      }
    });

    const supportedSurface = findMarkdownSection(
      readmeDocument,
      /^(?=.*\b0\.1\b)(?=.*\bsupport(?:ed)?\b).+$/i,
    );
    collectViolation(violations, () => {
      if (supportedSurface === undefined) {
        throw new Error(
          "README.md must contain a supported 0.1 surface section.",
        );
      }
    });

    if (supportedSurface !== undefined) {
      for (const operation of README_OPERATIONS) {
        collectViolation(violations, () => {
          if (!containsExactOperation(supportedSurface.text, operation)) {
            throw new Error(
              `README.md supported 0.1 surface must contain the exact operation ${operation}.`,
            );
          }
        });
      }
      for (const operation of README_STREAMING_OPERATIONS) {
        collectViolation(violations, () => {
          if (!containsOperationModes(supportedSurface, operation)) {
            throw new Error(
              `README.md must describe ${operation} as streaming and non-streaming.`,
            );
          }
        });
      }
    }
  }

  for (const [field, filename] of [
    ["conduct", "CODE_OF_CONDUCT.md"],
    ["security", "SECURITY.md"],
    ["support", "SUPPORT.md"],
  ]) {
    const text = documentReferences.get(field);
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
    const text = documentReferences.get(field);
    if (text === undefined) continue;
    collectViolation(violations, () => {
      if (!text.includes(expected)) {
        throw new Error(`${filename} must contain ${expected}.`);
      }
    });
  }

  for (const [field, filename] of PUBLIC_DOCUMENTS) {
    const text = documentReferences.get(field);
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
  const document = parseMarkdownDocument(changelog);
  const headingPattern = new RegExp(
    `^\\[${escapeRegularExpression(version)}\\].*$`,
  );
  const heading = markdownHeadings(document).find(
    ({ level, title }) => level === 2 && headingPattern.test(title),
  );
  if (!heading) {
    throw new Error(`CHANGELOG.md has no release section for ${version}.`);
  }
  return findMarkdownSection(document, headingPattern)?.text ?? "";
}

export function validateReleasableDocuments({ changelog, documents, version }) {
  const license = assertDocumentText(documents, "license", "LICENSE");
  assertNoOwnerPlaceholder(license, "LICENSE");
  if (!/copyright\s+(?:\(c\)|©)?\s*\d{4}(?:-\d{4})?\s+\S+/i.test(license)) {
    throw new Error(
      "LICENSE must contain an owner-supplied copyright year and holder.",
    );
  }

  const readmeDocument = parseMarkdownDocument(
    assertDocumentText(documents, "readme", "README.md"),
  );
  assertNoOwnerPlaceholder(readmeDocument.referenceText, "README.md");
  assertNoStalePublicationState(readmeDocument.text, "README.md");
  const approvalPattern = new RegExp(
    `\\b${escapeRegularExpression(version)}\\s+is\\s+approved\\s+for\\s+npm\\s+publication\\b`,
    "i",
  );
  if (!approvalPattern.test(readmeDocument.text)) {
    throw new Error(
      "README.md must explicitly state '<version> is approved for npm publication' before tagging.",
    );
  }

  const securityDocument = parseMarkdownDocument(
    assertDocumentText(documents, "security", "SECURITY.md"),
  );
  assertCanonicalContact(securityDocument.referenceText, "SECURITY.md");
  assertNoStalePublicationState(securityDocument.text, "SECURITY.md");

  const supportDocument = parseMarkdownDocument(
    assertDocumentText(documents, "support", "SUPPORT.md"),
  );
  assertCanonicalContact(supportDocument.referenceText, "SUPPORT.md");
  assertNoStalePublicationState(supportDocument.text, "SUPPORT.md");

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
