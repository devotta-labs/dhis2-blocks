#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

e2e_load_version "${1:-}"
e2e_require_command curl
e2e_require_command docker
e2e_require_command jq

username="${E2E_DHIS2_USERNAME:-admin}"
password="${E2E_DHIS2_PASSWORD:-district}"
artifact_dir="$(e2e_artifact_dir)"
metadata_response="$artifact_dir/metadata-import.json"
tracker_response="$artifact_dir/tracker-import.json"
cors_response="$artifact_dir/cors-allowlist.json"
users_payload="$E2E_REPO_ROOT/e2e/metadata/working-list-users.json"
saved_lists_payload="$E2E_REPO_ROOT/e2e/metadata/working-list-saved-lists.json"
metadata_payload="$E2E_REPO_ROOT/e2e/metadata/working-list-metadata.json"
tracker_payload="$E2E_REPO_ROOT/e2e/metadata/working-list-tracker-data.json"
setup_payload="$E2E_REPO_ROOT/e2e/metadata/working-list-setup.json"
program_id="$(jq -er '.programs[0].id' "$metadata_payload")"
owner_username="$(jq -er '.users[] | select(.surname == "Owner") | .username' "$users_payload")"
owner_password="$(jq -er '.users[] | select(.surname == "Owner") | .password' "$users_payload")"

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

request_json_require_2xx() {
    local method="$1"
    local endpoint="$2"
    local request_body="$3"
    local response_file="$4"
    local request_username="${5:-$username}"
    local request_password="${6:-$password}"
    local http_status

    http_status="$(curl --silent --show-error \
        --user "$request_username:$request_password" \
        --header 'Content-Type: application/json' \
        --request "$method" \
        --data-binary "$request_body" \
        --output "$response_file" \
        --write-out '%{http_code}' \
        "$E2E_DHIS2_URL$endpoint")"

    if [[ ! "$http_status" =~ ^2[0-9][0-9]$ ]]; then
        echo "$method $endpoint returned HTTP $http_status. Response saved to $response_file" >&2
        jq . "$response_file" >&2 || true
        return 65
    fi
}

resource_status() {
    local endpoint="$1"
    local request_username="${2:-$username}"
    local request_password="${3:-$password}"

    curl --silent --show-error \
        --user "$request_username:$request_password" \
        --output /dev/null \
        --write-out '%{http_code}' \
        "$E2E_DHIS2_URL$endpoint"
}

ensure_test_users() {
    local user_id
    local user_payload
    local user_status
    local user_response
    local test_username test_user_password group_id

    while IFS= read -r user_id; do
        user_payload="$(jq --compact-output --arg id "$user_id" \
            '.users[] | select(.id == $id)' "$users_payload")"
        test_username="$(jq --raw-output '.username' <<<"$user_payload")"
        test_user_password="$(jq --raw-output '.password' <<<"$user_payload")"
        user_response="$artifact_dir/user-$user_id.json"
        user_status="$(resource_status "/api/users/$user_id")"

        case "$user_status" in
            200)
                curl --fail --silent --show-error --globoff \
                    --user "$username:$password" \
                    --output "$user_response" \
                    "$E2E_DHIS2_URL/api/users/$user_id?fields=id,username,userRoles[id],userGroups[id],organisationUnits[id]"
                ;;
            404)
                request_json_require_2xx \
                    POST '/api/users' "$user_payload" "$user_response"
                ;;
            *)
                echo "Could not determine whether test user $user_id exists (HTTP $user_status)." >&2
                return 65
                ;;
        esac

        curl --fail --silent --show-error \
            --user "$test_username:$test_user_password" \
            "$E2E_DHIS2_URL/api/me?fields=id,username" \
            | jq -e --arg id "$user_id" --arg username "$test_username" \
                '.id == $id and .username == $username' >/dev/null
        while IFS= read -r group_id; do
            if ! curl --fail --silent --show-error --globoff \
                --user "$username:$password" \
                "$E2E_DHIS2_URL/api/userGroups/$group_id?fields=users[id]" \
                | jq -e --arg id "$user_id" '.users | any(.id == $id)' >/dev/null; then
                request_json_require_2xx POST \
                    "/api/userGroups/$group_id/users/$user_id" '{}' \
                    "$artifact_dir/user-group-membership-$user_id.json"
            fi
            curl --fail --silent --show-error --globoff \
                --user "$username:$password" \
                "$E2E_DHIS2_URL/api/users/$user_id?fields=userGroups[id]" \
                | jq -e --arg id "$group_id" '.userGroups | any(.id == $id)' >/dev/null
        done < <(jq --raw-output '.userGroups[].id' <<<"$user_payload")
    done < <(jq --raw-output '.users[].id' "$users_payload")
}

ensure_saved_lists() {
    local list_id
    local list_resource
    local list_payload
    local list_status
    local list_response
    local sharing_payload
    local encoded_filter sharing_resource sharing_id reader_username reader_password outsider_username outsider_password
    encoded_filter="$(jq -rn --arg id "$program_id" '"program.id:eq:\($id)" | @uri')"
    sharing_resource="$(jq -er '.sharing.resource' "$saved_lists_payload")"
    sharing_id="$(jq -er '.sharing.id' "$saved_lists_payload")"
    reader_username="$(jq -er '.users[] | select(.surname == "Reader") | .username' "$users_payload")"
    reader_password="$(jq -er '.users[] | select(.surname == "Reader") | .password' "$users_payload")"
    outsider_username="$(jq -er '.users[] | select(.surname == "Outsider") | .username' "$users_payload")"
    outsider_password="$(jq -er '.users[] | select(.surname == "Outsider") | .password' "$users_payload")"

    while IFS= read -r list_id; do
        list_payload="$(jq --compact-output --arg id "$list_id" \
            '.lists[] | select(.id == $id)' "$saved_lists_payload")"
        list_resource="$(jq --raw-output '.resource' <<<"$list_payload")"
        list_response="$artifact_dir/saved-list-$list_id.json"
        list_status="$(resource_status "/api/$list_resource/$list_id" "$owner_username" "$owner_password")"

        case "$list_status" in
            200)
                request_json_require_2xx \
                    PUT "/api/$list_resource/$list_id" \
                    "$(jq --compact-output '.data' <<<"$list_payload")" \
                    "$list_response" \
                    "$owner_username" "$owner_password"
                ;;
            404)
                request_json_require_2xx \
                    POST "/api/$list_resource" \
                    "$(jq --compact-output '.data' <<<"$list_payload")" \
                    "$list_response" \
                    "$owner_username" "$owner_password"
                ;;
            *)
                echo "Could not determine whether saved list $list_id exists (HTTP $list_status)." >&2
                return 65
                ;;
        esac
    done < <(jq --raw-output '.lists[].id' "$saved_lists_payload")

    sharing_payload="$(jq --compact-output \
        '{object: {
            publicAccess: .sharing.publicAccess,
            externalAccess: false,
            userGroupAccesses: .sharing.userGroupAccesses,
            userAccesses: .sharing.userAccesses
        }}' "$saved_lists_payload")"
    request_json_require_2xx \
        POST \
        "/api/sharing?type=$sharing_resource&id=$sharing_id" \
        "$sharing_payload" \
        "$artifact_dir/saved-list-sharing.json" \
        "$owner_username" "$owner_password"

    curl --fail --silent --show-error --globoff \
        --user "$owner_username:$owner_password" \
        "$E2E_DHIS2_URL/api/trackedEntityInstanceFilters?filter=$encoded_filter&fields=id&paging=false" \
        | jq -e --slurpfile seed "$saved_lists_payload" '[.trackedEntityInstanceFilters[].id] | sort == ($seed[0].lists | map(.id) | sort)' >/dev/null
    curl --fail --silent --show-error --globoff \
        --user "$reader_username:$reader_password" \
        "$E2E_DHIS2_URL/api/trackedEntityInstanceFilters?filter=$encoded_filter&fields=id&paging=false" \
        | jq -e --arg id "$sharing_id" '[.trackedEntityInstanceFilters[].id] == [$id]' >/dev/null
    curl --fail --silent --show-error --globoff \
        --user "$outsider_username:$outsider_password" \
        "$E2E_DHIS2_URL/api/trackedEntityInstanceFilters?filter=$encoded_filter&fields=id&paging=false" \
        | jq -e '.trackedEntityInstanceFilters | length == 0' >/dev/null
}

# The tracker importer validates values, so the deliberately invalid
# data-quality fixture has to bypass it — exactly how bad values reach real
# databases (SQL imports). The tracker import above resets the value on every
# seed run, so re-corrupting here keeps the step idempotent. Matching on the
# attribute plus the entity's unique seeded value avoids the tracked-entity
# tables that were renamed across DHIS2 majors.
corrupt_data_quality_fixture() {
    local corrupted_value seeded_value attribute_id entity_id
    corrupted_value="$(jq -er '.invalidDate.value' "$setup_payload")"
    attribute_id="$(jq -er '.invalidDate.attribute' "$setup_payload")"
    entity_id="$(jq -er '.invalidDate.trackedEntity' "$setup_payload")"
    seeded_value="$(jq -er --arg entity "$entity_id" --arg attribute "$attribute_id" \
        '.trackedEntities[] | select(.trackedEntity == $entity) | .attributes[] | select(.attribute == $attribute) | .value' "$tracker_payload")"
    if [[ ! "$attribute_id" =~ ^[A-Za-z][A-Za-z0-9]{10}$ ||
        ! "$corrupted_value" =~ ^[0-9-]+$ || ! "$seeded_value" =~ ^[0-9-]+$ ]]; then
        echo "Invalid SQL date fixture setup." >&2
        return 65
    fi

    e2e_compose exec -T database psql \
        --no-password --quiet --username dhis --dbname dhis \
        --set ON_ERROR_STOP=1 \
        --command "UPDATE trackedentityattributevalue
            SET value = '$corrupted_value'
            WHERE trackedentityattributeid = (
                SELECT trackedentityattributeid
                FROM trackedentityattribute
                WHERE uid = '$attribute_id'
            )
            AND value IN ('$seeded_value', '$corrupted_value');"

    curl --fail --silent --show-error --globoff \
        --user "$username:$password" \
        "$E2E_DHIS2_URL/api/tracker/trackedEntities/$entity_id?program=$program_id&fields=attributes[attribute,value]" \
        | jq -e --arg value "$corrupted_value" --arg attribute "$attribute_id" \
            '.attributes | any(.attribute == $attribute and .value == $value)' >/dev/null
}

echo "Importing idempotent working-list metadata into DHIS2 $E2E_VERSION_SLUG ..."
echo "Allowing the isolated browser origin $E2E_APP_URL ..."
configure_cors_allowlist

post_and_require_ok \
    '/api/metadata?importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&importReportMode=ERRORS' \
    "$metadata_payload" \
    "$metadata_response"

echo "Creating idempotent non-admin permission fixtures ..."
ensure_test_users
ensure_saved_lists

echo "Importing idempotent tracker records ..."
post_and_require_ok \
    '/api/tracker?async=false&importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&reportMode=FULL' \
    "$tracker_payload" \
    "$tracker_response"

curl --fail --silent --show-error \
    --user "$username:$password" \
    "$E2E_DHIS2_URL/api/programs/$program_id?fields=id,programType" \
    | jq -e --arg id "$program_id" '.id == $id and .programType == "WITH_REGISTRATION"' >/dev/null

echo "Corrupting one attribute value behind the importer's back ..."
corrupt_data_quality_fixture

echo "Supplemental working-list metadata and records are ready."
