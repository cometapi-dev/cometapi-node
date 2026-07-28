import { fromMarkdown } from "mdast-util-from-markdown";

function normalizeExample(source) {
  return source.replaceAll("\r\n", "\n").replace(/\n$/, "");
}

function headingText(node) {
  return (node.children ?? [])
    .filter((child) => child.type === "text" || child.type === "inlineCode")
    .map((child) => child.value)
    .join("")
    .trim();
}

function canonicalBlock(root, title) {
  const matches = root.children
    .map((node, index) => ({ index, node }))
    .filter(
      ({ node }) =>
        node.type === "heading" &&
        node.depth === 2 &&
        headingText(node).toLowerCase() === title.toLowerCase(),
    );
  if (matches.length !== 1) {
    throw new Error(
      `README.md must contain exactly one H2 '${title}' section; found ${String(matches.length)}.`,
    );
  }

  const { index } = matches[0];
  const end = root.children.findIndex(
    (node, nodeIndex) =>
      nodeIndex > index && node.type === "heading" && node.depth <= 2,
  );
  const nodes = root.children.slice(index + 1, end === -1 ? undefined : end);
  const blocks = nodes.filter(
    (node) =>
      node.type === "code" && ["js", "javascript"].includes(node.lang ?? ""),
  );
  if (blocks.length !== 1) {
    throw new Error(
      `README.md '${title}' must contain exactly one JavaScript code block; found ${String(blocks.length)}.`,
    );
  }
  return blocks[0].value;
}

export function collectReadmeExampleViolations({ readme, esm, commonjs }) {
  const violations = [];
  let root;
  try {
    root = fromMarkdown(readme);
  } catch (error) {
    return [
      `README.md could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }

  for (const [title, source, filename] of [
    ["ESM quick start", esm, "examples/esm.mjs"],
    ["CommonJS quick start", commonjs, "examples/commonjs.cjs"],
  ]) {
    try {
      if (
        normalizeExample(canonicalBlock(root, title)) !==
        normalizeExample(source)
      ) {
        violations.push(`README.md '${title}' must match ${filename} exactly.`);
      }
    } catch (error) {
      violations.push(error instanceof Error ? error.message : String(error));
    }
  }
  return violations;
}
