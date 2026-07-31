#!/usr/bin/env bash

set -euo pipefail

monotonic_milliseconds() {
  perl -MTime::HiRes=clock_gettime,CLOCK_MONOTONIC \
    -e 'printf "%d", int(clock_gettime(CLOCK_MONOTONIC) * 1000)'
}

format_milliseconds() {
  local milliseconds="$1"
  printf '%d.%03d' \
    "$((milliseconds / 1000))" \
    "$((milliseconds % 1000))"
}

started_at="$(monotonic_milliseconds)"

: "${ATTESTATIONS_FILE:?ATTESTATIONS_FILE is required}"
: "${ATTESTATIONS_URL:?ATTESTATIONS_URL is required}"
if [[ -e "$ATTESTATIONS_FILE" || -L "$ATTESTATIONS_FILE" ]]; then
  echo "The attestation output path must not already exist." >&2
  exit 1
fi

connect_timeout="${ATTESTATION_CONNECT_TIMEOUT_SECONDS:-10}"
deadline="${ATTESTATION_DEADLINE_SECONDS:-600}"
max_time="${ATTESTATION_MAX_TIME_SECONDS:-30}"
retry_count="${ATTESTATION_RETRY_COUNT:-59}"
retry_delay="${ATTESTATION_RETRY_DELAY_SECONDS:-10}"

for value in \
  "$connect_timeout" \
  "$deadline" \
  "$max_time" \
  "$retry_count" \
  "$retry_delay"
do
  if ! [[ "$value" =~ ^(0|[1-9][0-9]*)$ ]]; then
    echo "Attestation retry settings must be non-negative integers." >&2
    exit 1
  fi
done
for value in "$connect_timeout" "$deadline" "$max_time"; do
  if [[ "$value" -eq 0 ]]; then
    echo "Attestation timeout settings must be positive integers." >&2
    exit 1
  fi
done
if [[ "$deadline" -gt 600 ]]; then
  echo "The attestation deadline must not exceed 600 seconds." >&2
  exit 1
fi
for value in "$connect_timeout" "$max_time" "$retry_count" "$retry_delay"
do
  if [[ "$value" -gt 600 ]]; then
    echo "Attestation retry settings must not exceed 600." >&2
    exit 1
  fi
done

deadline_milliseconds=$((deadline * 1000))
connect_timeout_milliseconds=$((connect_timeout * 1000))
max_time_milliseconds=$((max_time * 1000))
retry_delay_milliseconds=$((retry_delay * 1000))
candidate=""
complete="false"
installed="false"
cleanup_candidate() {
  if [[ -n "$candidate" ]]; then
    rm -f -- "$candidate"
  fi
  if [[ "$installed" == "true" && "$complete" != "true" ]]; then
    rm -f -- "$ATTESTATIONS_FILE"
  fi
}
trap cleanup_candidate EXIT
trap 'exit 1' HUP INT TERM

for ((attempt = 0; attempt <= retry_count; attempt += 1)); do
  now="$(monotonic_milliseconds)"
  remaining=$((deadline_milliseconds - (now - started_at)))
  if [[ "$remaining" -le 0 ]]; then
    break
  fi
  request_connect_timeout="$connect_timeout_milliseconds"
  request_max_time="$max_time_milliseconds"
  if [[ "$request_connect_timeout" -gt "$remaining" ]]; then
    request_connect_timeout="$remaining"
  fi
  if [[ "$request_max_time" -gt "$remaining" ]]; then
    request_max_time="$remaining"
  fi

  candidate="${ATTESTATIONS_FILE}.download.${attempt}"
  if curl --fail --silent --show-error \
    --connect-timeout "$(format_milliseconds "$request_connect_timeout")" \
    --max-time "$(format_milliseconds "$request_max_time")" \
    --remove-on-error \
    --output "$candidate" \
    "$ATTESTATIONS_URL"
  then
    now="$(monotonic_milliseconds)"
    if [[ $((now - started_at)) -ge "$deadline_milliseconds" ]]; then
      break
    fi
    mv "$candidate" "$ATTESTATIONS_FILE"
    installed="true"
    now="$(monotonic_milliseconds)"
    if [[ $((now - started_at)) -ge "$deadline_milliseconds" ]]; then
      rm -f -- "$ATTESTATIONS_FILE"
      candidate=""
      installed="false"
      break
    fi
    candidate=""
    complete="true"
    exit 0
  fi
  rm -f -- "$candidate"
  candidate=""

  now="$(monotonic_milliseconds)"
  remaining=$((deadline_milliseconds - (now - started_at)))
  if [[ "$attempt" -eq "$retry_count" || "$remaining" -le 0 ]]; then
    break
  fi
  delay="$retry_delay_milliseconds"
  if [[ "$delay" -gt "$remaining" ]]; then
    delay="$remaining"
  fi
  if [[ "$delay" -gt 0 ]]; then
    sleep "$(format_milliseconds "$delay")"
  fi
done

echo "Registry attestations did not converge." >&2
exit 1
