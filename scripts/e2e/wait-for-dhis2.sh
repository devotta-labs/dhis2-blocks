#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

e2e_load_version "${1:-}"

username="${E2E_DHIS2_USERNAME:-admin}"
password="${E2E_DHIS2_PASSWORD:-district}"
timeout_seconds="${E2E_DHIS2_STARTUP_TIMEOUT_SECONDS:-900}"
deadline=$((SECONDS + timeout_seconds))
response_file="$(mktemp "${TMPDIR:-/tmp}/working-list-system-info.XXXXXX")"
trap 'rm -f "$response_file"' EXIT

echo "Waiting up to ${timeout_seconds}s for $E2E_DHIS2_URL ..."
until curl --fail --silent --show-error \
    --user "$username:$password" \
    --output "$response_file" \
    "$E2E_DHIS2_URL/api/system/info?fields=version,revision,buildTime"; do
    if ((SECONDS >= deadline)); then
        echo "DHIS2 did not become ready at $E2E_DHIS2_URL." >&2
        exit 70
    fi
    sleep 5
done

server_version="$(jq -er '.version' "$response_file")"
if [[ "$E2E_EXPECTED_MAJOR" != "dev" &&
    ! "$server_version" =~ ^(2\.)?${E2E_EXPECTED_MAJOR}([.-]|$) ]]; then
    echo "Expected DHIS2 major $E2E_EXPECTED_MAJOR, received $server_version." >&2
    exit 65
fi

if [[ "$E2E_EXPECTED_MAJOR" == "dev" ]]; then
    normalized_version="${server_version#2.}"
    server_major="${normalized_version%%[.-]*}"
    if [[ ! "$server_major" =~ ^[0-9]+$ ]] || ((server_major <= 43)); then
        echo "Expected a development server newer than DHIS2 43, received $server_version." >&2
        exit 65
    fi
fi

echo "DHIS2 $server_version is ready at $E2E_DHIS2_URL."
