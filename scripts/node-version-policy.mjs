const minimums = Object.freeze({
  22: Object.freeze([22, 23, 4]),
  24: Object.freeze([24, 22, 1]),
  26: Object.freeze([26, 12, 1]),
});

export const MINIMUM_PATCHED_NODE_VERSIONS = Object.freeze({
  22: "22.23.4",
  24: "24.22.1",
  26: "26.12.1",
});

export function parseNodeVersion(value) {
  const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)$/.exec(value ?? "");
  if (!match) return null;
  return match.slice(1).map(Number);
}

export function isPatchedNodeVersion(
  value,
  allowedMajors = Object.keys(minimums),
) {
  const parsed = parseNodeVersion(value);
  if (!parsed || !allowedMajors.map(Number).includes(parsed[0])) return false;
  const minimum = minimums[parsed[0]];
  return (
    parsed[1] > minimum[1] ||
    (parsed[1] === minimum[1] && parsed[2] >= minimum[2])
  );
}
