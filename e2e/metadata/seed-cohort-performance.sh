#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../scripts/docs/lib-docs.sh"
docs_load_version "${1:-}"
action="${2:-}"
batch="${3:-}"
if [[ ! "$batch" =~ ^[0-9a-f]{7}$ || ( "$action" != seed && "$action" != cleanup ) ]]; then
    echo 'Expected: <version> <seed|cleanup> <seven hex digits>' >&2
    exit 64
fi

e2e_require_command curl
e2e_require_command docker
e2e_require_command jq

local_url="http://127.0.0.1:$DHIS2_HTTP_PORT"
if [[ "$E2E_DHIS2_URL" != "$local_url" ||
      "$(e2e_compose port dhis2 8080)" != "127.0.0.1:$DHIS2_HTTP_PORT" ]]; then
    echo "Cohort seeding requires the disposable local docs DHIS2 stack." >&2
    exit 64
fi

db() {
    e2e_compose exec -T database psql \
        --no-password --quiet --tuples-only --no-align --username dhis --dbname dhis \
        --set ON_ERROR_STOP=1 --command "$1"
}

count=250
import_tracker() {
    curl --fail-with-body --silent --show-error --max-time 60 \
        --user "${E2E_DHIS2_USERNAME:-admin}:${E2E_DHIS2_PASSWORD:-district}" \
        --header 'Content-Type: application/json' --data-binary @- \
        "$local_url/api/tracker?async=false&importStrategy=$1&reportMode=ERRORS" |
        jq -e 'if .status == "OK" then .stats else error(tostring) end'
}

if [[ "$action" == cleanup ]]; then
    entity_table="$(db "SELECT COALESCE(to_regclass('trackedentity'), to_regclass('trackedentityinstance'))")"
    case "$entity_table" in
        trackedentity|trackedentityinstance) ;;
        *) echo 'Cannot find the docs DHIS2 tracked entity table.' >&2; exit 1 ;;
    esac
    people="$(db "SELECT uid FROM $entity_table
        WHERE NOT deleted AND uid ~ '^P${batch}[0-9]{3}$'")"
    if [[ -n "$people" ]]; then
        printf '%s\n' "$people" |
            jq -Rn '{trackedEntities: [inputs | {trackedEntity: .}]}' |
            import_tracker DELETE
    fi
    exit 0
fi

enrollment_table="$(db "SELECT COALESCE(to_regclass('enrollment'), to_regclass('programinstance'))")"
case "$enrollment_table" in
    enrollment|programinstance) ;;
    *) echo 'Cannot find the docs DHIS2 enrollment table.' >&2; exit 1 ;;
esac

jq -n --argjson count "$count" --arg batch "$batch" '
    def suffix: ("00" + tostring)[-3:];
    def event($uid; $stage; $date; $pressure): {
        event: $uid,
        programStage: $stage,
        orgUnit: "DiszpKrYNg8",
        status: "ACTIVE",
        occurredAt: $date,
        dataValues: [{dataElement: "dyYdfamSY2Z", value: ($pressure | tostring)}]
    };
    {trackedEntities: [range($count) as $i | ($i | suffix) as $id | {
        trackedEntity: ("P" + $batch + $id),
        trackedEntityType: "nEenWmSyUEp",
        orgUnit: "DiszpKrYNg8",
        attributes: [
            {attribute: "lZGmxYbs97q", value: ("Cohort" + $batch + $id)},
            {attribute: "w75KJ2mc4zz", value: "Cohort"},
            {attribute: "zDhUuAYrxNC", value: ("Patient " + $id)},
            {attribute: "gHGyrwKPzej", value: "1990-01-04"}
        ],
        enrollments: [{
            enrollment: ("E" + $batch + $id),
            program: "WSGAb5XwJ3Y",
            orgUnit: "DiszpKrYNg8",
            enrolledAt: "2020-01-15",
            occurredAt: "2020-01-15",
            events: [
                event(("F" + $batch + $id); "WZbXY0S00lP"; "2020-01-15"; 70 + ($i % 15)),
                event(("V" + $batch + $id); "edqlbukwRfQ"; "2020-02-15"; 72 + ($i % 15))
            ]
        }]
    }]}' |
    import_tracker CREATE

# DHIS2 rejects future enrollment dates through Tracker's API. Match the
# demo's January 2027 cohort with real imported enrollments on this stack only.
db "UPDATE $enrollment_table SET enrollmentdate = DATE '2027-01-25'
    WHERE uid ~ '^E${batch}[0-9]{3}$'"
