#!/usr/bin/env bash

set -euo pipefail

: "${DIST_TAG:?DIST_TAG is required}"
: "${VERSION:?VERSION is required}"

artifact_directory="${ARTIFACT_DIRECTORY:-release-artifacts}"

if [[ -n "${NODE_AUTH_TOKEN:-}" || -n "${NPM_TOKEN:-}" ]]; then
  echo "Registry tokens are forbidden; publication must use npm Trusted Publishing." >&2
  exit 1
fi

artifact_directory="$(cd "$artifact_directory" && pwd -P)"
shopt -s nullglob
tarballs=("$artifact_directory"/*.tgz)
if [[ "${#tarballs[@]}" -ne 1 ]]; then
  echo "Expected exactly one downloaded artifact, found ${#tarballs[@]}." >&2
  exit 1
fi

local_integrity="$(node -e 'const {createHash}=require("node:crypto");const {readFileSync}=require("node:fs");process.stdout.write("sha512-"+createHash("sha512").update(readFileSync(process.argv[1])).digest("base64"))' "${tarballs[0]}")"
view_error="$(mktemp)"
trap 'rm -f "$view_error"' EXIT

set +e
existing_dist="$(npm view "cometapi@${VERSION}" dist --json 2>"$view_error")"
view_status=$?
set -e

if [[ "$view_status" -eq 0 && -n "$existing_dist" ]]; then
  EXISTING_DIST="$existing_dist" LOCAL_INTEGRITY="$local_integrity" node <<'EOF'
const dist = JSON.parse(process.env.EXISTING_DIST);
if (dist.integrity !== process.env.LOCAL_INTEGRITY) {
  throw new Error("The existing registry version has different integrity.");
}
EOF
  echo "cometapi@${VERSION} already matches the verified artifact; resuming checks."
elif grep -q "E404" "$view_error"; then
  npm publish "${tarballs[0]}" --access public --provenance --tag "$DIST_TAG"
else
  echo "Unable to determine whether cometapi@${VERSION} already exists." >&2
  sed -n '1,20p' "$view_error" >&2
  exit 1
fi
