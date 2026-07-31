#!/usr/bin/env bash

set -euo pipefail

: "${ATTESTATIONS_FILE:?ATTESTATIONS_FILE is required}"
: "${ATTESTATIONS_URL:?ATTESTATIONS_URL is required}"

connect_timeout="${ATTESTATION_CONNECT_TIMEOUT_SECONDS:-10}"
max_time="${ATTESTATION_MAX_TIME_SECONDS:-30}"
retry_count="${ATTESTATION_RETRY_COUNT:-59}"
retry_delay="${ATTESTATION_RETRY_DELAY_SECONDS:-10}"
retry_max_time="${ATTESTATION_RETRY_MAX_TIME_SECONDS:-600}"

for value in \
  "$connect_timeout" \
  "$max_time" \
  "$retry_count" \
  "$retry_delay" \
  "$retry_max_time"
do
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "Attestation retry settings must be non-negative integers." >&2
    exit 1
  fi
done

candidate="${ATTESTATIONS_FILE}.download"
if ! curl --fail --silent --show-error \
  --connect-timeout "$connect_timeout" \
  --max-time "$max_time" \
  --retry "$retry_count" \
  --retry-all-errors \
  --retry-delay "$retry_delay" \
  --retry-max-time "$retry_max_time" \
  --remove-on-error \
  --output "$candidate" \
  "$ATTESTATIONS_URL"
then
  echo "Registry attestations did not converge." >&2
  exit 1
fi

mv "$candidate" "$ATTESTATIONS_FILE"
