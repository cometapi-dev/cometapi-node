import { describe, expect, it } from "vitest";
import {
  isPatchedNodeVersion,
  MINIMUM_PATCHED_NODE_VERSIONS,
} from "../scripts/node-version-policy.mjs";

describe("patched Node.js runtime policy", () => {
  it.each([
    ["22", "22.23.4"],
    ["24", "24.22.1"],
    ["26", "26.12.1"],
  ])("accepts the minimum patch for Node %s", (major, version) => {
    expect(version).toBe(MINIMUM_PATCHED_NODE_VERSIONS[major]);
    expect(isPatchedNodeVersion(`v${version}`)).toBe(true);
  });

  it.each(["v22.23.3", "v24.22.0", "v26.12.0", "v20.20.0"])(
    "rejects %s",
    (version) => {
      expect(isPatchedNodeVersion(version)).toBe(false);
    },
  );
});
