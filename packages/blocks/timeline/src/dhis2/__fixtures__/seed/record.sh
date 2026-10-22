#!/usr/bin/env bash
# Seeds the timeline test record into a local e2e stack and records the
# fixtures in ../v<version>/. Local Docker stacks only (scripts/e2e).
#
#   pnpm e2e:up 42
#   bash packages/blocks/timeline/src/dhis2/__fixtures__/seed/record.sh 42
#   pnpm e2e:down 42
#
# The requests mirror src/dhis2/queries.ts; keep the two in step.

set -euo pipefail

version="${1:?usage: record.sh <41|42|43>}"
port="${DHIS2_HTTP_PORT:-584${version}}"
base="http://127.0.0.1:${port}/api"
auth="${E2E_DHIS2_USERNAME:-admin}:${E2E_DHIS2_PASSWORD:-district}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$here/../v${version}"
mkdir -p "$out"

te=TlE2eTei001
program=WSGAb5XwJ3Y
event_with_changes=TlE2eEvt004
event_fields='event,status,program,programStage,enrollment,trackedEntity,orgUnit,occurredAt,scheduledAt,completedAt,completedBy,createdAt,updatedAt,createdBy,updatedBy,dataValues[dataElement,value],notes[note,value,storedAt,storedBy,createdBy]'

get() {
    curl --silent --globoff --user "$auth" "$base/$1"
}

# Writes the body to $out/$2 with the HTTP status recorded alongside, so a
# 404 on an older version is recorded as what it is.
record() {
    local path="$1" name="$2" filter="${3:-.}"
    local body status
    body="$(curl --silent --globoff --user "$auth" --write-out '\n%{http_code}' "$base/$path")"
    status="${body##*$'\n'}"
    body="${body%$'\n'*}"
    if [[ "$status" == 200 ]]; then
        jq --sort-keys "$filter" <<<"$body" >"$out/$name"
    else
        jq --sort-keys --arg status "$status" '{httpStatusCode: ($status | tonumber), body: .}' <<<"$body" >"$out/$name"
    fi
    echo "$name: HTTP $status"
}

import() {
    curl --silent --globoff --user "$auth" -H 'Content-Type: application/json' \
        -X POST "$base/tracker?async=false&importStrategy=$1" --data @"$here/$2" |
        jq -c '{file: "'"$2"'", status, stats, errors: [.validationReport.errorReports[]?.message]}'
}

if [[ "$(get "tracker/trackedEntities/$te?fields=trackedEntity" | jq -r '.trackedEntity // empty')" != "$te" ]]; then
    import CREATE timeline-tracker-data.json
    import UPDATE timeline-tracker-updates-1.json
    sleep 1
    import UPDATE timeline-tracker-updates-2.json
fi

events="tracker/events?trackedEntity=$te&program=$program&fields=$event_fields"
record "$events&order=occurredAt:desc,event:desc&page=1&pageSize=4" events-page-1.json
record "$events&order=occurredAt:desc,event:desc&page=2&pageSize=4" events-page-2.json
for status in SCHEDULE SKIPPED OVERDUE; do
    lower="$(tr '[:upper:]' '[:lower:]' <<<"$status")"
    record "$events&status=$status&order=scheduledAt:asc,event:asc&page=1&pageSize=51" "events-$lower.json"
done

record "tracker/trackedEntities/$te?program=$program&fields=trackedEntity,trackedEntityType,orgUnit,enrollments[enrollment,program,status,orgUnit,enrolledAt,occurredAt,completedAt,completedBy,createdAt,updatedAt,createdBy,updatedBy,notes[note,value,storedAt,storedBy,createdBy]]" tracked-entity.json

record "tracker/trackedEntities/$te/changeLogs?program=$program&order=createdAt:desc&page=1&pageSize=50" tracked-entity-changelog.json
record "tracker/events/$event_with_changes/changeLogs?order=createdAt:desc&page=1&pageSize=50" event-changelog.json

# Trimmed to three data elements per stage (two shown in reports, one not),
# four attributes and three options per option set; every field is kept.
record "programs/$program?fields=id,displayName,programStages[id,displayName,sortOrder,hideDueDate,repeatable,programStageDataElements[displayInReports,dataElement[id,displayName,displayFormName,valueType,optionSet[options[code,displayName]]]]],programTrackedEntityAttributes[trackedEntityAttribute[id,displayName,displayFormName,valueType,optionSet[options[code,displayName]]]]" program-metadata.json \
    'def trim_options: if .optionSet then .optionSet.options |= .[0:3] else . end;
     .programStages |= map(.programStageDataElements |= ((map(select(.displayInReports))[0:2]) + (map(select(.displayInReports | not))[0:1]) | map(.dataElement |= trim_options)))
     | .programTrackedEntityAttributes |= (map(select(.trackedEntityAttribute.id | IN("w75KJ2mc4zz", "zDhUuAYrxNC", "gHGyrwKPzej", "ciq2USN94oJ"))) | map(.trackedEntityAttribute |= trim_options))'

record "organisationUnits?filter=id:in:[DiszpKrYNg8,ImspTQPwCqd]&fields=id,displayName&paging=false" org-unit-names.json
