#!/usr/bin/env bash

# Records the API responses the tracked-entity-record block is tested against
# (spec section 8.2), as the restricted seeded user, never as admin. Run it
# against a seeded stack:
#
#   pnpm e2e:up 42
#   bash scripts/e2e/record-tracked-entity-record-fixtures.sh 42
#   pnpm e2e:down 42
#
# The `fields` strings below are the request plan's field selections. The
# block's requests.ts copies them verbatim.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

e2e_load_version "${1:-}"
e2e_require_command curl
e2e_require_command jq
e2e_require_command pnpm

recorder_username='ter_e2e_nurse'
recorder_password='TrackedEntity123!'
fixture_dir="$E2E_REPO_ROOT/packages/registry/blocks/tracked-entity-record/__tests__/fixtures/v$E2E_VERSION_SLUG"

# Seed ids (e2e/metadata/tracked-entity-record-*.json).
person_one='TrE2eTei001'
person_two='TrE2eTei002'
person_three='TrE2eTei003'
person_missing='TrE2eMis001'
tracked_entity_type='TrE2eTet001'
person_one_programs='TrE2ePrg001,TrE2ePrg002,TrE2ePrg003'

# ---------------------------------------------------------------------------
# Field selections. Copy these into the block's requests.ts unchanged.
# ---------------------------------------------------------------------------

NOTE_FIELDS='note,value,storedAt,storedBy,createdBy[uid,username,displayName]'

OPTION_SET_FIELDS='id,options[code,displayName]'

EVENT_FIELDS="event,program,programStage,enrollment,status,occurredAt,scheduledAt,completedAt,createdAt,updatedAt,orgUnit,geometry,dataValues[dataElement,value],notes[$NOTE_FIELDS]"

ENROLLMENT_FIELDS="enrollment,program,status,orgUnit,enrolledAt,occurredAt,completedAt,followUp,createdAt,updatedAt,attributes[attribute,value],notes[$NOTE_FIELDS],events[$EVENT_FIELDS]"

# Request 1: the person, every enrollment and event the user may read. Made
# without `program`, so one answer is one consistent snapshot.
PERSON_FIELDS="trackedEntity,trackedEntityType,orgUnit,inactive,potentialDuplicate,createdAt,updatedAt,attributes[attribute,value],programOwners[program,orgUnit],enrollments[$ENROLLMENT_FIELDS]"

ATTRIBUTE_FIELDS="id,displayName,displayShortName,displayFormName,valueType,unique,optionSet[$OPTION_SET_FIELDS]"

DATA_ELEMENT_FIELDS="id,displayName,displayShortName,displayFormName,valueType,optionSet[$OPTION_SET_FIELDS]"

STAGE_FIELDS="id,displayName,sortOrder,repeatable,autoGenerateEvent,openAfterEnrollment,generatedByEnrollmentDate,reportDateToUse,minDaysFromStart,standardInterval,hideDueDate,blockEntryForm,allowGenerateNextVisit,executionDateLabel,displayExecutionDateLabel,dueDateLabel,displayDueDateLabel,access[data[read,write]],programStageDataElements[displayInReports,sortOrder,dataElement[$DATA_ELEMENT_FIELDS]]"

# Request 2: program metadata for `filter=id:in:[...]&paging=false`.
PROGRAM_FIELDS="id,displayName,programType,accessLevel,onlyEnrollOnce,displayIncidentDate,selectEnrollmentDatesInFuture,selectIncidentDatesInFuture,enrollmentDateLabel,displayEnrollmentDateLabel,incidentDateLabel,displayIncidentDateLabel,featureType,completeEventsExpiryDays,expiryDays,expiryPeriodType,access[data[read,write]],trackedEntityType[id],programTrackedEntityAttributes[displayInList,mandatory,sortOrder,trackedEntityAttribute[$ATTRIBUTE_FIELDS]],programStages[$STAGE_FIELDS]"

# Request 3: the tracked entity type.
TRACKED_ENTITY_TYPE_FIELDS="id,displayName,access[data[read,write]],trackedEntityTypeAttributes[displayInList,mandatory,trackedEntityAttribute[$ATTRIBUTE_FIELDS]]"

# Request 4: relationships of the person, and the relationship types named in them.
RELATIONSHIP_SIDE_FIELDS='trackedEntity[trackedEntity,attributes[attribute,value]],enrollment[enrollment],event[event]'
RELATIONSHIP_FIELDS="relationship,relationshipType,createdAt,from[$RELATIONSHIP_SIDE_FIELDS],to[$RELATIONSHIP_SIDE_FIELDS]"
RELATIONSHIP_TYPE_FIELDS='id,displayName,fromToName,toFromName,bidirectional'

# Request 5, only when an owned-elsewhere program is found: scopes and paths.
USER_SCOPE_FIELDS='organisationUnits[id],teiSearchOrganisationUnits[id]'
ORG_UNIT_PATH_FIELDS='id,path'

# ---------------------------------------------------------------------------

api_get() {
    # api_get <path> [curl --data-urlencode arguments...]; prints the body and
    # fails on a non-2xx answer.
    local path="$1"
    shift
    curl --fail --silent --show-error --globoff --get \
        --user "$recorder_username:$recorder_password" \
        "$@" \
        "$E2E_DHIS2_URL/api/$path"
}

record() {
    # record <file name> <path> [curl --data-urlencode arguments...]
    local file_name="$1"
    shift
    api_get "$@" | jq -S . >"$fixture_dir/$file_name"
    echo "  $file_name"
}

e2e_actual_version="$(curl --fail --silent --show-error \
    --user "$recorder_username:$recorder_password" \
    "$E2E_DHIS2_URL/api/system/info?fields=version" | jq --raw-output '.version')"
if [[ "$e2e_actual_version" != "2.$E2E_EXPECTED_MAJOR"* ]]; then
    echo "Expected DHIS2 2.$E2E_EXPECTED_MAJOR at $E2E_DHIS2_URL, found $e2e_actual_version." >&2
    exit 65
fi

curl --fail --silent --show-error --globoff \
    --user "$recorder_username:$recorder_password" \
    "$E2E_DHIS2_URL/api/me?fields=username,authorities" \
    | jq -e --arg user "$recorder_username" \
        '.username == $user and (.authorities | index("ALL") | not)' >/dev/null

mkdir -p "$fixture_dir"
rm -f "$fixture_dir"/*.json
echo "Recording tracked-entity-record fixtures from DHIS2 $e2e_actual_version as $recorder_username into $fixture_dir"

for person in "$person_one" "$person_two" "$person_three"; do
    case "$person" in
        "$person_one") label='P1' ;;
        "$person_two") label='P2' ;;
        *) label='P3' ;;
    esac
    record "person-$label.json" "tracker/trackedEntities/$person" \
        --data-urlencode "fields=$PERSON_FIELDS"
done

# A person that does not exist: the status and the body are the fixture. Every
# version records 404 E1005 here; 2.41 answers 403 only for access cases (spec
# 7.1), and the block maps both to unavailable.
missing_body="$(mktemp)"
missing_status="$(curl --silent --show-error --globoff --get \
    --user "$recorder_username:$recorder_password" \
    --data-urlencode "fields=$PERSON_FIELDS" \
    --output "$missing_body" \
    --write-out '%{http_code}' \
    "$E2E_DHIS2_URL/api/tracker/trackedEntities/$person_missing")"
jq -S --argjson status "$missing_status" '{status: $status, body: .}' "$missing_body" \
    >"$fixture_dir/person-missing.status.json"
rm -f "$missing_body"
echo "  person-missing.status.json (HTTP $missing_status)"

record programs.json programs \
    --data-urlencode "filter=id:in:[$person_one_programs]" \
    --data-urlencode 'paging=false' \
    --data-urlencode "fields=$PROGRAM_FIELDS"

record tracked-entity-type.json "trackedEntityTypes/$tracked_entity_type" \
    --data-urlencode "fields=$TRACKED_ENTITY_TYPE_FIELDS"

record relationships-P1.json tracker/relationships \
    --data-urlencode "trackedEntity=$person_one" \
    --data-urlencode 'paging=false' \
    --data-urlencode "fields=$RELATIONSHIP_FIELDS"

relationship_type_ids="$(jq --raw-output '[.. | .relationshipType? // empty] | unique | join(",")' \
    "$fixture_dir/relationships-P1.json")"
record relationship-types.json relationshipTypes \
    --data-urlencode "filter=id:in:[$relationship_type_ids]" \
    --data-urlencode 'paging=false' \
    --data-urlencode "fields=$RELATIONSHIP_TYPE_FIELDS"

record user-scopes.json me \
    --data-urlencode "fields=$USER_SCOPE_FIELDS"

# The owner org units named by P1 (every program, visible or not).
owner_ids="$(jq --raw-output '[.programOwners[].orgUnit] | unique | join(",")' \
    "$fixture_dir/person-P1.json")"
record org-unit-paths.json organisationUnits \
    --data-urlencode "filter=id:in:[$owner_ids]" \
    --data-urlencode 'paging=false' \
    --data-urlencode "fields=$ORG_UNIT_PATH_FIELDS"

# `jq -S` fixes the key order; oxfmt then lays the files out the way the repo's
# format check expects, so recording twice produces no diff noise.
(cd "$E2E_REPO_ROOT" && pnpm exec oxfmt --write "$fixture_dir" >/dev/null)

recorded_count="$(find "$fixture_dir" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')"
echo "Recorded $recorded_count files."
[[ "$recorded_count" == "10" ]]
