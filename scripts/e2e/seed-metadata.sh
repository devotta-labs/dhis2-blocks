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
test_user_password='WorkingList123!'
ter_users_payload="$E2E_REPO_ROOT/e2e/metadata/tracked-entity-record-users.json"
ter_tracker_payload="$E2E_REPO_ROOT/e2e/metadata/tracked-entity-record-tracker-data.json"
ter_user_password='TrackedEntity123!'
# The person whose only enrollment is created and then deleted, so the owner row
# outlives it (tracked entity record spec section 7.3).
ter_deleted_enrollment='TrE2eEnr006'

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

# Creates every user in a payload file that does not exist yet, then proves each
# one can authenticate with the shared test password.
ensure_users_from_payload() {
    local payload_file="$1"
    local shared_password="$2"
    local user_id
    local user_payload
    local user_status
    local user_response
    local test_username

    while IFS= read -r user_id; do
        user_payload="$(jq --compact-output --arg id "$user_id" \
            '.users[] | select(.id == $id)' "$payload_file")"
        test_username="$(jq --raw-output '.username' <<<"$user_payload")"
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
            --user "$test_username:$shared_password" \
            "$E2E_DHIS2_URL/api/me?fields=id,username" \
            | jq -e --arg id "$user_id" --arg username "$test_username" \
                '.id == $id and .username == $username' >/dev/null
    done < <(jq --raw-output '.users[].id' "$payload_file")
}

ensure_test_users() {
    ensure_users_from_payload "$users_payload" "$test_user_password"

    if ! curl --fail --silent --show-error --globoff \
        --user "$username:$password" \
        "$E2E_DHIS2_URL/api/userGroups/WlE2eGrp001?fields=users[id]" \
        | jq -e '.users | any(.id == "WlE2eUsr002")' >/dev/null; then
        request_json_require_2xx \
            POST \
            '/api/userGroups/WlE2eGrp001/users/WlE2eUsr002' \
            '{}' \
            "$artifact_dir/user-group-membership.json"
    fi

    curl --fail --silent --show-error --globoff \
        --user "$username:$password" \
        "$E2E_DHIS2_URL/api/users/WlE2eUsr002?fields=userGroups[id]" \
        | jq -e '.userGroups | any(.id == "WlE2eGrp001")' >/dev/null
}

ensure_saved_lists() {
    local list_id
    local list_resource
    local list_payload
    local list_status
    local list_response
    local sharing_payload
    local encoded_filter='program.id%3Aeq%3AWlE2ePrg001'

    while IFS= read -r list_id; do
        list_payload="$(jq --compact-output --arg id "$list_id" \
            '.lists[] | select(.id == $id)' "$saved_lists_payload")"
        list_resource="$(jq --raw-output '.resource' <<<"$list_payload")"
        list_response="$artifact_dir/saved-list-$list_id.json"
        list_status="$(resource_status "/api/$list_resource/$list_id" wl_e2e_owner "$test_user_password")"

        case "$list_status" in
            200) ;;
            404)
                request_json_require_2xx \
                    POST "/api/$list_resource" \
                    "$(jq --compact-output '.data' <<<"$list_payload")" \
                    "$list_response" \
                    wl_e2e_owner "$test_user_password"
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
        '/api/sharing?type=trackedEntityInstanceFilter&id=WlE2eLst002' \
        "$sharing_payload" \
        "$artifact_dir/saved-list-sharing.json" \
        wl_e2e_owner "$test_user_password"

    curl --fail --silent --show-error --globoff \
        --user "wl_e2e_owner:$test_user_password" \
        "$E2E_DHIS2_URL/api/trackedEntityInstanceFilters?filter=$encoded_filter&fields=id&paging=false" \
        | jq -e '[.trackedEntityInstanceFilters[].id] | sort == ["WlE2eLst001", "WlE2eLst002", "WlE2eLst003"]' >/dev/null
    curl --fail --silent --show-error --globoff \
        --user "wl_e2e_reader:$test_user_password" \
        "$E2E_DHIS2_URL/api/trackedEntityInstanceFilters?filter=$encoded_filter&fields=id&paging=false" \
        | jq -e '[.trackedEntityInstanceFilters[].id] == ["WlE2eLst002"]' >/dev/null
    curl --fail --silent --show-error --globoff \
        --user "wl_e2e_outsider:$test_user_password" \
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
    local corrupted_value='2025-13-45'
    local seeded_value='2025-01-02'

    e2e_compose exec -T database psql \
        --no-password --quiet --username dhis --dbname dhis \
        --set ON_ERROR_STOP=1 \
        --command "UPDATE trackedentityattributevalue
            SET value = '$corrupted_value'
            WHERE trackedentityattributeid = (
                SELECT trackedentityattributeid
                FROM trackedentityattribute
                WHERE uid = 'WlAtDate001'
            )
            AND value IN ('$seeded_value', '$corrupted_value');"

    curl --fail --silent --show-error --globoff \
        --user "$username:$password" \
        "$E2E_DHIS2_URL/api/tracker/trackedEntities/WlE2eTei002?program=WlE2ePrg001&fields=attributes[attribute,value]" \
        | jq -e --arg value "$corrupted_value" \
            '.attributes | any(.attribute == "WlAtDate001" and .value == $value)' >/dev/null
}

# Deleted tracker objects keep their uid, so the enrollment that gets deleted
# cannot go through the plain CREATE_AND_UPDATE import: it would fail on the
# second run. It is created once (CREATE refuses a uid that ever existed, with
# E1080 or E1113), then deleted, leaving the person's owner row for the program
# behind.
ensure_deleted_enrollment() {
    local enrollment_id="$ter_deleted_enrollment"
    local create_payload="$artifact_dir/ter-deleted-enrollment-create.json"
    local delete_payload="$artifact_dir/ter-deleted-enrollment-delete.json"
    local create_response="$artifact_dir/ter-deleted-enrollment-create-response.json"
    local enrollment_status
    local create_status

    jq --compact-output --arg id "$enrollment_id" \
        '{enrollments: [.enrollments[] | select(.enrollment == $id)]}' \
        "$ter_tracker_payload" >"$create_payload"
    jq --null-input --compact-output --arg id "$enrollment_id" \
        '{enrollments: [{enrollment: $id}]}' >"$delete_payload"

    enrollment_status="$(resource_status "/api/tracker/enrollments/$enrollment_id")"
    if [[ "$enrollment_status" == "404" ]]; then
        create_status="$(curl --silent --show-error \
            --user "$username:$password" \
            --header 'Content-Type: application/json' \
            --request POST \
            --data-binary "@$create_payload" \
            --output "$create_response" \
            --write-out '%{http_code}' \
            "$E2E_DHIS2_URL/api/tracker?async=false&importStrategy=CREATE&atomicMode=ALL&reportMode=FULL")"

        if jq -e '.status == "OK"' "$create_response" >/dev/null 2>&1; then
            enrollment_status=200
        elif jq -e 'any(.validationReport.errorReports[]?; .errorCode == "E1080" or .errorCode == "E1113")' \
            "$create_response" >/dev/null 2>&1; then
            # E1080 (uid exists) or E1113 (uid already deleted): an earlier run created and deleted it.
            enrollment_status=404
        else
            echo "Could not create enrollment $enrollment_id (HTTP $create_status). Response saved to $create_response" >&2
            jq . "$create_response" >&2 || true
            return 65
        fi
    fi

    if [[ "$enrollment_status" == "200" ]]; then
        post_and_require_ok \
            '/api/tracker?async=false&importStrategy=DELETE&atomicMode=ALL&reportMode=FULL' \
            "$delete_payload" \
            "$artifact_dir/ter-deleted-enrollment-delete-response.json"
    elif [[ "$enrollment_status" != "404" ]]; then
        echo "Could not determine whether enrollment $enrollment_id exists (HTTP $enrollment_status)." >&2
        return 65
    fi

    [[ "$(resource_status "/api/tracker/enrollments/$enrollment_id")" == "404" ]]
}

# The tracker importer drops a data value sent as "", but older clients and SQL
# imports leave empty strings in real databases. The tracker import removes the
# value on every seed run, so writing it back keeps the step idempotent. The
# tables holding event data values changed across DHIS2 majors (one `event`
# table, then `trackerevent` and `singleevent` from 2.43), so every table with
# the column is updated; only the one holding the event matches. The API then
# lists the data element without a `value` key, so the check treats a missing
# value as empty.
store_empty_event_data_value() {
    e2e_compose exec -T database psql \
        --no-password --quiet --username dhis --dbname dhis \
        --set ON_ERROR_STOP=1 \
        --command "DO \$\$
            DECLARE event_table text;
            BEGIN
                FOR event_table IN
                    SELECT table_name
                    FROM information_schema.columns
                    WHERE column_name = 'eventdatavalues' AND table_schema = 'public'
                LOOP
                    EXECUTE format(
                        'UPDATE %I SET eventdatavalues = jsonb_set(
                            eventdatavalues, ''{TrE2eDe0001}'',
                            (eventdatavalues -> ''TrE2eDe0002'') || ''{\"value\": \"\"}''::jsonb)
                        WHERE uid = ''TrE2eEvt003''',
                        event_table);
                END LOOP;
            END \$\$;"

    curl --fail --silent --show-error --globoff \
        --user "$username:$password" \
        "$E2E_DHIS2_URL/api/tracker/events/TrE2eEvt003?fields=dataValues[dataElement,value]" \
        | jq -e '.dataValues | any(.dataElement == "TrE2eDe0001" and (.value // "") == "")' >/dev/null
}

import_tracked_entity_record_data() {
    local import_payload="$artifact_dir/ter-tracker-data.json"

    jq --arg id "$ter_deleted_enrollment" \
        'del(.enrollments[] | select(.enrollment == $id))' \
        "$ter_tracker_payload" >"$import_payload"

    post_and_require_ok \
        '/api/tracker?async=false&importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&reportMode=FULL' \
        "$import_payload" \
        "$artifact_dir/ter-tracker-import.json"
    ensure_deleted_enrollment
    store_empty_event_data_value

    curl --fail --silent --show-error --globoff \
        --user "$username:$password" \
        "$E2E_DHIS2_URL/api/tracker/trackedEntities/TrE2eTei001?fields=enrollments[enrollment]" \
        | jq -e '(.enrollments | length) == 4' >/dev/null
}

echo "Importing idempotent working-list metadata into DHIS2 $E2E_VERSION_SLUG ..."
echo "Allowing the isolated browser origin $E2E_APP_URL ..."
configure_cors_allowlist

post_and_require_ok \
    '/api/metadata?importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&importReportMode=ERRORS' \
    "$E2E_REPO_ROOT/e2e/metadata/working-list-metadata.json" \
    "$metadata_response"

echo "Creating idempotent non-admin permission fixtures ..."
ensure_test_users
ensure_saved_lists

echo "Importing idempotent tracker records ..."
post_and_require_ok \
    '/api/tracker?async=false&importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&reportMode=FULL' \
    "$E2E_REPO_ROOT/e2e/metadata/working-list-tracker-data.json" \
    "$tracker_response"

curl --fail --silent --show-error \
    --user "$username:$password" \
    "$E2E_DHIS2_URL/api/programs/WlE2ePrg001?fields=id,programType" \
    | jq -e '.id == "WlE2ePrg001" and .programType == "WITH_REGISTRATION"' >/dev/null

echo "Corrupting one attribute value behind the importer's back ..."
corrupt_data_quality_fixture

echo "Supplemental working-list metadata and records are ready."

echo "Importing idempotent tracked-entity-record metadata, users and records ..."
post_and_require_ok \
    '/api/metadata?importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&importReportMode=ERRORS' \
    "$E2E_REPO_ROOT/e2e/metadata/tracked-entity-record-metadata.json" \
    "$artifact_dir/ter-metadata-import.json"
ensure_users_from_payload "$ter_users_payload" "$ter_user_password"
import_tracked_entity_record_data

echo "Tracked entity record metadata and records are ready."
