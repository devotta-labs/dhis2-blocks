#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

e2e_load_version "${1:-}"
e2e_require_command curl
e2e_require_command jq

username="${E2E_DHIS2_USERNAME:-admin}"
password="${E2E_DHIS2_PASSWORD:-district}"
artifact_dir="$(e2e_artifact_dir)"
metadata_response="$artifact_dir/metadata-import.json"
tracker_response="$artifact_dir/tracker-import.json"
cors_response="$artifact_dir/cors-allowlist.json"

configure_cors_allowlist() {
    local current_allowlist
    local desired_allowlist
    local http_status

    current_allowlist="$(curl --fail --silent --show-error \
        --user "$username:$password" \
        "$E2E_DHIS2_URL/api/configuration/corsAllowlist")"
    desired_allowlist="$(jq --compact-output --arg origin "$E2E_APP_URL" \
        '. + [$origin] | unique' <<<"$current_allowlist")"

    if ! jq -e --arg origin "$E2E_APP_URL" 'index($origin) != null' \
        <<<"$current_allowlist" >/dev/null; then
        http_status="$(curl --silent --show-error \
            --user "$username:$password" \
            --header 'Content-Type: application/json' \
            --request POST \
            --data-binary "$desired_allowlist" \
            --output /dev/null \
            --write-out '%{http_code}' \
            "$E2E_DHIS2_URL/api/configuration/corsAllowlist")"

        if [[ ! "$http_status" =~ ^2[0-9][0-9]$ ]]; then
            echo "Could not add $E2E_APP_URL to the DHIS2 CORS allowlist (HTTP $http_status)." >&2
            return 65
        fi
    fi

    curl --fail --silent --show-error \
        --user "$username:$password" \
        --output "$cors_response" \
        "$E2E_DHIS2_URL/api/configuration/corsAllowlist"
    jq -e --arg origin "$E2E_APP_URL" 'index($origin) != null' \
        "$cors_response" >/dev/null
}

post_and_require_ok() {
    local endpoint="$1"
    local payload="$2"
    local response_file="$3"
    local http_status

    http_status="$(curl --silent --show-error \
        --user "$username:$password" \
        --header 'Content-Type: application/json' \
        --request POST \
        --data-binary "@$payload" \
        --output "$response_file" \
        --write-out '%{http_code}' \
        "$E2E_DHIS2_URL$endpoint")"

    if [[ ! "$http_status" =~ ^2[0-9][0-9]$ ]]; then
        echo "DHIS2 import returned HTTP $http_status. Response saved to $response_file" >&2
        jq . "$response_file" >&2 || true
        return 65
    fi

    if ! jq -e '(.status // .response.status) == "OK"' "$response_file" >/dev/null; then
        echo "DHIS2 import failed. Response saved to $response_file" >&2
        jq . "$response_file" >&2 || true
        return 65
    fi
}

echo "Importing idempotent patient-list metadata into DHIS2 $E2E_VERSION_SLUG ..."
echo "Allowing the isolated browser origin $E2E_APP_URL ..."
configure_cors_allowlist

post_and_require_ok \
    '/api/metadata?importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&importReportMode=ERRORS' \
    "$E2E_REPO_ROOT/e2e/metadata/patient-list-metadata.json" \
    "$metadata_response"

echo "Importing idempotent tracker records ..."
post_and_require_ok \
    '/api/tracker?async=false&importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&reportMode=FULL' \
    "$E2E_REPO_ROOT/e2e/metadata/patient-list-tracker-data.json" \
    "$tracker_response"

echo "Importing the child immunisation register program and children ..."
post_and_require_ok \
    '/api/metadata?importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&importReportMode=ERRORS' \
    "$E2E_REPO_ROOT/e2e/metadata/immunisation-metadata.json" \
    "$artifact_dir/immunisation-metadata-import.json"
post_and_require_ok \
    '/api/tracker?async=false&importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&reportMode=FULL' \
    "$E2E_REPO_ROOT/e2e/metadata/immunisation-tracker-data.json" \
    "$artifact_dir/immunisation-tracker-import.json"

curl --fail --silent --show-error \
    --user "$username:$password" \
    "$E2E_DHIS2_URL/api/programs/WlE2ePrg001?fields=id,programType" \
    | jq -e '.id == "WlE2ePrg001" and .programType == "WITH_REGISTRATION"' >/dev/null

echo "Supplemental patient-list metadata and records are ready."
