import {
  isPatchedNodeVersion,
  MINIMUM_PATCHED_NODE_VERSIONS,
} from "./node-version-policy.mjs";

const version = `v${process.versions.node}`;
if (!isPatchedNodeVersion(version)) {
  console.error(
    `Node.js ${version} is below the patched runtime floor (22 >= ${MINIMUM_PATCHED_NODE_VERSIONS[22]}, 24 >= ${MINIMUM_PATCHED_NODE_VERSIONS[24]}, 26 >= ${MINIMUM_PATCHED_NODE_VERSIONS[26]}).`,
  );
  process.exit(1);
}
console.log(`Node.js runtime ${version} satisfies the patched security floor.`);
